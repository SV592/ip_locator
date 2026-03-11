# IP Locator Overhaul — Design Spec

## Summary

Comprehensive overhaul of the IP Locator app: complete the traceroute visualization with cinematic camera animations and interactive exploration, optimize performance (GeoJSON, rendering, streaming), redesign the UI as a sci-fi mission-control HUD, and add a graceful mobile fallback.

Three interleaved phases, each a shippable milestone.

## Current State

- **Framework:** Next.js 15.5 + React 19 + Three.js via React-Three-Fiber
- **3D scene:** Earth globe with country/state borders (GeoJSON), orbiting sun/moon, starfield
- **API:** POST `/api/trace` — runs OS traceroute, enriches hops with ipapi.co geolocation
- **UI:** Single IPTracker input component, glass-morphism card floating over the globe
- **Problems:**
  - 14.6 MB countries.json loaded entirely on mount
  - Hop.tsx exists but is not wired up — no visualization of trace results
  - No streaming — user waits up to 30s for full traceroute to complete
  - No error boundaries, loading states, or mobile support
  - Hundreds of individual Line2 objects for country borders (inefficient)
  - No shared state — components can't communicate

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| HUD layout | Dual sidebar (symmetric) | Target/stats on left, hop list on right, command bar at bottom. "Mission control" aesthetic matches the space theme. |
| Visual style | Immersive sci-fi HUD | Glass-morphism panels floating over full-screen globe. No layout shifts — panels overlay the 3D scene. |
| State management | Zustand | Lightweight, no boilerplate, works well with R3F's render loop. Single store for trace data, UI state, selection. |
| Traceroute streaming | Server-Sent Events (SSE) | Hops appear on globe in real-time as they resolve. Better UX than waiting 30s. |
| GeoJSON optimization | TopoJSON + merged BufferGeometry | Reduces payload from 14.6 MB to ~1.5 MB. Single draw call for all borders instead of hundreds of Line2 objects. Source: `world-atlas` npm package (pre-built Natural Earth TopoJSON). |
| Mobile strategy | Graceful degradation | Full 3D on desktop, 2D map fallback (Leaflet or static SVG) on mobile/weak devices. |
| Traceroute viz style | Accuracy + cinematic + interactive | Hop markers with geolocation, animated great-circle arcs, camera fly-through, click-to-navigate. |

## Architecture

### State Store (Zustand)

```typescript
interface TraceStore {
  // Trace data
  status: 'idle' | 'tracing' | 'complete' | 'error'
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
  completeTrace: (summary: TraceSummary) => void
  selectHop: (index: number | null) => void
  hoverHop: (index: number | null) => void
  startReplay: () => void
  clearTrace: () => void
}
```

### Data Flow

```
SearchBar (user input)
  → useTrace hook (SSE client)
    → /api/trace (SSE endpoint)
      → OS traceroute (spawned process, line-by-line parsing)
      → ipapi.co geolocation (per-hop enrichment)
    ← SSE events: hop | target | summary | error
  → Zustand store (single source of truth)
    → HUD panels (React, HTML overlay)
    → HopMarkers (R3F, instanced meshes on globe)
    → RouteArcs (R3F, animated great-circle lines)
    → CameraController (R3F, smooth fly-to on selection)
    → CommandBar (React, status + controls)
  → localStorage (search history persistence)
```

### API: SSE Streaming Traceroute

Rewrite `/api/trace/route.ts` from POST to GET using Server-Sent Events. This is a breaking change — the current POST endpoint is replaced entirely.

**Implementation:** Replace the current `execAsync` (buffered) approach with `child_process.spawn` for line-by-line stdout parsing. Each parsed hop is enriched with geolocation and emitted as an SSE event immediately.

**Input validation:** The `target` query parameter is passed to an OS shell command. Validate strictly:
- Allow only alphanumeric characters, dots, hyphens, and colons (for IPv6)
- Reject any shell metacharacters (`;&|$\`` etc.)
- Maximum length 253 characters (DNS limit)
- Validate IP format or valid hostname pattern before exec

**Private IP detection:** Full RFC 1918 + loopback coverage:
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `::1`, `fc00::/7`

```
GET /api/trace?target=8.8.8.8

event: hop
data: {"hop":1,"ip":"192.168.1.1","rtt":[1,1,1],"location":null}

event: hop
data: {"hop":2,"ip":"72.14.236.1","rtt":[12,11,13],"location":{"city":"Dallas","country":"US","lat":32.78,"lon":-96.8,"org":"Google LLC"}}

event: target
data: {"ip":"8.8.8.8","hostname":"dns.google","city":"Mountain View","country":"US","lat":37.386,"lon":-122.084,"org":"Google LLC"}

event: summary
data: {"totalHops":12,"respondingHops":10,"countries":3,"averageRtt":45.2}

event: done
data: {}
```

