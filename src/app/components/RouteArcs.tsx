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
