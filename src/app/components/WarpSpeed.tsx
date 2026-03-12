'use client'

import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

const SPIN_THRESHOLD = 0.025
const FADE_IN_RATE = 3.0
const FADE_OUT_RATE = 2.5
const BASE_FOV = 60
const WARP_FOV = 68

export const WarpSpeed: React.FC = () => {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const prevCamPos = useRef(new THREE.Vector3())
  const intensity = useRef(0)
  const initialized = useRef(false)
  const { camera } = useThree()

  useEffect(() => {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 10;
      opacity: 0;
      background: radial-gradient(ellipse at center, transparent 40%, rgba(40, 100, 200, 0.12) 100%);
      mix-blend-mode: screen;
    `
    document.body.appendChild(overlay)
    overlayRef.current = overlay
    return () => { overlay.remove() }
  }, [])

  useFrame((_, delta) => {
    if (!initialized.current) {
      prevCamPos.current.copy(camera.position)
      initialized.current = true
      return
    }

    const cx = camera.position.x, cz = camera.position.z, cy = camera.position.y
    const px = prevCamPos.current.x, pz = prevCamPos.current.z, py = prevCamPos.current.y

    let azDiff = Math.abs(Math.atan2(cx, cz) - Math.atan2(px, pz))
    if (azDiff > Math.PI) azDiff = 2 * Math.PI - azDiff

    const elDiff = Math.abs(
      Math.atan2(cy, Math.sqrt(cx * cx + cz * cz)) -
      Math.atan2(py, Math.sqrt(px * px + pz * pz))
    )

    prevCamPos.current.copy(camera.position)
    const vel = azDiff + elDiff

    if (vel > SPIN_THRESHOLD) {
      const boost = Math.min((vel - SPIN_THRESHOLD) / SPIN_THRESHOLD, 3)
      intensity.current = Math.min(1, intensity.current + FADE_IN_RATE * delta * boost)
    } else {
      intensity.current = Math.max(0, intensity.current - FADE_OUT_RATE * delta)
    }

    const i = intensity.current

    // Subtle FOV widening
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = THREE.MathUtils.lerp(BASE_FOV, WARP_FOV, i * i)
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.08)
      camera.updateProjectionMatrix()
    }

    // Subtle blue vignette
    if (overlayRef.current) {
      overlayRef.current.style.opacity = String(i * 0.6)
    }
  })

  return null
}
