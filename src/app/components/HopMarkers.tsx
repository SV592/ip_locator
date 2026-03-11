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
