'use client'

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

const STREAK_COUNT = 120
const SPIN_THRESHOLD = 0.04 // radians/frame angular velocity to trigger warp
const FADE_IN_RATE = 3.0
const FADE_OUT_RATE = 2.0

const streakVertexShader = /* glsl */ `
  attribute float aOffset;
  attribute float aSpeed;

  uniform float uIntensity;
  uniform float uTime;

  varying float vAlpha;

  void main() {
    float t = fract(aOffset + uTime * aSpeed);
    vAlpha = uIntensity * smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.4, t);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = mix(1.0, 3.0, uIntensity) * (1.0 + t * 2.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const streakFragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;
    float edge = 1.0 - smoothstep(0.2, 0.5, dist);
    gl_FragColor = vec4(0.7, 0.85, 1.0, vAlpha * edge);
  }
`

export const WarpSpeed: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const prevAzimuth = useRef(0)
  const intensity = useRef(0)
  const camera = useThree((s) => s.camera)

  const { geometry, uniforms } = useMemo(() => {
    const positions = new Float32Array(STREAK_COUNT * 3)
    const offsets = new Float32Array(STREAK_COUNT)
    const speeds = new Float32Array(STREAK_COUNT)

    for (let i = 0; i < STREAK_COUNT; i++) {
      // Distribute on a sphere shell around the camera
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(THREE.MathUtils.randFloat(-1, 1))
      const r = THREE.MathUtils.randFloat(15, 60)

      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      offsets[i] = Math.random()
      speeds[i] = THREE.MathUtils.randFloat(0.3, 1.2)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1))
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))

    const uniforms = {
      uIntensity: { value: 0 },
      uTime: { value: 0 },
    }

    return { geometry, uniforms }
  }, [])

  useFrame((state, delta) => {
    // Compute angular velocity from camera azimuth change
    const azimuth = Math.atan2(camera.position.x, camera.position.z)
    const angularVel = Math.abs(azimuth - prevAzimuth.current)
    // Handle wrap-around
    const clampedVel = angularVel > Math.PI ? (2 * Math.PI - angularVel) : angularVel
    prevAzimuth.current = azimuth

    // Smooth intensity ramp
    if (clampedVel > SPIN_THRESHOLD) {
      intensity.current = Math.min(1, intensity.current + FADE_IN_RATE * delta)
    } else {
      intensity.current = Math.max(0, intensity.current - FADE_OUT_RATE * delta)
    }

    if (materialRef.current) {
      materialRef.current.uniforms.uIntensity.value = intensity.current
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }

    // Hide entirely when not active
    if (pointsRef.current) {
      pointsRef.current.visible = intensity.current > 0.01
    }
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={streakVertexShader}
        fragmentShader={streakFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
