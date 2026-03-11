# Phase 1: Foundation + Core Traceroute — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize rendering performance (TopoJSON, merged geometry), add shared state (Zustand), rewrite the traceroute API as SSE streaming, build the dual-sidebar HUD, and render hop markers + arcs on the globe.

**Architecture:** Zustand store is the central data hub. SSE streams hops from the API into the store. HUD panels (HTML overlays) and 3D markers/arcs (R3F children) both read from the store. Countries/States get rewritten to use TopoJSON with merged BufferGeometry for a single draw call.

**Tech Stack:** Next.js 15.5, React 19, Three.js/R3F, Zustand, topojson-client, world-atlas

**Spec:** `docs/superpowers/specs/2026-03-11-ip-locator-overhaul-design.md`

**Phases 2 & 3** (cinematic viz, UX polish, mobile) will be planned separately after Phase 1 ships.

---

## Chunk 1: Foundation — Dependencies, Types, Store

### Task 1: Install Dependencies & Clean Up

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new dependencies**

```bash
npm install zustand topojson-client world-atlas
npm install -D @types/topojson-client
```

- [ ] **Step 2: Remove unused dependencies**

```bash
npm uninstall earcut three-geojson-geometry @types/earcut @types/d3-geo
```

- [ ] **Step 3: Delete dead files**

Delete these files:
- `public/geo_json/countries.json` (14.6 MB — replaced by world-atlas)
- `src/app/components/IPTracker.tsx` (replaced by SearchBar)
- `src/app/components/Hop.tsx` (replaced by HopList + HopMarkers)
- `src/app/utils/threeGeoJSON.ts` (replaced by direct TopoJSON → BufferGeometry)
- `src/app/types/geo.ts` (replaced by new type definitions)

