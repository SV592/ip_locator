'use client'

import React, { useRef, useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { perfThrottle } from './PerfMonitor'

const TRAIL_LENGTH = 80
const PERIOD = 35

/** Build a richer coma glow texture (128x128 canvas). */
function buildComaTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2

  // Outer soft blue halo
  const outer = ctx.createRadialGradient(c, c, 0, c, c, c)
  outer.addColorStop(0.0, 'rgba(220, 240, 255, 1.0)')
  outer.addColorStop(0.15, 'rgba(180, 230, 255, 0.85)')
  outer.addColorStop(0.35, 'rgba(100, 200, 255, 0.4)')
  outer.addColorStop(0.6, 'rgba(50, 150, 255, 0.12)')
  outer.addColorStop(1.0, 'rgba(20, 100, 255, 0.0)')
  ctx.fillStyle = outer
  ctx.fillRect(0, 0, size, size)

  return new THREE.CanvasTexture(canvas)
}

/** Build a subtle dust texture for the inner glow (64x64). */
function buildDustTexture(): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c)
  grad.addColorStop(0.0, 'rgba(255, 220, 150, 0.8)')
  grad.addColorStop(0.3, 'rgba(255, 180, 80, 0.3)')
  grad.addColorStop(1.0, 'rgba(255, 120, 40, 0.0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

// Reusable vector for position calculation
const _pos = new THREE.Vector3()

/** Compute comet world position from normalized time t in [0, 1]. */
function cometPosition(t: number, out: THREE.Vector3): THREE.Vector3 {
  // Wider, more dramatic arc
  const x = THREE.MathUtils.lerp(-45, 45, t)
  const y = -18 * Math.pow(t - 0.5, 2) + 18
  const z = THREE.MathUtils.lerp(-25, 25, t) + Math.sin(t * Math.PI) * 12
  return out.set(x, y, z)
}

// Trail vertex shader with variable point size based on freshness
const trailVertexShader = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Trail fragment shader with color gradient from white → cyan → blue
const trailFragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float edge = 1.0 - smoothstep(0.25, 0.5, dist);

    vec3 white = vec3(1.0, 1.0, 1.0);
    vec3 cyan  = vec3(0.3, 0.85, 1.0);
    vec3 blue  = vec3(0.1, 0.4, 0.9);

    vec3 color = vAlpha > 0.5
      ? mix(cyan, white, (vAlpha - 0.5) * 2.0)
      : mix(blue, cyan, vAlpha * 2.0);

    gl_FragColor = vec4(color, vAlpha * edge);
  }
`

export const Comet: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null)
  const glowRef  = useRef<THREE.Sprite>(null)
  const dustRef  = useRef<THREE.Sprite>(null)
  const trailRef = useRef<THREE.Points>(null)

  const [hovered, setHovered] = useState(false)

  const ringBuffer = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH * 3))
  const ringHead   = useRef(0)
  const frameCount = useRef(0)

  const { trailPositions, trailAlphas, trailSizes } = useMemo(() => {
    const trailPositions = new Float32Array(TRAIL_LENGTH * 3)
    const trailAlphas    = new Float32Array(TRAIL_LENGTH)
    const trailSizes     = new Float32Array(TRAIL_LENGTH)
    return { trailPositions, trailAlphas, trailSizes }
  }, [])

  const comaMaterial = useMemo(() => {
    const tex = buildComaTexture()
    return new THREE.SpriteMaterial({
      map: tex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.85,
    })
  }, [])

  const dustMaterial = useMemo(() => {
    const tex = buildDustTexture()
    return new THREE.SpriteMaterial({
      map: tex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.5,
    })
  }, [])

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(true)
  }, [])

  const handlePointerOut = useCallback(() => {
    setHovered(false)
  }, [])

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime()
    const t = (elapsed % PERIOD) / PERIOD

    cometPosition(t, _pos)

    if (groupRef.current) {
      groupRef.current.position.copy(_pos)
    }

    // Glow pulse — dual frequency for organic feel
    if (glowRef.current) {
      const pulse = 1.0 + Math.sin(elapsed * 6) * 0.06 + Math.sin(elapsed * 14) * 0.03
      const s = 0.7 * pulse
      glowRef.current.scale.set(s, s, 1)
    }

    // Dust glow — offset phase, slightly different scale
    if (dustRef.current) {
      const dp = 1.0 + Math.sin(elapsed * 4 + 1.5) * 0.08
      const ds = 0.4 * dp
      dustRef.current.scale.set(ds, ds, 1)
    }

    // Update trail ring buffer
    frameCount.current++
    const stride = perfThrottle.active ? 8 : 3
    if (frameCount.current % stride === 0) {
      const head = ringHead.current
      ringBuffer.current[head * 3 + 0] = _pos.x
      ringBuffer.current[head * 3 + 1] = _pos.y
      ringBuffer.current[head * 3 + 2] = _pos.z
      ringHead.current = (head + 1) % TRAIL_LENGTH
    }

    // Rebuild trail geometry
    if (trailRef.current) {
      for (let i = 0; i < TRAIL_LENGTH; i++) {
        const bufIdx = (ringHead.current - 1 - i + TRAIL_LENGTH * 2) % TRAIL_LENGTH
        const alpha = 1.0 - i / TRAIL_LENGTH

        trailPositions[i * 3 + 0] = ringBuffer.current[bufIdx * 3 + 0]
        trailPositions[i * 3 + 1] = ringBuffer.current[bufIdx * 3 + 1]
        trailPositions[i * 3 + 2] = ringBuffer.current[bufIdx * 3 + 2]
        trailAlphas[i] = alpha
        // Newer particles are bigger, older ones shrink
        trailSizes[i] = 0.3 + alpha * 0.7
      }

      const geom = trailRef.current.geometry
      ;(geom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      ;(geom.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true
      ;(geom.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true
    }
  })

  return (
    <>
      <group ref={groupRef}>
        {/* Comet nucleus — slightly warm tint */}
        <mesh
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#fffaf0" toneMapped={false} />
        </mesh>

        {/* Inner warm dust glow */}
        <sprite ref={dustRef} material={dustMaterial} scale={[0.4, 0.4, 1]} />

        {/* Outer coma glow */}
        <sprite ref={glowRef} material={comaMaterial} scale={[0.7, 0.7, 1]} />

        {/* Local point light for illumination bleeding */}
        <pointLight color="#aaddff" intensity={0.5} distance={5} decay={2} />

        {/* Easter egg tooltip */}
        {hovered && (
          <Html
            distanceFactor={10}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[100, 0]}
          >
            <div className="bg-black/80 backdrop-blur-sm border border-emerald-400/40 rounded px-2.5 py-1.5 text-[10px] text-emerald-300 font-mono whitespace-nowrap shadow-lg shadow-emerald-500/10">
              Making a flyby at 299,792 km/s
            </div>
          </Html>
        )}
      </group>

      {/* Particle trail — world space */}
      <points ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPositions, 3]} />
          <bufferAttribute attach="attributes-aAlpha" args={[trailAlphas, 1]} />
          <bufferAttribute attach="attributes-aSize" args={[trailSizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={trailVertexShader}
          fragmentShader={trailFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  )
}
