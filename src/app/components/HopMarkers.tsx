'use client'

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTraceStore } from '../store/traceStore'
import { latLonToVec3, EARTH_RADIUS } from '../utils/geoMath'

const _dummy = new THREE.Object3D()
const _up = new THREE.Vector3(0, 1, 0)

const PULSE_DURATION = 800 // ms
const BASE_SCALE = 0.03
const SELECTED_SCALE = 0.05
const PULSE_PEAK_SCALE = 0.09

function createPinGeometry(): THREE.BufferGeometry {
  const points = [
    new THREE.Vector2(0, 0),        // needle tip
    new THREE.Vector2(0.12, 0.35),  // needle widens
    new THREE.Vector2(0.08, 0.55),  // neck narrows
    new THREE.Vector2(0.35, 0.7),   // head starts
    new THREE.Vector2(0.4, 0.85),   // head widest
    new THREE.Vector2(0.35, 1.0),   // head narrows
    new THREE.Vector2(0, 1.1),      // top (closed)
  ]
  return new THREE.LatheGeometry(points, 12)
}

export const HopMarkers: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)
  const selectedHopIndex = useTraceStore((s) => s.selectedHopIndex)
  const hoveredHopIndex = useTraceStore((s) => s.hoveredHopIndex)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const pinGeometry = useMemo(() => createPinGeometry(), [])

  const geoHops = useMemo(
    () => hops.filter((h) => h.location && h.location.lat !== 0 && h.location.lon !== 0),
    [hops]
  )

  const positions = useMemo(
    () => geoHops.map((h) => latLonToVec3(h.location!.lat, h.location!.lon, EARTH_RADIUS * 1.005)),
    [geoHops]
  )

  useFrame(() => {
    if (!meshRef.current || positions.length === 0) return

    const now = Date.now()

    for (let i = 0; i < positions.length; i++) {
      _dummy.position.copy(positions[i])

      // Orient pin so local +Y points radially outward from globe center
      const dir = positions[i].clone().normalize()
      _dummy.quaternion.setFromUnitVectors(_up, dir)

      const hopIndex = hops.indexOf(geoHops[i])
      const isSelected = hopIndex === selectedHopIndex
      const isHovered = hopIndex === hoveredHopIndex

      // Pulse calculation
      const arrivedAt = geoHops[i].arrivedAt || 0
      const elapsed = now - arrivedAt
      let scale = isSelected ? SELECTED_SCALE : BASE_SCALE

      if (elapsed < PULSE_DURATION) {
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
    }

    meshRef.current.count = positions.length
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  if (geoHops.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[pinGeometry, undefined, 30]}>
      <meshBasicMaterial color="#ef4444" transparent opacity={0.95} toneMapped={false} depthWrite={false} />
    </instancedMesh>
  )
}
