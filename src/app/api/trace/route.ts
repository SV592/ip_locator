import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import dns from 'dns'
import { promisify } from 'util'
import os from 'os'

const dnsResolve = promisify(dns.resolve4)

// --- Input validation ---

const VALID_TARGET = /^[a-zA-Z0-9.\-:]+$/
const MAX_TARGET_LENGTH = 253

function isValidTarget(target: string): boolean {
  if (!target || target.length > MAX_TARGET_LENGTH) return false
  if (!VALID_TARGET.test(target)) return false
  return true
}

// --- Private IP detection (RFC 1918 + loopback + link-local) ---

function isPrivateIP(ip: string): boolean {
  // IPv6
  if (ip === '::1') return true
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true

  // IPv4
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p))) return false

  const [a, b] = parts
  if (a === 10) return true                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true   // 172.16.0.0/12
  if (a === 192 && b === 168) return true             // 192.168.0.0/16
  if (a === 127) return true                          // 127.0.0.0/8
  if (a === 169 && b === 254) return true             // 169.254.0.0/16
  return false
}

// --- Traceroute parsing ---

interface ParsedHop {
  hop: number
  ip: string
  hostname: string
  rtt: (number | null)[]
}

function parseWindowsLine(line: string): ParsedHop | null {
  const hopMatch = line.match(/^\s*(\d+)/)
  if (!hopMatch) return null

  const hopNumber = parseInt(hopMatch[1])
  const times: (number | null)[] = []
  const timeMatches = [...line.matchAll(/(\d+)\s*ms/g)]
  for (const m of timeMatches) times.push(parseFloat(m[1]))
  // Pad to 3 entries with nulls for any missing probes
  while (times.length < 3) times.push(null)

  const ipMatch = line.match(/\[([^\]]+)\]/) || line.match(/(\d+\.\d+\.\d+\.\d+)/)
  const ip = ipMatch ? ipMatch[1] : '*'

  const hostMatch = line.match(/^\s*\d+\s+(?:[\d<]+\s+ms\s+)+(.+?)\s+\[/)
  const hostname = hostMatch ? hostMatch[1].trim() : ip

  return { hop: hopNumber, ip, hostname, rtt: times }
}

function parseUnixLine(line: string): ParsedHop | null {
  const hopMatch = line.match(/^\s*(\d+)\s+/)
  if (!hopMatch) return null

  const hopNumber = parseInt(hopMatch[1])

  if (line.includes('* * *')) {
    return { hop: hopNumber, ip: '*', hostname: '*', rtt: [null, null, null] }
  }

  const hostIpMatch = line.match(/^\s*\d+\s+(\S+)\s+\(([^)]+)\)/)
  const hostname = hostIpMatch ? hostIpMatch[1] : '*'
  const ip = hostIpMatch ? hostIpMatch[2] : '*'

  const times: number[] = []
  for (const m of line.matchAll(/([\d.]+)\s*ms/g)) times.push(parseFloat(m[1]))

  return { hop: hopNumber, ip, hostname: hostname || ip, rtt: times.length > 0 ? times : [null, null, null] }
}

// --- Geolocation ---

interface GeoResult {
  city: string
  region: string
  country: string
  country_code: string
  lat: number
  lon: number
  org: string | null
  asn: string | null
}

async function geolocateIP(ip: string): Promise<GeoResult | null> {
  if (!ip || ip === '*' || isPrivateIP(ip)) return null
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`)
    const data = await res.json()
    if (data.error) return null
    return {
      city: data.city || 'Unknown',
      region: data.region || '',
      country: data.country_name || 'Unknown',
      country_code: data.country_code || '',
      lat: data.latitude || 0,
      lon: data.longitude || 0,
      org: data.org || null,
      asn: data.asn || null,
    }
  } catch {
    return null
  }
}

// --- SSE endpoint ---

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('target')

  if (!target || !isValidTarget(target)) {
    return new Response(JSON.stringify({ error: 'Invalid target' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Resolve domain to IP if needed
  let targetIp = target
  const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/
  if (!ipv4Regex.test(target)) {
    try {
      const ips = await dnsResolve(target)
      targetIp = ips[0]
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to resolve domain' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const platform = os.platform()
  const isWindows = platform === 'win32'
  const cmd = isWindows ? 'tracert' : 'traceroute'
  const args = isWindows
    ? ['-h', '30', '-w', '1000', targetIp]
    : ['-m', '30', '-w', '1', '-q', '3', targetIp]

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      const proc = spawn(cmd, args)
      let buffer = ''
      let hopCount = 0
      let respondingHops = 0
      const countries = new Set<string>()
      const allRtts: number[] = []
      const headerLines = isWindows ? 4 : 1
      let lineCount = 0

      // Queue to serialize async geolocation — prevents race conditions
      // from concurrent data events
      let queue: Promise<void> = Promise.resolve()

      const timeout = setTimeout(() => {
        proc.kill()
        send('error', { message: 'Traceroute timed out' })
        controller.close()
      }, 30000)

      async function processLine(line: string) {
        lineCount++
        if (lineCount <= headerLines || !line.trim()) return

        const parsed = isWindows ? parseWindowsLine(line) : parseUnixLine(line)
        if (!parsed) return

        hopCount++
        if (parsed.ip !== '*') respondingHops++
        for (const t of parsed.rtt) {
          if (t !== null) allRtts.push(t)
        }

        // Geolocate (async but serialized via queue)
        const geo = await geolocateIP(parsed.ip)
        const hop = {
          hop: parsed.hop,
          ip: parsed.ip,
          hostname: parsed.hostname,
          rtt: parsed.rtt,
          location: geo ? {
            city: geo.city,
            region: geo.region,
            country: geo.country,
            country_code: geo.country_code,
            lat: geo.lat,
            lon: geo.lon,
          } : null,
          org: geo?.org || (isPrivateIP(parsed.ip) ? 'Private Network' : null),
          asn: geo?.asn || null,
        }

        if (geo?.country_code) countries.add(geo.country_code)
        send('hop', hop)
      }

      proc.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          // Chain each line onto the queue to serialize processing
          queue = queue.then(() => processLine(line))
        }
      })

      proc.on('close', () => {
        clearTimeout(timeout)

        // Process remaining buffer (also geolocated), then emit summary
        queue = queue.then(async () => {
          if (buffer.trim()) {
            await processLine(buffer)
          }

          // Emit target event: geolocate the target IP itself
          const targetGeo = await geolocateIP(targetIp)
          if (targetGeo) {
            send('target', {
              ip: targetIp,
              hostname: target !== targetIp ? target : targetIp,
              city: targetGeo.city,
              region: targetGeo.region,
              country: targetGeo.country,
              lat: targetGeo.lat,
              lon: targetGeo.lon,
              org: targetGeo.org || 'Unknown',
            })
          }

          const avgRtt = allRtts.length > 0
            ? allRtts.reduce((s, r) => s + r, 0) / allRtts.length
            : 0

          send('summary', {
            totalHops: hopCount,
            respondingHops,
            countries: countries.size,
            averageRtt: Math.round(avgRtt * 10) / 10,
          })
          send('done', {})
          controller.close()
        })
      })

      proc.stderr.on('data', (chunk: Buffer) => {
        console.error('traceroute stderr:', chunk.toString())
      })

      proc.on('error', (err) => {
        clearTimeout(timeout)
        send('error', { message: `Traceroute failed: ${err.message}` })
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
