import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import dns from 'dns'
import { promisify } from 'util'
import os from 'os'

const dnsResolve = promisify(dns.resolve4)

// --- Rate limiting ---

const RATE_LIMIT_WINDOW = 60_000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5
const MAX_CONCURRENT_TRACES = 10

const requestLog = new Map<string, number[]>()
let activeTraces = 0

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1'
}

function isRateLimited(clientIp: string): boolean {
  const now = Date.now()
  const timestamps = requestLog.get(clientIp) || []
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW)
  requestLog.set(clientIp, recent)
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) return true
  recent.push(now)
  return false
}

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, timestamps] of requestLog) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW)
    if (recent.length === 0) requestLog.delete(ip)
    else requestLog.set(ip, recent)
  }
}, 300_000)

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
  const lower = ip.toLowerCase()

  // IPv6
  if (lower === '::1') return true                    // loopback
  if (lower === '::') return true                     // unspecified
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true  // unique local
  if (lower.startsWith('fe80')) return true            // link-local
  if (lower.startsWith('ff')) return true              // multicast
  if (lower.startsWith('100::')) return true           // discard prefix
  if (lower.startsWith('::ffff:')) {                   // IPv4-mapped IPv6
    const mapped = lower.slice(7)
    if (mapped.includes('.')) return isPrivateIP(mapped)
  }

  // IPv4
  if (ip === '0.0.0.0') return true
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p))) return false

  const [a, b] = parts
  if (a === 10) return true                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true   // 172.16.0.0/12
  if (a === 192 && b === 168) return true             // 192.168.0.0/16
  if (a === 127) return true                          // 127.0.0.0/8
  if (a === 169 && b === 254) return true             // 169.254.0.0/16
  if (a === 0) return true                            // 0.0.0.0/8
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

// --- Geolocation cache ---

const GEO_CACHE_TTL = 600_000 // 10 minutes
const geoCache = new Map<string, { result: GeoResult | null; expires: number }>()

async function geolocateIP(ip: string): Promise<GeoResult | null> {
  if (!ip || ip === '*' || isPrivateIP(ip)) return null

  // Check cache
  const cached = geoCache.get(ip)
  if (cached && cached.expires > Date.now()) return cached.result

  const result = await fetchGeoData(ip)
  geoCache.set(ip, { result, expires: Date.now() + GEO_CACHE_TTL })

  // Evict stale entries if cache grows large
  if (geoCache.size > 500) {
    const now = Date.now()
    for (const [key, val] of geoCache) {
      if (val.expires < now) geoCache.delete(key)
    }
  }

  return result
}

async function fetchGeoData(ip: string): Promise<GeoResult | null> {
  // Try ipapi.co first (HTTPS)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
    })
    clearTimeout(timer)
    const data = await res.json()
    if (!data.error) {
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
    }
  } catch {
    // fall through to backup
  }

  // Fallback: ip-api.com (HTTP only on free tier)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country,countryCode,lat,lon,org,as`, {
      signal: controller.signal,
    })
    clearTimeout(timer)
    const data = await res.json()
    if (data.status === 'success') {
      return {
        city: data.city || 'Unknown',
        region: data.regionName || '',
        country: data.country || 'Unknown',
        country_code: data.countryCode || '',
        lat: data.lat || 0,
        lon: data.lon || 0,
        org: data.org || null,
        asn: data.as?.split(' ')[0] || null,
      }
    }
  } catch {
    return null
  }

  return null
}

// --- GlobalPing API fallback (for serverless environments) ---

interface GlobalPingHop {
  resolvedHostname: string
  resolvedAddress: string
  timings: { rtt: number }[]
}

interface GlobalPingResult {
  probe: { city: string; country: string; asn: number; network: string }
  result: {
    status: string
    resolvedAddress: string
    resolvedHostname: string
    hops: GlobalPingHop[]
  }
}

