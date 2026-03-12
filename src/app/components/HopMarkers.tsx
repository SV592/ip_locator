'use client'

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTraceStore } from '../store/traceStore'
import { latLonToVec3, EARTH_RADIUS } from '../utils/geoMath'

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()

const PULSE_DURATION = 800 // ms
const BASE_SCALE = 0.035
const SELECTED_SCALE = 0.06
const PULSE_PEAK_SCALE = 0.12

export const HopMarkers: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)
  const selectedHopIndex = useTraceStore((s) => s.selectedHopIndex)
  const hoveredHopIndex = useTraceStore((s) => s.hoveredHopIndex)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const geoHops = useMemo(
    () => hops.filter((h) => h.location && h.location.lat !== 0 && h.location.lon !== 0),
    [hops]
  )

  const positions = useMemo(
    () => geoHops.map((h) => latLonToVec3(h.location!.lat, h.location!.lon, EARTH_RADIUS)),
    [geoHops]
  )

  useFrame(() => {
    if (!meshRef.current || positions.length === 0) return

    const now = Date.now()

    for (let i = 0; i < positions.length; i++) {
      _dummy.position.copy(positions[i])

      const hopIndex = hops.indexOf(geoHops[i])
      const isSelected = hopIndex === selectedHopIndex
      const isHovered = hopIndex === hoveredHopIndex

      // Pulse calculation
      const arrivedAt = geoHops[i].arrivedAt || 0
      const elapsed = now - arrivedAt
      let scale = isSelected ? SELECTED_SCALE : BASE_SCALE

      if (elapsed < PULSE_DURATION) {
        // Ease-out pulse: quick expand, slow settle
        const t = elapsed / PULSE_DURATION
        const pulse = Math.sin(t * Math.PI) * (1 - t)
        scale = scale + (PULSE_PEAK_SCALE - scale) * pulse
      }

      if (isHovered && !isSelected) {
        scale = Math.max(scale, BASE_SCALE * 1.5)
      }

      _dummy.scale.setScalar(scale)
      _dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, _dummy.matrix)

      // Color: selected=white, hovered=bright orange, default=orange
      if (isSelected) {
        _color.set('#ffffff')
      } else if (isHovered) {
        _color.set('#ffaa44')
      } else {
        _color.set('#ff8c00')
      }
      meshRef.current.setColorAt(i, _color)
    }

    meshRef.current.count = positions.length
    meshRef.current.instanceMatrix.needsUpdate = true
    // instanceColor is guaranteed non-null after setColorAt calls above
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  })

  if (geoHops.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 30]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial vertexColors transparent opacity={0.9} toneMapped={false} />
    </instancedMesh>
  )
}
