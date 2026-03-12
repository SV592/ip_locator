'use client'

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { perfThrottle } from './PerfMonitor'

const MAX_INSTANCES = 5

interface StarState {
  active: boolean
  position: THREE.Vector3
  direction: THREE.Vector3
  speed: number
  life: number
  maxLife: number
}

function createGradientTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 4
  const ctx = canvas.getContext('2d')!
  // Bright white at the left (head), fading to transparent at the right (tail)
  const grad = ctx.createLinearGradient(0, 0, 64, 0)
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)')
  grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)')
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 4)
  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

// Reusable objects to avoid per-frame allocation
const _matrix = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _quaternion = new THREE.Quaternion()
const _scale = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _lookTarget = new THREE.Vector3()
const _cameraRight = new THREE.Vector3()
const _cameraUp = new THREE.Vector3()
const _forward = new THREE.Vector3()

export const ShootingStars: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // Per-instance opacity stored separately for material updates
  const opacityRef = useRef<Float32Array>(new Float32Array(MAX_INSTANCES))

  const stars = useRef<StarState[]>(
    Array.from({ length: MAX_INSTANCES }, () => ({
      active: false,
      position: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      speed: 0,
      life: 0,
      maxLife: 1,
    }))
  )

  const { geometry, material } = useMemo(() => {
    // Plane: 0.02 wide, 1.5 long — oriented along local X axis so the gradient
    // runs head (left) to tail (right) before we rotate it into world space.
    // PlaneGeometry(width, height) — we treat width as the streak length.
    const geometry = new THREE.PlaneGeometry(1.5, 0.02)

    const texture = createGradientTexture()

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    return { geometry, material }
  }, [])

  useFrame(({ camera }, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const spawnChance = perfThrottle.active ? 0.002 : 0.005

    // Extract camera basis vectors for billboard orientation
    camera.updateMatrixWorld()
    _cameraRight.setFromMatrixColumn(camera.matrixWorld, 0)
    _cameraUp.setFromMatrixColumn(camera.matrixWorld, 1)

    let activeCount = 0

    for (let i = 0; i < MAX_INSTANCES; i++) {
      const star = stars.current[i]

      if (!star.active) {
        // Chance to spawn this frame
        if (Math.random() < spawnChance * delta * 60) {
          activateStar(star)
        }
        // Keep instance invisible
        _scale.set(0, 0, 0)
        _matrix.compose(_position.set(0, 0, 0), _quaternion.identity(), _scale)
        mesh.setMatrixAt(i, _matrix)
        continue
      }

      // Advance life and position
      star.life -= delta
      if (star.life <= 0) {
        star.active = false
        _scale.set(0, 0, 0)
        _matrix.compose(_position.set(0, 0, 0), _quaternion.identity(), _scale)
        mesh.setMatrixAt(i, _matrix)
        opacityRef.current[i] = 0
        continue
      }

      star.position.addScaledVector(star.direction, star.speed * delta)

      // Fade: linear fade from 1 → 0 over life
      const lifeRatio = star.life / star.maxLife
      opacityRef.current[i] = lifeRatio

      // Orient the plane:
      // 1. The streak should align with the direction of travel in screen space.
      // 2. The plane should face the camera (billboarded around the travel axis).
      //
      // Strategy:
      //   - Local X axis  → world direction of travel
      //   - Local Y axis  → camera up (so the thin dimension faces camera)
      //   - Local Z axis  → camera forward (so the plane faces viewer)
      //
      // Build the rotation matrix from these axes directly.

      _forward.copy(star.direction).normalize()          // streak direction (local X)
      // The plane's normal must face the camera.
      // Camera-to-star vector gives us the view direction.
      const toCam = _lookTarget
        .copy(camera.position)
        .sub(star.position)
        .normalize()

      // Y axis: perpendicular to both travel direction and view direction
      // This keeps the plane thin and facing the camera.
      const planeY = _up.copy(toCam).cross(_forward).normalize()
      // If degenerate (direction exactly toward camera), fall back to camera up
      if (planeY.lengthSq() < 1e-6) {
        planeY.copy(_cameraUp)
      }

      // Z axis: normal of the plane (should face camera)
      const planeZ = _cameraRight.copy(_forward).cross(planeY).normalize()

      // Build rotation matrix: columns = [planeX=forward, planeY, planeZ]
      _matrix.makeBasis(_forward, planeY, planeZ)
      _quaternion.setFromRotationMatrix(_matrix)

      // Position the plane so the head (positive X end) is at star.position.
      // PlaneGeometry is centred at origin, so offset by half-length along direction.
      _position.copy(star.position).addScaledVector(_forward, -0.75)

      // Scale: uniform 1 (geometry already sized correctly)
      _scale.set(1, 1, 1)

      _matrix.compose(_position, _quaternion, _scale)
      mesh.setMatrixAt(i, _matrix)
      activeCount++
    }

    mesh.instanceMatrix.needsUpdate = true
    mesh.count = MAX_INSTANCES

    // Update material opacity to the brightest active star's opacity as a
    // simple proxy — for per-instance opacity we'd need a shader; instead we
    // keep the material at full opacity and encode fade via scale or rely on
    // the gradient texture's natural transparency. We modulate the overall
    // material opacity by the mean of active opacities so stars dim together,
    // which is acceptable for ≤5 stars.
    if (activeCount > 0) {
      let sum = 0
      for (let i = 0; i < MAX_INSTANCES; i++) {
        sum += opacityRef.current[i]
      }
      material.opacity = Math.max(0.01, sum / activeCount)
    } else {
      material.opacity = 0
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_INSTANCES]}
      frustumCulled={false}
    />
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function activateStar(star: StarState) {
  // Random start position on a sphere shell, distance 30–60 from origin
  const dist = THREE.MathUtils.randFloat(30, 60)
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(THREE.MathUtils.randFloat(-1, 1))
  star.position.set(
    dist * Math.sin(phi) * Math.cos(theta),
    dist * Math.sin(phi) * Math.sin(theta),
    dist * Math.cos(phi)
  )

  // Direction: generally aimed inward toward the globe area with a slight
  // downward bias, but not directly at the origin (so it doesn't hit the globe).
  // We take the inward vector, perturb it randomly so it misses the globe.
  const inward = star.position.clone().negate().normalize()

  // Random perpendicular perturbation to offset the trajectory
  const perp1 = new THREE.Vector3(inward.y + 0.01, -inward.x, 0).normalize()
  const perp2 = new THREE.Vector3().crossVectors(inward, perp1).normalize()
  const offsetAngle = THREE.MathUtils.randFloat(0.2, 0.8) // radians offset
  const offsetDir = THREE.MathUtils.randFloat(0, Math.PI * 2)

  star.direction = inward
    .addScaledVector(perp1, Math.cos(offsetDir) * Math.sin(offsetAngle))
    .addScaledVector(perp2, Math.sin(offsetDir) * Math.sin(offsetAngle))
    .normalize()

  star.speed   = THREE.MathUtils.randFloat(20, 40)
  star.maxLife = THREE.MathUtils.randFloat(0.3, 0.8)
  star.life    = star.maxLife
  star.active  = true
}