Do NOT delete `public/geo_json/countries_states.json` yet — States.tsx will be updated in Task 4 to use merged BufferGeometry with this file (it's only 445 KB, not a bottleneck).

- [ ] **Step 4: Verify the app still builds**

```bash
npm run build
```

Expected: Build will fail because Countries.tsx, States.tsx, Scene.tsx, and page.tsx still reference deleted files. This is expected — we'll fix them in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "remove unused deps and dead files, add zustand and topojson"
```

---

### Task 2: Type Definitions

**Files:**
- Create: `src/app/types/trace.ts`
- Create: `src/app/types/geo.ts` (new file, same path, completely different content)

- [ ] **Step 1: Create trace data types**

Create `src/app/types/trace.ts`:

```typescript
export interface HopLocation {
  city: string
  region: string
  country: string
  country_code: string
  lat: number
  lon: number
}

export interface Hop {
  hop: number
  ip: string
  hostname: string
  rtt: (number | null)[]
  location: HopLocation | null
  org: string | null
  asn: string | null
}

export interface TargetInfo {
  ip: string
  hostname: string
  city: string
  region: string
  country: string
  lat: number
  lon: number
  org: string
}

export interface TraceSummary {
  totalHops: number
  respondingHops: number
  countries: number
  averageRtt: number
}

export interface HistoryEntry {
  input: string
  target: TargetInfo | null
  timestamp: number
  hopCount: number
}

export type TraceStatus = 'idle' | 'tracing' | 'complete' | 'error'
```

- [ ] **Step 2: Create minimal geo types**

Create `src/app/types/geo.ts` (replaces old file — only keep types still needed by Sun.tsx, Moon.tsx):

```typescript
export interface SunProps {
  position?: [number, number, number]
  intensity?: number
  radius?: number
  color?: string | number
  enableOrbit?: boolean
  orbitRadius?: number
  orbitSpeed?: number
  orbitHeight?: number
}

export interface MoonProps {
  position?: [number, number, number]
  intensity?: number
  radius?: number
  color?: string | number
  enableOrbit?: boolean
  orbitRadius?: number
  orbitSpeed?: number
  orbitTilt?: number
}
```

These match the actual prop usage in `Sun.tsx` (uses `orbitHeight`, defaults to `10`) and `Moon.tsx` (uses `orbitTilt`, defaults to `0.089`). With these complete interfaces, Sun.tsx and Moon.tsx can drop their inline intersection type extensions and use these directly.

- [ ] **Step 3: Commit**

```bash
git add src/app/types/trace.ts src/app/types/geo.ts
git commit -m "add trace data types and simplify geo types"
```

---

### Task 3: Zustand Store

**Files:**
- Create: `src/app/store/traceStore.ts`

- [ ] **Step 1: Create the store**

Create `src/app/store/traceStore.ts`:

```typescript
import { create } from 'zustand'
import type { Hop, TargetInfo, TraceSummary, TraceStatus, HistoryEntry } from '../types/trace'

interface TraceStore {
  // Trace data
  status: TraceStatus
  traceInput: string  // raw user input, persisted for history
  target: TargetInfo | null
  hops: Hop[]
  summary: TraceSummary | null
  error: string | null

  // UI state
  selectedHopIndex: number | null
  hoveredHopIndex: number | null
  isReplaying: boolean
  panelVisibility: { target: boolean; hops: boolean; stats: boolean }

  // History
  searchHistory: HistoryEntry[]

  // Actions
  startTrace: (input: string) => void
  addHop: (hop: Hop) => void
  setTarget: (target: TargetInfo) => void
  completeTrace: (summary: TraceSummary) => void
  failTrace: (error: string) => void
  selectHop: (index: number | null) => void
  hoverHop: (index: number | null) => void
  clearTrace: () => void
}

const MAX_HISTORY = 20

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('trace-history')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(history: HistoryEntry[]) {
  try {
    localStorage.setItem('trace-history', JSON.stringify(history))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export const useTraceStore = create<TraceStore>((set, get) => ({
  status: 'idle',
  traceInput: '',
  target: null,
  hops: [],
  summary: null,
  error: null,
  selectedHopIndex: null,
  hoveredHopIndex: null,
  isReplaying: false,
  panelVisibility: { target: true, hops: true, stats: true },
  searchHistory: loadHistory(),

  startTrace: (input: string) =>
    set({
      status: 'tracing',
      traceInput: input,
      target: null,
      hops: [],
      summary: null,
      error: null,
      selectedHopIndex: null,
      hoveredHopIndex: null,
      isReplaying: false,
    }),

  addHop: (hop: Hop) =>
    set((state) => ({ hops: [...state.hops, hop] })),

  setTarget: (target: TargetInfo) =>
    set({ target }),

  completeTrace: (summary: TraceSummary) => {
    const { traceInput, target, hops } = get()
    const entry: HistoryEntry = {
      input: traceInput,
      target,
      timestamp: Date.now(),
      hopCount: hops.length,
    }
    const history = [entry, ...get().searchHistory.filter(h => h.input !== traceInput)].slice(0, MAX_HISTORY)
    saveHistory(history)
    set({ status: 'complete', summary, searchHistory: history })
  },

  failTrace: (error: string) =>
    set({ status: 'error', error }),

  selectHop: (index: number | null) =>
    set({ selectedHopIndex: index }),

  hoverHop: (index: number | null) =>
    set({ hoveredHopIndex: index }),

  clearTrace: () =>
    set({
      status: 'idle',
      traceInput: '',
      target: null,
      hops: [],
      summary: null,
      error: null,
      selectedHopIndex: null,
      hoveredHopIndex: null,
      isReplaying: false,
    }),
}))
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Store should compile. Build will still fail on components referencing deleted files — that's expected.

- [ ] **Step 3: Commit**

```bash
git add src/app/store/traceStore.ts
git commit -m "add zustand trace store with history persistence"
```

---

### Task 4: Shared Geo Utility + Rewrite Countries.tsx & States.tsx

**Files:**
- Create: `src/app/utils/geoMath.ts`
- Rewrite: `src/app/components/Countries.tsx`
- Rewrite: `src/app/components/States.tsx`

- [ ] **Step 1: Create shared geo math utility**

Create `src/app/utils/geoMath.ts` — shared coordinate conversion used by Countries, States, HopMarkers, and RouteArcs:

```typescript
import * as THREE from 'three'

/** Radius used for elements placed on the globe surface (slightly above Earth's radius of 2) */
export const EARTH_RADIUS = 2.01

/**
 * Convert latitude/longitude to a 3D position on a sphere.
 * Used by country borders, state borders, hop markers, and route arcs.
 */
export function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

/**
 * Build a single merged BufferGeometry from GeoJSON polygon rings.
 * Each ring is converted to line segments on the sphere surface.
 */
export function buildBorderGeometryFromFeatures(
  features: any[],
  radius: number
): THREE.BufferGeometry {
  const positions: number[] = []

  for (const feature of features) {
    const geom = feature.geometry
    const rings: number[][][] =
      geom.type === 'Polygon'
        ? geom.coordinates
        : geom.type === 'MultiPolygon'
          ? geom.coordinates.flat()
          : []

    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = latLonToVec3(ring[i][1], ring[i][0], radius)
        const b = latLonToVec3(ring[i + 1][1], ring[i + 1][0], radius)
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}
```

Note: `latLonToVec3` takes `(lat, lon)` order (geographic convention). The GeoJSON coordinate arrays are `[lon, lat]`, so callers pass `ring[i][1], ring[i][0]`.

- [ ] **Step 2: Rewrite Countries.tsx**

The new Countries.tsx uses `world-atlas` TopoJSON instead of the 14.6 MB GeoJSON. All line segments are merged into a single BufferGeometry for one draw call.

Replace `src/app/components/Countries.tsx` entirely:

```typescript
import React, { useMemo } from 'react'
import * as topojson from 'topojson-client'
// @ts-expect-error — world-atlas has no type declarations
import worldData from 'world-atlas/countries-50m.json'
import { buildBorderGeometryFromFeatures } from '../utils/geoMath'

interface CountriesProps {
  radius?: number
  color?: string
}

export const Countries: React.FC<CountriesProps> = ({
  radius = 2.01,
  color = '#ffffff',
}) => {
  const geometry = useMemo(() => {
    const topology = worldData as any
    const geojson = topojson.feature(topology, topology.objects.countries) as any
    return buildBorderGeometryFromFeatures(geojson.features, radius)
  }, [radius])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.4} />
    </lineSegments>
  )
}
```

Key changes from old version:
- Import from `world-atlas/countries-50m.json` (~700 KB) instead of local 14.6 MB file
- Uses `topojson-client` to convert to GeoJSON at runtime
- Shared `buildBorderGeometryFromFeatures` from `utils/geoMath.ts` — same function used by States.tsx, avoids duplication
- All border segments merged into ONE `BufferGeometry` — single draw call
- No more `Line2` per feature, no more `drawThreeGeo` utility
- `useMemo` ensures geometry is built once
- No animation (dash offset was cosmetic — removed for performance)

- [ ] **Step 2: Rewrite States.tsx**

Replace `src/app/components/States.tsx` entirely. This uses the existing 445 KB GeoJSON (small enough, not worth converting):

```typescript
import React, { useMemo } from 'react'
import statesData from '../../../public/geo_json/countries_states.json'
import { buildBorderGeometryFromFeatures } from '../utils/geoMath'

interface StatesProps {
  radius?: number
  color?: string
}

export const States: React.FC<StatesProps> = ({
  radius = 2.01,
  color = '#ffffff',
}) => {
  const geometry = useMemo(() => {
    const geojson = statesData as any
    return buildBorderGeometryFromFeatures(geojson.features, radius)
  }, [radius])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.15} />
    </lineSegments>
  )
}
```

**Note on States data source:** The spec says to delete `countries_states.json` and use TopoJSON for both. We deliberately keep the existing 445 KB GeoJSON for states — it's small enough that converting to TopoJSON adds complexity without meaningful benefit. The rendering optimization (merged BufferGeometry via `buildBorderGeometryFromFeatures`) delivers the same performance gain regardless of source format.

- [ ] **Step 3: Verify Countries and States render**

```bash
npm run dev
```

Open `http://localhost:3000`. The globe should show country and state borders as before, but loading should be noticeably faster (no 14.6 MB fetch). Borders will be static (no dash animation) — this is intentional.

- [ ] **Step 4: Commit**

```bash
git add src/app/utils/geoMath.ts src/app/components/Countries.tsx src/app/components/States.tsx
git commit -m "rewrite countries/states with topojson and merged buffergeometry"
```

---

### Task 5: Improve Earth.tsx

**Files:**
- Modify: `src/app/components/Earth.tsx`

- [ ] **Step 1: Fix texture loading**

The current Earth.tsx creates a `new TextureLoader().load(...)` on every render (not memoized). Fix this by using `useLoader` from R3F:

```typescript
import React, { useRef } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'

export const Earth = () => {
  const earthRef = useRef<THREE.Mesh>(null)
  const earthTexture = useLoader(THREE.TextureLoader, 'textures/2k_earth_daymap.jpg')

  return (
    <group>
      {/* earth sphere */}
      <mesh ref={earthRef} castShadow receiveShadow>
        <sphereGeometry args={[2, 128, 128]} />
        <meshPhongMaterial
          map={earthTexture}
          bumpMap={earthTexture}
          bumpScale={0.02}
          specular={new THREE.Color('#101010')}
          shininess={5}
          emissive={new THREE.Color('#112244')}
          emissiveIntensity={0.02}
        />
      </mesh>

      {/* cloud */}
      <mesh>
        <sphereGeometry args={[2.003, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.2}
          roughness={1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>

      {/* atmospheric glow */}
      <mesh scale={[1.08, 1.08, 1.08]}>
        <sphereGeometry args={[2, 64, 64]} />
        <shaderMaterial
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
              float intensity = pow(0.7 - dot(vNormal, vPositionNormal), 2.5);
              vec3 atmosphere = vec3(0.3, 0.6, 1.0) * intensity;
              gl_FragColor = vec4(atmosphere, intensity * 0.8);
            }
          `}
        />
      </mesh>
    </group>
  )
}
```

The only change: replace `new THREE.TextureLoader().load(...)` with `useLoader(THREE.TextureLoader, ...)`. This memoizes the texture and integrates with React Suspense.

- [ ] **Step 2: Verify Earth renders**

```bash
npm run dev
```

Globe should look identical. Check browser console for no texture loading warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/Earth.tsx
git commit -m "fix earth texture loading with useLoader memoization"
```

