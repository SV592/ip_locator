'use client'

import React, { FC, useRef, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useLoader } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useTraceStore } from '../store/traceStore'
import { latLonToVec3, EARTH_RADIUS } from '../utils/geoMath'
import { SunProps } from '../types/geo'

/** Build a radial-gradient glow texture via an offscreen canvas (128×128). */
function buildGlowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const center = size / 2
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center)
  gradient.addColorStop(0.0, 'rgba(255, 255, 180, 1.0)')
  gradient.addColorStop(0.3, 'rgba(255, 220,  80, 0.6)')
  gradient.addColorStop(0.7, 'rgba(255, 160,  20, 0.15)')
  gradient.addColorStop(1.0, 'rgba(255, 100,   0, 0.0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

/** Build a soft elongated ray texture via an offscreen canvas (32×256). */
function buildRayTexture(): THREE.CanvasTexture {
  const w = 32
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  // Horizontal soft-edge (across the short axis)
  const hGrad = ctx.createLinearGradient(0, 0, w, 0)
  hGrad.addColorStop(0.0,  'rgba(255, 240, 100, 0.0)')
  hGrad.addColorStop(0.5,  'rgba(255, 240, 100, 1.0)')
  hGrad.addColorStop(1.0,  'rgba(255, 240, 100, 0.0)')
  // Vertical fade from center outward (along the long axis)
  const vGrad = ctx.createLinearGradient(0, 0, 0, h)
  vGrad.addColorStop(0.0,  'rgba(255, 240, 100, 0.0)')
  vGrad.addColorStop(0.35, 'rgba(255, 240, 100, 1.0)')
  vGrad.addColorStop(0.5,  'rgba(255, 240, 100, 1.0)')
  vGrad.addColorStop(0.65, 'rgba(255, 240, 100, 1.0)')
  vGrad.addColorStop(1.0,  'rgba(255, 240, 100, 0.0)')
  // Draw horizontal gradient first, then multiply with vertical
  ctx.fillStyle = hGrad
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = vGrad
  ctx.fillRect(0, 0, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

// Four corona rays: [angle offset (radians), orbit speed (rad/s)]
const CORONA_RAYS: Array<{ angleOffset: number; speed: number }> = [
  { angleOffset: 0,                  speed: 0.10 },
  { angleOffset: Math.PI / 2,        speed: 0.07 },
  { angleOffset: Math.PI,            speed: 0.13 },
  { angleOffset: (3 * Math.PI) / 2,  speed: 0.09 },
]

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
  const [hovered, setHovered] = useState(false)
  const sunRef   = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const glowRef  = useRef<THREE.Sprite>(null)
  const rayRefs  = useRef<Array<THREE.Sprite | null>>([null, null, null, null])

  const hops   = useTraceStore((s) => s.hops)
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

  // Generate canvas textures once
  const glowTexture = useMemo(() => buildGlowTexture(), [])
  const rayTexture  = useMemo(() => buildRayTexture(),  [])

  // SpriteMaterial instances — created once, reused across sprites
  const glowMaterial = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.85,
      }),
    [glowTexture]
  )

  const rayMaterials = useMemo(
    () =>
      CORONA_RAYS.map(
        () =>
          new THREE.SpriteMaterial({
            map: rayTexture,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.15,
          })
      ),
    [rayTexture]
  )

  // Load sun surface texture once
  const sunTexture = useLoader(THREE.TextureLoader, 'textures/2k_sun.jpg')

  // Smoothly animated sun position
  const currentDir = useRef(new THREE.Vector3(1, 0, 0))
  // Per-ray angle accumulators (initialised from CORONA_RAYS.angleOffset)
  const rayAngles = useRef(CORONA_RAYS.map((r) => r.angleOffset))

  useFrame((state, delta) => {
    if (!groupRef.current) return

    // --- Position tracking ---
    if (hopTarget) {
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

    // --- Sun surface rotation ---
    if (sunRef.current) {
      sunRef.current.rotation.y += delta * 0.05
    }

    // --- Glow pulse ---
    if (glowRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.08 + 1.0
      const glowSize = radius * 3.5 * pulse
      glowRef.current.scale.set(glowSize, glowSize, 1)
    }

    // --- Corona ray rotation ---
    for (let i = 0; i < CORONA_RAYS.length; i++) {
      const sprite = rayRefs.current[i]
      if (!sprite) continue
      rayAngles.current[i] += CORONA_RAYS[i].speed * delta
      const angle = rayAngles.current[i]
      // Orbit in the local XY plane around the sun origin
      const dist = radius * 0.6
      sprite.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, 0)
      sprite.material.rotation = angle + Math.PI / 2
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

      {/* Sun surface sphere */}
      <mesh
        ref={sunRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial map={sunTexture} />
      </mesh>

      {hovered && (
        <Html
          position={[0, radius * 2, 0]}
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[100, 0]}
        >
          <div className="bg-black/80 backdrop-blur-sm border border-orange-400/40 rounded px-2.5 py-1.5 text-[10px] text-orange-300 font-mono whitespace-nowrap shadow-lg shadow-orange-500/10">
            Surface temp: 5,778K. Your CPU: getting there.
          </div>
        </Html>
      )}

      {/* Single billboard glow sprite */}
      <sprite ref={glowRef} material={glowMaterial} scale={[radius * 3.5, radius * 3.5, 1]} />

      {/* Corona ray sprites */}
      {CORONA_RAYS.map((ray, i) => (
        <sprite
          key={i}
          ref={(el) => { rayRefs.current[i] = el }}
          material={rayMaterials[i]}
          scale={[0.3, 2, 1]}
          position={[
            Math.cos(ray.angleOffset) * radius * 0.6,
            Math.sin(ray.angleOffset) * radius * 0.6,
            0,
          ]}
        />
      ))}
    </group>
  )
}
