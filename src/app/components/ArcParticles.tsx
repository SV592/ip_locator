'use client'

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTraceStore } from '../store/traceStore'
import { perfThrottle } from './PerfMonitor'
import { latLonToVec3, EARTH_RADIUS } from '../utils/geoMath'

const PARTICLES_PER_ARC = 3
const PARTICLE_SPEED = 0.4 // full arc traversal time in seconds

function greatCirclePoints(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  segments: number
): THREE.Vector3[] {
  const start = latLonToVec3(startLat, startLon, EARTH_RADIUS)
  const end = latLonToVec3(endLat, endLon, EARTH_RADIUS)
  const dist = start.distanceTo(end)
  const altitude = Math.min(dist * 0.15, 0.3)

  const startNorm = start.clone().normalize()
  const endNorm = end.clone().normalize()
  const points: THREE.Vector3[] = []

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const p = startNorm.clone().lerp(endNorm, t).normalize()
    const bulge = 1 + altitude * Math.sin(Math.PI * t)
    p.multiplyScalar(EARTH_RADIUS * bulge)
    points.push(p)
  }
  return points
}

export const ArcParticles: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)
  const status = useTraceStore((s) => s.status)
  const pointsRef = useRef<THREE.Points>(null)

  // Build arc path data
  const arcPaths = useMemo(() => {
    const geoHops = hops.filter(
      (h) => h.location && h.location.lat !== 0 && h.location.lon !== 0
    )
    if (geoHops.length < 2) return []

    const paths: THREE.Vector3[][] = []
    for (let i = 0; i < geoHops.length - 1; i++) {
      const a = geoHops[i].location!
      const b = geoHops[i + 1].location!
      paths.push(greatCirclePoints(a.lat, a.lon, b.lat, b.lon, 32))
    }
    return paths
  }, [hops])

  // Pre-allocate with fixed max size to avoid reallocation race conditions
  const MAX_PARTICLES = 30 * PARTICLES_PER_ARC // 30 max arcs × 3 particles
  const positionArray = useMemo(() => new Float32Array(MAX_PARTICLES * 3), [MAX_PARTICLES])

  useFrame((state) => {
    if (!pointsRef.current || arcPaths.length === 0) return
    // Skip particle updates when frame budget is tight
    if (perfThrottle.active) return

    const t = state.clock.elapsedTime

    let idx = 0
    for (let arcIdx = 0; arcIdx < arcPaths.length; arcIdx++) {
      const path = arcPaths[arcIdx]
      for (let p = 0; p < PARTICLES_PER_ARC; p++) {
        // Offset each particle along the arc
        const phase = (t * PARTICLE_SPEED + p / PARTICLES_PER_ARC + arcIdx * 0.17) % 1
        const pathIdx = Math.floor(phase * (path.length - 1))
        const frac = phase * (path.length - 1) - pathIdx
        const nextIdx = Math.min(pathIdx + 1, path.length - 1)

        // Lerp between path points
        const x = path[pathIdx].x + (path[nextIdx].x - path[pathIdx].x) * frac
        const y = path[pathIdx].y + (path[nextIdx].y - path[pathIdx].y) * frac
        const z = path[pathIdx].z + (path[nextIdx].z - path[pathIdx].z) * frac

        positionArray[idx * 3] = x
        positionArray[idx * 3 + 1] = y
        positionArray[idx * 3 + 2] = z
        idx++
      }
    }

    const geom = pointsRef.current.geometry
    geom.setDrawRange(0, idx) // only render active particles
    const attr = geom.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true
  })

  if (arcPaths.length === 0 || status === 'idle') return null

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positionArray, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffcc44"
        size={3}
        sizeAttenuation={false}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