Client-side `useTrace` hook consumes the stream and dispatches to the store incrementally.

## Component Inventory

### New Components

**HUD Layer (HTML overlays, not inside R3F canvas):**

| Component | Purpose |
|-----------|---------|
| `HUD.tsx` | Container — positions all panels with absolute/fixed CSS over the canvas |
| `SearchBar.tsx` | Top-center pill input, replaces IPTracker. Triggers trace via store action. |
| `TargetPanel.tsx` | Left panel — shows target IP, hostname, city, country, org |
| `StatsPanel.tsx` | Left panel (below target) — hop count, avg RTT, country count |
| `HopList.tsx` | Right panel — scrollable list of hops. Click selects (drives camera). Color-coded by RTT. |
| `CommandBar.tsx` | Bottom bar — trace status indicator, replay button, history dropdown |

**3D Scene (R3F children inside Canvas):**

| Component | Purpose |
|-----------|---------|
| `HopMarkers.tsx` | Instanced glowing spheres placed at hop lat/lon on globe surface. Pulse animation on active hop. |
| `RouteArcs.tsx` | Great-circle arcs connecting sequential hops. Animated draw-in effect. Optional particle trail. |
| `CameraController.tsx` | Smooth camera fly-to when a hop is selected. Auto-tour mode for replay. Respects OrbitControls when idle. |
| `HopTooltip.tsx` | drei `<Html>` overlay on hover — shows IP, city, RTT inline on globe. |
| `PulseRing.tsx` | Expanding/fading ring effect at the currently active hop marker. |

**State & Hooks:**

| File | Purpose |
|------|---------|
| `store/traceStore.ts` | Zustand store — all shared state and actions |
| `hooks/useTrace.ts` | SSE client hook — connects to `/api/trace`, dispatches hops to store |

**Mobile Fallback:**

| Component | Purpose |
|-----------|---------|
| `DeviceGate.tsx` | Detects WebGL support and screen size. Routes to 3D (Scene) or 2D (MobileView). |
| `MobileView.tsx` | 2D Leaflet map with hop markers, card-based hop list, simplified UI. |

### Modified Components

| Component | Changes |
|-----------|---------|
| `Scene.tsx` | Add HopMarkers, RouteArcs, CameraController, PulseRing as children. Add error boundary wrapper. |
| `Earth.tsx` | Progressive texture loading (low-res placeholder → 2k). Error boundary. |
| `Countries.tsx` | Rewrite: load TopoJSON (~1.5 MB), convert with topojson-client, merge into single BufferGeometry. |
| `States.tsx` | Same TopoJSON optimization as Countries. |
| `page.tsx` | Integrate HUD overlay, DeviceGate, remove old IPTracker usage. |

### Replaced Components

| Old | New | Reason |
|-----|-----|--------|
| `IPTracker.tsx` | `SearchBar.tsx` | New design (pill shape, top-center), triggers store actions instead of local state |
| `Hop.tsx` | `HopList.tsx` + `HopMarkers.tsx` | Split HTML UI from 3D rendering — different layers, different update cycles |

## Phase Breakdown

### Phase 1: Foundation + Core Traceroute

**Performance foundation:**
- Replace countries.json (14.6 MB) with TopoJSON (~1.5 MB)
- Merge country border Line2 objects into single BufferGeometry
- Add React error boundary around 3D scene (fallback UI on WebGL crash)
- Add loading skeleton while scene initializes
- Progressive texture loading for Earth (low-res → full-res)

**Core traceroute visualization:**
- Implement Zustand store (`traceStore.ts`)
- Rewrite `/api/trace` as SSE streaming endpoint
- Build `useTrace` hook for SSE consumption
- Render hop markers on globe (glowing dots at geolocated positions)
- Draw great-circle arcs between sequential hops
- Build HUD: SearchBar, TargetPanel, StatsPanel, HopList, CommandBar
- Wire everything end-to-end: input → stream → store → globe + panels

**Exit criteria:** User can enter an IP, see hops appear on the globe in real-time with arcs connecting them, and browse hop details in the sidebar.

### Phase 2: Cinematic Viz + Full Optimization