async function traceViaGlobalPing(
  targetIp: string,
  target: string,
  send: (event: string, data: unknown) => void,
  close: () => void,
) {
  try {
    // Create measurement
    const createRes = await fetch('https://api.globalping.io/v1/measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'traceroute',
        target: targetIp,
        locations: [{ magic: 'North America' }],
        limit: 1,
      }),
    })

    if (!createRes.ok) {
      send('error', { message: 'Trace service unavailable' })
      close()
      return
    }

    const { id } = await createRes.json() as { id: string }

    // Poll for results (max 30s)
    let result: GlobalPingResult | null = null
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(r => setTimeout(r, 2000))

      const pollRes = await fetch(`https://api.globalping.io/v1/measurements/${id}`)
      if (!pollRes.ok) continue

      const data = await pollRes.json() as { status: string; results: GlobalPingResult[] }
      if (data.status === 'finished' && data.results?.[0]) {
        result = data.results[0]
        break
      }
    }

    if (!result || result.result.status !== 'finished') {
      send('error', { message: 'Trace timed out' })
      close()
      return
    }

    // Process hops
    const hops = result.result.hops
    let hopCount = 0
    let respondingHops = 0
    const countries = new Set<string>()
    const allRtts: number[] = []

    for (let i = 0; i < hops.length; i++) {
      const h = hops[i]
      const ip = h.resolvedAddress || '*'
      const rttValues = h.timings.map(t => t.rtt)

      hopCount++
      if (ip !== '*') respondingHops++
      for (const t of rttValues) {
        if (t !== null) allRtts.push(t)
      }

      const geo = await geolocateIP(ip)
      const hop = {
        hop: i + 1,
        ip,
        hostname: h.resolvedHostname || ip,
        rtt: rttValues.length > 0 ? rttValues : [null, null, null],
        location: geo ? {
          city: geo.city,
          region: geo.region,
          country: geo.country,
          country_code: geo.country_code,
          lat: geo.lat,
          lon: geo.lon,
        } : null,
        org: geo?.org || (isPrivateIP(ip) ? 'Private Network' : null),
        asn: geo?.asn || null,
      }

      if (geo?.country_code) countries.add(geo.country_code)
      send('hop', hop)
    }

    // Emit target event
    const targetGeo = await geolocateIP(targetIp)
    if (targetGeo) {
      send('target', {
        ip: targetIp,
        hostname: target !== targetIp ? target : result.result.resolvedHostname || targetIp,
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
    close()
  } catch (err) {
    console.error('GlobalPing trace error:', err)
    send('error', { message: 'Trace failed — unable to reach target' })
    close()
  }
}

// --- Detect if local traceroute is available ---

function canSpawnTraceroute(): boolean {
  // Vercel/serverless sets specific env vars
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return false
  return true
}

// --- SSE endpoint ---

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientIp = getClientIP(request)
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again in a minute.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    })
  }

  // Concurrent trace cap
  if (activeTraces >= MAX_CONCURRENT_TRACES) {
    return new Response(JSON.stringify({ error: 'Server busy. Please try again shortly.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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
  const localhostAliases: Record<string, string> = {
    'localhost': '127.0.0.1',
    '::1': '127.0.0.1',
  }
  if (localhostAliases[target.toLowerCase()]) {
    targetIp = localhostAliases[target.toLowerCase()]
  } else if (!ipv4Regex.test(target)) {
    try {
      const ips = await dnsResolve(target)
      targetIp = ips[0]
    } catch (err) {
      console.error('DNS resolution failed:', err)
      return new Response(JSON.stringify({ error: 'Could not resolve hostname' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // Private IPs can't be traced via GlobalPing
  if (isPrivateIP(targetIp) && !canSpawnTraceroute()) {
    return new Response(JSON.stringify({ error: 'Cannot trace private/local addresses from hosted environment' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  activeTraces++

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      const send = (event: string, data: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      const close = () => {
        if (closed) return
        closed = true
        activeTraces--
        controller.close()
      }

      // Use local traceroute if available, otherwise fall back to GlobalPing
      if (canSpawnTraceroute()) {
        runLocalTrace(targetIp, target, send, close)
      } else {
        traceViaGlobalPing(targetIp, target, send, close)
      }
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

// --- Local traceroute (spawns system process) ---

function runLocalTrace(
  targetIp: string,
  target: string,
  send: (event: string, data: unknown) => void,
  close: () => void,
) {
  const platform = os.platform()
  const isWindows = platform === 'win32'
  const cmd = isWindows ? 'tracert' : 'traceroute'
  const args = isWindows
    ? ['-d', '-h', '30', '-w', '500', targetIp]
    : ['-m', '30', '-w', '1', '-q', '3', targetIp]

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
  }, 60000)

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
      queue = queue.then(() => processLine(line))
    }
  })

  proc.on('close', () => {
    clearTimeout(timeout)

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
      close()
    })
  })

  proc.stderr.on('data', (chunk: Buffer) => {
    console.error('traceroute stderr:', chunk.toString())
  })

  proc.on('error', (err) => {
    clearTimeout(timeout)
    console.error('traceroute process error:', err.message)
    // Local spawn failed — fall back to GlobalPing
    traceViaGlobalPing(targetIp, target, send, close)
  })
}