---

## Chunk 2: API & Data Pipeline

### Task 6: Rewrite Traceroute API as SSE

**Files:**
- Rewrite: `src/app/api/trace/route.ts`

- [ ] **Step 1: Rewrite the API endpoint**

Replace `src/app/api/trace/route.ts` entirely. Changes: POST → GET, exec → spawn, batch response → SSE stream, expanded input validation, full RFC 1918 private IP detection.

```typescript
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

async function geolocateIP(ip: string): Promise<any> {
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
      const send = (event: string, data: any) => {
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
```

Key changes from the old endpoint:
- **POST → GET** with `target` query param
- **exec → spawn** for line-by-line streaming
- **Batch → SSE** — each hop emitted as it resolves
- **Input validation** — strict character allowlist, length limit
- **Private IP detection** — full RFC 1918 + loopback + link-local
- **Geolocation per-hop** — naturally rate-limited by sequential arrival

- [ ] **Step 2: Verify SSE stream works**

```bash
npm run dev
```

Test with curl:
```bash
curl -N "http://localhost:3000/api/trace?target=8.8.8.8"
```

Expected: SSE events streaming one by one, ending with `event: summary` and `event: done`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/trace/route.ts
git commit -m "rewrite traceroute api as sse streaming endpoint"
```

---

### Task 7: useTrace Hook

**Files:**
- Create: `src/app/hooks/useTrace.ts`

- [ ] **Step 1: Create the SSE client hook**

Create `src/app/hooks/useTrace.ts`:

```typescript
import { useCallback, useRef } from 'react'
import { useTraceStore } from '../store/traceStore'
import type { Hop, TargetInfo, TraceSummary } from '../types/trace'

