'use client'

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTraceStore } from '../store/traceStore'
import { latLonToVec3, EARTH_RADIUS } from '../utils/geoMath'

const ARC_SEGMENTS = 64
const ARC_DRAW_DURATION = 600 // ms to fully draw one arc

function greatCircleArc(
  start: THREE.Vector3,
  end: THREE.Vector3,
  segments: number,
  altitude: number
): Float32Array {
  const positions = new Float32Array((segments + 1) * 3)
  const startNorm = start.clone().normalize()
  const endNorm = end.clone().normalize()
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const point = startNorm.clone().lerp(endNorm, t).normalize()
    const bulge = 1 + altitude * Math.sin(Math.PI * t)
    point.multiplyScalar(EARTH_RADIUS * bulge)
    positions[i * 3] = point.x
    positions[i * 3 + 1] = point.y
    positions[i * 3 + 2] = point.z
  }
  return positions
}

interface ArcData {
  positions: Float32Array
  startTime: number
}

const AnimatedArc: React.FC<{ arc: ArcData }> = ({ arc }) => {
  const lineRef = useRef<THREE.Line>(null!)  // threeLine maps to THREE.Line

  useFrame(() => {
    if (!lineRef.current) return
    const elapsed = Date.now() - arc.startTime
    const progress = Math.min(elapsed / ARC_DRAW_DURATION, 1)
    const count = Math.floor(progress * (ARC_SEGMENTS + 1))
    lineRef.current.geometry.setDrawRange(0, count)
  })

  return (
    <threeLine ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[arc.positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#ff8c00" transparent opacity={0.6} />
    </threeLine>
  )
}

export const RouteArcs: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)
  const arcsRef = useRef<ArcData[]>([])

  // Build arcs incrementally as hops arrive
  const arcs = useMemo(() => {
    // Reset when trace is cleared (prevents one-frame flash of old arcs)
    if (hops.length === 0) {
      arcsRef.current = []
      return []
    }

    const geoHops = hops.filter(
      (h) => h.location && h.location.lat !== 0 && h.location.lon !== 0
    )

    // Only build new arcs for newly arrived hops
    const newArcs: ArcData[] = [...arcsRef.current]

    // Number of arcs = geoHops.length - 1
    const targetArcCount = Math.max(0, geoHops.length - 1)

    while (newArcs.length < targetArcCount) {
      const i = newArcs.length
      const a = geoHops[i].location!
      const b = geoHops[i + 1].location!
      const start = latLonToVec3(a.lat, a.lon, EARTH_RADIUS)
      const end = latLonToVec3(b.lat, b.lon, EARTH_RADIUS)
      const dist = start.distanceTo(end)
      const altitude = Math.min(dist * 0.15, 0.3)

      newArcs.push({
        positions: greatCircleArc(start, end, ARC_SEGMENTS, altitude),
        startTime: Date.now(),
      })
    }

    arcsRef.current = newArcs
    return newArcs
  }, [hops])

  if (arcs.length === 0) return null

  return (
    <group>
      {arcs.map((arc, i) => (
        <AnimatedArc key={i} arc={arc} />
      ))}
    </group>
  )
}