**Cinematic features:**
- CameraController: smooth fly-to animation when selecting a hop
- Auto-tour replay: camera visits each hop sequentially with timed transitions
- Animated arc drawing: arcs trace in progressively (not instant)
- Pulse/ripple effect at each hop marker on arrival
- Particle trail along arcs (data-in-flight visualization)
- Globe auto-rotates to best viewing angle on trace start

**Rendering optimization:**
- Instanced rendering for hop markers (single draw call)
- Frustum culling for off-screen country borders
- RAF budget management — throttle non-critical animations under load
- Texture compression and atlas for celestial bodies
- Measure and optimize: target 60fps on mid-range hardware

**Exit criteria:** Traceroute playback feels cinematic. Camera smoothly flies between hops, arcs animate in, markers pulse. Performance is solid at 60fps.

### Phase 3: UX Polish + Mobile Fallback

**Interactive exploration:**
- Click hop in HopList → camera flies to that location on globe
- Hover hop marker on globe → HopTooltip with IP, city, RTT
- Search history in localStorage, accessible from CommandBar
- RTT color coding: green (<20ms), yellow (20-100ms), red (>100ms)
- Export: download trace data as JSON

**Mobile fallback:**
- DeviceGate: detect WebGL support via canvas test (`document.createElement('canvas').getContext('webgl')`) + screen width check (`< 768px`)
- MobileView architecture:
  - Top: SearchBar (full-width, touch-optimized, larger input)
  - Middle: Leaflet map (`react-leaflet`) with `CircleMarker` at each geolocated hop, polyline connecting them. Tile layer: CartoDB dark matter (matches theme). Map auto-fits bounds to show full route.
  - Bottom: Scrollable card list of hops. Each card shows: hop number, IP, city/country, RTT with color indicator. Tap card → map pans to that hop.
  - MobileView reads from the same Zustand store as desktop — no separate data path.
- Reduced data payloads: use 110m resolution TopoJSON for mobile (smaller than 50m), skip state borders entirely
- Touch-friendly SearchBar with `inputmode="url"` for appropriate mobile keyboard

**Exit criteria:** Desktop experience is polished and interactive. Mobile users get a functional, clean 2D experience. History persists across sessions.

## Error Handling

| Scenario | Handling |
|----------|----------|
| WebGL not supported | DeviceGate routes to MobileView |
| 3D scene crashes | Error boundary shows "Visualization unavailable" + falls back to data-only view |
| Texture load fails | Earth renders with flat color material, no crash |
| SSE connection drops | useTrace retries once, then shows error in CommandBar with retry button |
| Traceroute times out | API sends error event after 30s, UI shows partial results with timeout notice |
| ipapi.co rate limit | Hop renders without location data, marker placed at last known position |
| Invalid IP/domain | Validation in SearchBar + 400 from API, error shown inline |
| Private IP range | Hop shown in list as "Private network", no globe marker |

## Dependencies to Add

| Package | Purpose | Size Impact |
|---------|---------|-------------|
| `zustand` | State management | ~2 KB gzipped |
| `topojson-client` | TopoJSON → GeoJSON conversion | ~3 KB gzipped |
| `world-atlas` | Pre-built Natural Earth TopoJSON files (countries + states) | Build-time only, outputs static JSON |
| `leaflet` + `react-leaflet` | Mobile 2D map fallback | ~40 KB gzipped (only loaded on mobile) |

## Dependencies to Remove

| Package | Reason |
|---------|--------|
| `earcut` | No longer needed — TopoJSON borders don't require polygon triangulation |
| `three-geojson-geometry` | Replaced by direct TopoJSON → BufferGeometry conversion |

## Files to Delete

| File | Reason |
|------|--------|
| `public/geo_json/countries.json` | Replaced by TopoJSON file (~1.5 MB vs 14.6 MB) |
| `public/geo_json/countries_states.json` | Replaced by TopoJSON — states data included in new file |
| `src/app/components/IPTracker.tsx` | Replaced by SearchBar.tsx |
| `src/app/components/Hop.tsx` | Replaced by HopList.tsx + HopMarkers.tsx |
| `src/app/utils/threeGeoJSON.ts` | Replaced by direct TopoJSON → BufferGeometry conversion in Countries/States |
| `src/app/types/geo.ts` | Types replaced by new interfaces for TopoJSON and trace data |

## Out of Scope

- User authentication or accounts
- Server-side trace history persistence (database)
- Custom geolocation API (sticking with ipapi.co)
- Light theme / theme switching
- Automated testing (deferred to a follow-up spec)
- Deployment configuration
- Route comparison (multiple simultaneous traces) — potential follow-up feature
