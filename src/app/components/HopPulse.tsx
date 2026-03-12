'use client'

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTraceStore } from '../store/traceStore'
import { latLonToVec3, EARTH_RADIUS } from '../utils/geoMath'

const PULSE_CYCLE = 3 // seconds per full cycle
const MAX_RING_SCALE = 0.12
const _zAxis = new THREE.Vector3(0, 0, 1)

const PulseRing: React.FC<{ pos: THREE.Vector3; arrivedAt: number }> = ({ pos, arrivedAt }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(_zAxis, pos.clone().normalize())
    return q
  }, [pos])

  useFrame(() => {
    if (!meshRef.current || !matRef.current) return
    const elapsed = (Date.now() - arrivedAt) / 1000
    const progress = (elapsed % PULSE_CYCLE) / PULSE_CYCLE
    const scale = 0.02 + progress * MAX_RING_SCALE
    meshRef.current.scale.setScalar(scale)
    matRef.current.opacity = (1 - progress) * 0.5
  })

  return (
    <mesh ref={meshRef} position={pos} quaternion={quaternion}>
      <ringGeometry args={[0.7, 1, 32]} />
      <meshBasicMaterial
        ref={matRef}
        color="#06b6d4"
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export const HopPulse: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)
  const status = useTraceStore((s) => s.status)

  const geoHops = useMemo(
    () => hops.filter((h) => h.location && h.location.lat !== 0 && h.location.lon !== 0),
    [hops]
  )

  const positions = useMemo(
    () => geoHops.map((h) => latLonToVec3(h.location!.lat, h.location!.lon, EARTH_RADIUS * 1.003)),
    [geoHops]
  )

  if (geoHops.length === 0 || status === 'idle') return null

  return (
    <group>
      {geoHops.map((hop, i) => (
        <PulseRing key={i} pos={positions[i]} arrivedAt={hop.arrivedAt || Date.now()} />
      ))}
    </group>
  )
}