async function consumeSSEStream(
  url: string,
  signal: AbortSignal,
  handlers: {
    onHop: (hop: Hop) => void
    onTarget: (target: TargetInfo) => void
    onSummary: (summary: TraceSummary) => void
    onError: (msg: string) => void
  }
): Promise<void> {
  const res = await fetch(url, { signal })

  if (!res.ok) {
    const err = await res.json()
    handlers.onError(err.error || 'Request failed')
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    handlers.onError('No response stream')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const messages = buffer.split('\n\n')
    buffer = messages.pop() || ''

    for (const msg of messages) {
      const eventMatch = msg.match(/^event:\s*(.+)$/m)
      const dataMatch = msg.match(/^data:\s*(.+)$/m)
      if (!eventMatch || !dataMatch) continue

      const event = eventMatch[1].trim()
      const data = JSON.parse(dataMatch[1])

      switch (event) {
        case 'hop':
          handlers.onHop(data as Hop)
          break
        case 'target':
          handlers.onTarget(data as TargetInfo)
          break
        case 'summary':
          handlers.onSummary(data as TraceSummary)
          break
        case 'error':
          handlers.onError(data.message || 'Unknown error')
          break
      }
    }
  }
}

export function useTrace() {
  const status = useTraceStore((s) => s.status)
  const startTrace = useTraceStore((s) => s.startTrace)
  const addHop = useTraceStore((s) => s.addHop)
  const setTarget = useTraceStore((s) => s.setTarget)
  const completeTrace = useTraceStore((s) => s.completeTrace)
  const failTrace = useTraceStore((s) => s.failTrace)
  const abortRef = useRef<AbortController | null>(null)

  const trace = useCallback(async (input: string) => {
    // Abort any in-progress trace
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    startTrace(input)

    const url = `/api/trace?target=${encodeURIComponent(input)}`
    const handlers = {
      onHop: addHop,
      onTarget: setTarget,
      onSummary: completeTrace,
      onError: failTrace,
    }

    try {
      await consumeSSEStream(url, controller.signal, handlers)
    } catch (err: any) {
      if (err.name === 'AbortError') return

      // Retry once on connection failure (spec: retry once then show error)
      try {
        const retryController = new AbortController()
        abortRef.current = retryController
        await consumeSSEStream(url, retryController.signal, handlers)
      } catch (retryErr: any) {
        if (retryErr.name !== 'AbortError') {
          failTrace(retryErr.message || 'Connection failed after retry')
        }
      }
    }
  }, [startTrace, addHop, setTarget, completeTrace, failTrace])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { trace, abort, isTracing: status === 'tracing' }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/hooks/useTrace.ts
git commit -m "add useTrace hook for sse stream consumption"
```

---

### Task 8: Error Boundary

**Files:**
- Create: `src/app/components/SceneErrorBoundary.tsx`

- [ ] **Step 1: Create error boundary**

Create `src/app/components/SceneErrorBoundary.tsx`:

```typescript
import React, { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class SceneErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('3D Scene crashed:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center">
            <p className="text-white/60 text-lg">3D visualization unavailable</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 text-orange-400 hover:text-orange-300 text-sm underline"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

- [ ] **Step 2: Verify error boundary compiles and will integrate**

```bash
npm run build
```

The error boundary is a class component that wraps children. It will be used in `page.tsx` (Task 13) to wrap `<Scene />`. For now, verify the file compiles with no TypeScript errors. Visual testing (simulating a WebGL crash) will happen during integration in Task 13.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/SceneErrorBoundary.tsx
git commit -m "add error boundary for 3d scene"
```

---

## Chunk 3: HUD Components & 3D Visualization

### Task 9: SearchBar Component

**Files:**
- Create: `src/app/components/SearchBar.tsx`

- [ ] **Step 1: Create SearchBar**

Create `src/app/components/SearchBar.tsx`:

```tsx
'use client'

import React, { useState, type FormEvent } from 'react'
import { useTrace } from '../hooks/useTrace'
import { useTraceStore } from '../store/traceStore'

export const SearchBar: React.FC = () => {
  const [input, setInput] = useState('')
  const { trace, abort, isTracing } = useTrace()
  const status = useTraceStore((s) => s.status)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return

    if (isTracing) {
      abort()
    } else {
      trace(trimmed)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-0 rounded-full overflow-hidden border border-orange-500/40 bg-black/60 backdrop-blur-md max-w-lg w-full mx-auto"
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter IP or domain..."
        className="flex-1 bg-transparent text-white placeholder-gray-500 px-5 py-3 text-sm focus:outline-none"
      />
      <button
        type="submit"
        className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
          isTracing
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-orange-500 hover:bg-orange-600 text-black'
        }`}
      >
        {isTracing ? 'STOP' : 'TRACE'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/SearchBar.tsx
git commit -m "add searchbar component with trace/abort support"
```

---

### Task 10: HUD Panels

**Files:**
- Create: `src/app/components/hud/TargetPanel.tsx`
- Create: `src/app/components/hud/StatsPanel.tsx`
- Create: `src/app/components/hud/HopList.tsx`
- Create: `src/app/components/hud/CommandBar.tsx`
- Create: `src/app/components/HUD.tsx`

- [ ] **Step 1: Create TargetPanel**

Create `src/app/components/hud/TargetPanel.tsx`:

```tsx
'use client'

import React from 'react'
import { useTraceStore } from '../../store/traceStore'

export const TargetPanel: React.FC = () => {
  const target = useTraceStore((s) => s.target)
  const status = useTraceStore((s) => s.status)

  if (status === 'idle') return null

  return (
    <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/15 rounded-md p-3 mb-2">
      <div className="text-[10px] text-orange-400 uppercase tracking-widest mb-2 border-b border-orange-400/20 pb-1">
        Target
      </div>
      {target ? (
        <>
          <div className="text-white text-sm font-mono">{target.ip}</div>
          <div className="text-gray-400 text-xs">{target.hostname}</div>
          <div className="text-gray-500 text-xs mt-1">
            {target.city}, {target.country}
          </div>
          {target.org && (
            <div className="text-gray-600 text-[10px] mt-0.5">{target.org}</div>
          )}
        </>
      ) : (
        <div className="text-gray-600 text-xs">Resolving...</div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create StatsPanel**

Create `src/app/components/hud/StatsPanel.tsx`:

```tsx
'use client'

import React from 'react'
import { useTraceStore } from '../../store/traceStore'

export const StatsPanel: React.FC = () => {
  const summary = useTraceStore((s) => s.summary)
  const hops = useTraceStore((s) => s.hops)
  const status = useTraceStore((s) => s.status)

  if (status === 'idle') return null

  const stats = summary || {
    totalHops: hops.length,
    respondingHops: hops.filter((h) => h.ip !== '*').length,
    countries: new Set(hops.filter((h) => h.location?.country_code).map((h) => h.location!.country_code)).size,
    averageRtt: 0,
  }

  return (
    <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/15 rounded-md p-3">
      <div className="text-[10px] text-orange-400 uppercase tracking-widest mb-2 border-b border-orange-400/20 pb-1">
        Stats
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-gray-600 text-[10px]">Hops</div>
          <div className="text-cyan-400 font-mono">{stats.totalHops}</div>
        </div>
        <div>
          <div className="text-gray-600 text-[10px]">Responding</div>
          <div className="text-cyan-400 font-mono">{stats.respondingHops}</div>
        </div>
        <div>
          <div className="text-gray-600 text-[10px]">Countries</div>
          <div className="text-orange-400 font-mono">{stats.countries}</div>
        </div>
        <div>
          <div className="text-gray-600 text-[10px]">Avg RTT</div>
          <div className="text-green-400 font-mono">
            {stats.averageRtt > 0 ? `${stats.averageRtt}ms` : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create HopList**

Create `src/app/components/hud/HopList.tsx`:

```tsx
'use client'

import React from 'react'
import { useTraceStore } from '../../store/traceStore'

function rttColor(rtt: number | null): string {
  if (rtt === null) return 'text-gray-600'
  if (rtt < 20) return 'text-green-400'
  if (rtt <= 100) return 'text-yellow-400'
  return 'text-red-400'
}

function avgRtt(rtts: (number | null)[]): number | null {
  const valid = rtts.filter((r): r is number => r !== null)
  if (valid.length === 0) return null
  return Math.round(valid.reduce((s, r) => s + r, 0) / valid.length)
}

export const HopList: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)
  const status = useTraceStore((s) => s.status)
  const selectedHopIndex = useTraceStore((s) => s.selectedHopIndex)
  const selectHop = useTraceStore((s) => s.selectHop)

  if (status === 'idle') return null

  return (
    <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/15 rounded-md p-3 max-h-[60vh] overflow-y-auto">
      <div className="text-[10px] text-orange-400 uppercase tracking-widest mb-2 border-b border-orange-400/20 pb-1">
        Route Hops
      </div>
      <div className="space-y-1">
        {hops.map((hop, i) => {
          const avg = avgRtt(hop.rtt)
          const isSelected = selectedHopIndex === i
          return (
            <button
              key={i}
              onClick={() => selectHop(isSelected ? null : i)}
              className={`w-full flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors ${
                isSelected
                  ? 'bg-orange-500/15 border border-orange-500/30'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-gray-600 font-mono w-4 text-right shrink-0">
                  {hop.hop}
                </span>
                <span className="text-gray-300 truncate font-mono">
                  {hop.ip === '*' ? '* * *' : hop.ip}
                </span>
              </div>
              <span className={`font-mono shrink-0 ml-2 ${rttColor(avg)}`}>
                {avg !== null ? `${avg}ms` : '—'}
              </span>
            </button>
          )
        })}
        {status === 'tracing' && (
          <div className="text-gray-600 text-[10px] text-center py-1 animate-pulse">
            Tracing...
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create CommandBar**

Create `src/app/components/hud/CommandBar.tsx`:

```tsx
'use client'

import React from 'react'
import { useTraceStore } from '../../store/traceStore'

export const CommandBar: React.FC = () => {
  const status = useTraceStore((s) => s.status)
  const error = useTraceStore((s) => s.error)
  const hops = useTraceStore((s) => s.hops)
  const clearTrace = useTraceStore((s) => s.clearTrace)

  const statusText = {
    idle: 'READY',
    tracing: `TRACING — ${hops.length} hops`,
    complete: 'TRACE COMPLETE',
    error: `ERROR: ${error}`,
  }[status]

  const statusColor = {
    idle: 'text-gray-600',
    tracing: 'text-cyan-400 animate-pulse',
    complete: 'text-green-400',
    error: 'text-red-400',
  }[status]

  return (
    <div className="bg-black/60 backdrop-blur-sm border-t border-cyan-500/10 flex items-center px-4 h-8 gap-4">
      <span className={`text-[10px] font-mono ${statusColor}`}>
        {statusText}
      </span>
      {status === 'complete' && (
        <button
          onClick={clearTrace}
          className="text-[10px] text-gray-500 hover:text-gray-300 font-mono transition-colors"
        >
          CLEAR
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create HUD container**

Create `src/app/components/HUD.tsx`:

```tsx
'use client'

import React from 'react'
import { SearchBar } from './SearchBar'
import { TargetPanel } from './hud/TargetPanel'
import { StatsPanel } from './hud/StatsPanel'
import { HopList } from './hud/HopList'
import { CommandBar } from './hud/CommandBar'

export const HUD: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col">
      {/* Top: SearchBar */}
      <div className="pointer-events-auto pt-6 px-4 flex justify-center">
        <SearchBar />
      </div>

      {/* Middle: Side panels */}
      <div className="flex-1 flex justify-between items-start px-4 pt-4 min-h-0">
        {/* Left panels */}
        <div className="pointer-events-auto w-56 space-y-2">
          <TargetPanel />
          <StatsPanel />
        </div>

        {/* Right panel */}
        <div className="pointer-events-auto w-56">
          <HopList />
        </div>
      </div>

      {/* Bottom: CommandBar */}
      <div className="pointer-events-auto">
        <CommandBar />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/components/hud/ src/app/components/HUD.tsx
git commit -m "add hud panels: target, stats, hoplist, commandbar"
```

---

### Task 11: HopMarkers (3D)

**Files:**
- Create: `src/app/components/HopMarkers.tsx`

- [ ] **Step 1: Create HopMarkers**

Create `src/app/components/HopMarkers.tsx`. Places glowing spheres on the globe at each hop's geolocation:

```tsx
'use client'

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTraceStore } from '../store/traceStore'
import { latLonToVec3, EARTH_RADIUS } from '../utils/geoMath'

// Reused across frames to avoid GC pressure
const _dummy = new THREE.Object3D()

export const HopMarkers: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)
  const selectedHopIndex = useTraceStore((s) => s.selectedHopIndex)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const geoHops = useMemo(
    () => hops.filter((h) => h.location && h.location.lat !== 0 && h.location.lon !== 0),
    [hops]
  )

  const positions = useMemo(
    () => geoHops.map((h) => latLonToVec3(h.location!.lat, h.location!.lon, EARTH_RADIUS)),
    [geoHops]
  )

  // Update instance matrices
  useFrame(() => {
    if (!meshRef.current) return

    for (let i = 0; i < positions.length; i++) {
      _dummy.position.copy(positions[i])
      const isSelected = hops.indexOf(geoHops[i]) === selectedHopIndex
      const scale = isSelected ? 0.06 : 0.035
      _dummy.scale.setScalar(scale)
      _dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, _dummy.matrix)
    }
    meshRef.current.count = positions.length
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  if (geoHops.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 30]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color="#ff8c00" transparent opacity={0.9} />
    </instancedMesh>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/HopMarkers.tsx
git commit -m "add instanced hop markers on globe"
```

---

### Task 12: RouteArcs (3D)

**Files:**
- Create: `src/app/components/RouteArcs.tsx`

- [ ] **Step 1: Create RouteArcs**

Create `src/app/components/RouteArcs.tsx`. Draws great-circle arcs between sequential hops:

```tsx
'use client'

import React, { useMemo } from 'react'
import * as THREE from 'three'
import { useTraceStore } from '../store/traceStore'
import { latLonToVec3, EARTH_RADIUS } from '../utils/geoMath'

function greatCircleArc(
  start: THREE.Vector3,
  end: THREE.Vector3,
  segments: number,
  altitude: number
): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  const startNorm = start.clone().normalize()
  const endNorm = end.clone().normalize()
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    // Pseudo-SLERP: lerp unit vectors then re-normalize for uniform arc spacing
    const point = startNorm.clone().lerp(endNorm, t).normalize()
    // Add altitude curve (parabolic bulge)
    const bulge = 1 + altitude * Math.sin(Math.PI * t)
    point.multiplyScalar(EARTH_RADIUS * bulge)
    points.push(point)
  }
  return points
}

export const RouteArcs: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)

  const arcs = useMemo(() => {
    const geoHops = hops.filter(
      (h) => h.location && h.location.lat !== 0 && h.location.lon !== 0
    )
    if (geoHops.length < 2) return []

    const result: THREE.Vector3[][] = []
    for (let i = 0; i < geoHops.length - 1; i++) {
      const a = geoHops[i].location!
      const b = geoHops[i + 1].location!
      const start = latLonToVec3(a.lat, a.lon, EARTH_RADIUS)
      const end = latLonToVec3(b.lat, b.lon, EARTH_RADIUS)
      const dist = start.distanceTo(end)
      const altitude = Math.min(dist * 0.15, 0.3)
      result.push(greatCircleArc(start, end, 64, altitude))
    }
    return result
  }, [hops])

  if (arcs.length === 0) return null

  return (
    <group>
      {arcs.map((points, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ff8c00" transparent opacity={0.6} />
        </line>
      ))}
    </group>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/RouteArcs.tsx
git commit -m "add great-circle route arcs between hops"
```

---

### Task 13: Integration — Scene.tsx & page.tsx

**Files:**
- Modify: `src/app/components/Scene.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update Scene.tsx**

Add HopMarkers and RouteArcs as children inside the Canvas. Update to:

```typescript
'use client'
import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import { Stars } from './Stars'
import { Countries } from './Countries'
import { States } from './States'
import { Sun } from './Sun'
import { Moon } from './Moon'
import { Earth } from './Earth'
import { HopMarkers } from './HopMarkers'
import { RouteArcs } from './RouteArcs'

const Scene: React.FC = () => {
  return (
    <Canvas camera={{ position: [20, 15, 20], fov: 60 }}>
      <Suspense fallback={null}>
        <Sun
          intensity={2}
          radius={5}
          enableOrbit={true}
          orbitRadius={50}
          orbitSpeed={0.02}
        />

        <Moon
          intensity={0.3}
          radius={0.54}
          enableOrbit={true}
          orbitRadius={8}
          orbitSpeed={0.1}
          orbitTilt={0.089}
        />
        <ambientLight intensity={0.1} />

        <Earth />
        <Countries />
        <States />
        <HopMarkers />
        <RouteArcs />

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          target={[0, 0, 0]}
          maxDistance={100}
          minDistance={5}
        />

        <Stars />
        <color attach="background" args={['#000000']} />
      </Suspense>
    </Canvas>
  )
}

export default Scene
```

Key changes: Added `Suspense` wrapper (required for `useLoader` in Earth.tsx), imported and rendered `HopMarkers` and `RouteArcs`.

- [ ] **Step 2: Update page.tsx**

Replace the IPTracker overlay with the HUD:

```typescript
'use client'
import React from 'react'

import Scene from './components/Scene'
import { HUD } from './components/HUD'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'

export default function Home() {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Canvas background */}
      <div className="absolute inset-0">
        <SceneErrorBoundary>
          <Scene />
        </SceneErrorBoundary>
      </div>

      {/* HUD overlay */}
      <HUD />
    </div>
  )
}
```

- [ ] **Step 3: Verify full integration**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:
1. Globe renders with country/state borders
2. SearchBar appears top-center as a pill
3. Type `8.8.8.8` and click TRACE
4. Hops appear in real-time in the right panel
5. Orange markers appear on the globe at hop locations
6. Orange arcs connect the markers
7. Left panels show target info and stats
8. Bottom command bar shows trace status
9. "CLEAR" button resets everything

- [ ] **Step 4: Verify build succeeds**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/Scene.tsx src/app/page.tsx
git commit -m "integrate hud, hop markers, and route arcs into scene and page"
```

---

## Phase 1 Exit Criteria

After all tasks are complete, verify the full end-to-end flow:

1. App loads with the 3D globe, country/state borders, sun, moon, stars — noticeably faster than before (no 14.6 MB GeoJSON load)
2. SearchBar accepts an IP or domain
3. Hops stream in real-time into the HopList panel
4. Markers appear on the globe at each geolocated hop
5. Arcs connect sequential hop markers
6. TargetPanel shows the resolved target info
7. StatsPanel shows hop count, responding hops, countries, avg RTT
8. CommandBar shows trace status and CLEAR button
9. Error boundary catches 3D scene crashes
10. Trace history persists in localStorage

**Next:** Plan Phase 2 (cinematic camera animations, animated arc drawing, pulse effects, rendering optimization).
