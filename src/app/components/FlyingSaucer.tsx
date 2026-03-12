'use client'

import React, { useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { perfThrottle } from './PerfMonitor'

function createSaucerProfile(): THREE.Vector2[] {
  return [
    new THREE.Vector2(0.00, -0.05),
    new THREE.Vector2(0.20, -0.05),
    new THREE.Vector2(0.42, -0.02),
    new THREE.Vector2(0.56,  0.02),
    new THREE.Vector2(0.60,  0.05),
    new THREE.Vector2(0.56,  0.08),
    new THREE.Vector2(0.42,  0.10),
    new THREE.Vector2(0.28,  0.13),
    new THREE.Vector2(0.15,  0.17),
    new THREE.Vector2(0.00,  0.17),
  ]
}

/** Build a soft underglow ring texture (64x64 canvas). */
function buildUnderglowTexture(): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c)
  grad.addColorStop(0.0, 'rgba(0, 255, 255, 0.9)')
  grad.addColorStop(0.4, 'rgba(0, 200, 255, 0.4)')
  grad.addColorStop(0.7, 'rgba(0, 120, 255, 0.1)')
  grad.addColorStop(1.0, 'rgba(0, 80, 200, 0.0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

export const FlyingSaucer: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Sprite>(null)
  const [hovered, setHovered] = useState(false)

  const saucerProfile = useMemo(() => createSaucerProfile(), [])

  const discMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xc0ccd0),
        metalness: 0.92,
        roughness: 0.18,
        emissive: new THREE.Color(0x00ccff),
        emissiveIntensity: 0.06,
      }),
    []
  )

  const domeMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xccf0ff),
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.6,
        thickness: 0.3,
        emissive: new THREE.Color(0x00ffee),
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.75,
      }),
    []
  )

  const underglowMaterial = useMemo(() => {
    const tex = buildUnderglowTexture()
    return new THREE.SpriteMaterial({
      map: tex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.6,
    })
  }, [])

  useFrame((state) => {
    if (!groupRef.current) return

    const t = state.clock.elapsedTime

    // Figure-8ish orbit path for more interesting movement
    const x = Math.cos(t * 0.12) * 6.5
    const y = Math.sin(t * 0.18) * 0.8 + 4.2
    const z = Math.sin(t * 0.12) * 4.5 * Math.cos(t * 0.06)
    groupRef.current.position.set(x, y, z)

    if (!perfThrottle.active) {
      groupRef.current.rotation.x = Math.sin(t * 0.7) * 0.1
      groupRef.current.rotation.z = Math.cos(t * 0.5 + 1.2) * 0.06
    }

    groupRef.current.rotation.y = t * 0.5

    // Underglow pulse
    if (glowRef.current) {
      const pulse = 0.5 + Math.sin(t * 3) * 0.15
      glowRef.current.material.opacity = pulse
      const s = 1.4 + Math.sin(t * 2) * 0.1
      glowRef.current.scale.set(s, s * 0.3, 1)
    }
  })

  return (
    <group ref={groupRef} scale={0.18}>
      {/* Disc body */}
      <mesh
        material={discMaterial}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
      >
        <latheGeometry args={[saucerProfile, 64]} />
      </mesh>

      {/* Glass dome */}
      <mesh
        position={[0, 0.17, 0]}
        material={domeMaterial}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.14, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* Rim detail ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.60, 0.008, 8, 64]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.4} />
      </mesh>

      {/* Underglow beam */}
      <sprite
        ref={glowRef}
        material={underglowMaterial}
        position={[0, -0.12, 0]}
        scale={[1.4, 0.4, 1]}
      />

      {/* Point light for local illumination */}
      <pointLight color="#00ccff" intensity={0.3} distance={3} decay={2} position={[0, -0.1, 0]} />

      {/* Easter egg tooltip */}
      {hovered && (
        <Html
          position={[0, 1.2, 0]}
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[100, 0]}
        >
          <div className="bg-black/80 backdrop-blur-sm border border-cyan-400/40 rounded px-2.5 py-1.5 text-[10px] text-cyan-300 font-mono whitespace-nowrap shadow-lg shadow-cyan-500/10">
            We come in peace... to check your ping
          </div>
        </Html>
      )}
    </group>
  )
}
