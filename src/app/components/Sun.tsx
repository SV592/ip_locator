'use client'

import React, { FC, useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTraceStore } from '../store/traceStore'
import { latLonToVec3, EARTH_RADIUS } from '../utils/geoMath'

import { SunProps } from '../types/geo'

export const Sun: FC<
  SunProps & {
    orbitRadius?: number
    orbitSpeed?: number
    enableOrbit?: boolean
    orbitHeight?: number
  }
> = ({
  intensity = 1.5,
  radius = 0.5,
  color = '#ffffaa',
  orbitRadius = 50,
  orbitSpeed = 0.02,
  enableOrbit = false,
  orbitHeight = 10,
}) => {
  const sunRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const glowRef1 = useRef<THREE.Mesh>(null)
  const glowRef2 = useRef<THREE.Mesh>(null)

  const hops = useTraceStore((s) => s.hops)
  const status = useTraceStore((s) => s.status)

  // Compute hop centroid direction for sun targeting
  const hopTarget = useMemo(() => {
    if (status === 'idle') return null
    const geoHops = hops.filter(
      (h) => h.location && h.location.lat !== 0 && h.location.lon !== 0
    )
    if (geoHops.length === 0) return null
    const centroid = new THREE.Vector3()
    for (const h of geoHops) {
      centroid.add(latLonToVec3(h.location!.lat, h.location!.lon, EARTH_RADIUS))
    }
    centroid.divideScalar(geoHops.length)
    return centroid.normalize()
  }, [hops, status])

  // Smoothly animated sun position
  const currentDir = useRef(new THREE.Vector3(1, 0, 0))

  useFrame((state, delta) => {
    if (!groupRef.current) return

    if (hopTarget) {
      // Smoothly lerp sun direction toward hop centroid
      currentDir.current.lerp(hopTarget, 2 * delta)
      currentDir.current.normalize()

      const pos = currentDir.current.clone().multiplyScalar(orbitRadius)
      pos.y = orbitHeight
      groupRef.current.position.copy(pos)
    } else if (enableOrbit) {
      const time = state.clock.elapsedTime * orbitSpeed
      const x = Math.cos(time) * orbitRadius
      const y = orbitHeight
      const z = Math.sin(time) * orbitRadius
      groupRef.current.position.set(x, y, z)
      currentDir.current.set(x, 0, z).normalize()
    }

    // Rotate sun
    if (sunRef.current) {
      sunRef.current.rotation.y += delta * 0.05
    }

    // Pulsing glow
    const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1
    if (glowRef1.current) {
      glowRef1.current.scale.setScalar(1.15 * pulse)
    }
    if (glowRef2.current) {
      glowRef2.current.scale.setScalar(1.5 * (2 - pulse) * 0.5)
    }
  })

  return (
    <group ref={groupRef} position={[orbitRadius, orbitHeight, 0]}>
      <directionalLight
        intensity={intensity}
        color={color}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <pointLight
        intensity={intensity * 0.5}
        color={color}
        distance={100}
        decay={2}
      />

      <mesh ref={sunRef}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial
          map={new THREE.TextureLoader().load('textures/2k_sun.jpg')}
        />
      </mesh>

      <mesh ref={glowRef1}>
        <sphereGeometry args={[radius * 1.15, 32, 32]} />
        <meshBasicMaterial
          color="#ffff99"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={glowRef2}>
        <sphereGeometry args={[radius * 1.5, 24, 24]} />
        <meshBasicMaterial
          color="#ffff66"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
