'use client'

import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useTraceStore } from '../store/traceStore'
import { getCameraPositionForLatLon, easeInOutCubic } from '../utils/cameramath'
import { EARTH_RADIUS } from '../utils/geoMath'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

interface CameraControllerProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}

const FLIGHT_DURATION = 1.8 // seconds

export const CameraController: React.FC<CameraControllerProps> = ({
  controlsRef,
}) => {
  const camera = useThree((s) => s.camera)
  const cameraTarget = useTraceStore((s) => s.cameraTarget)
  const status = useTraceStore((s) => s.status)
  const isReplaying = useTraceStore((s) => s.isReplaying)
  const advanceReplay = useTraceStore((s) => s.advanceReplay)
  const replayPauseRef = useRef<number>(0) // timestamp when pause started
  const REPLAY_PAUSE = 1200 // ms to pause at each hop before moving on
  const prevStatusRef = useRef(status)

  // Animation state (refs to avoid re-renders)
  const isAnimating = useRef(false)
  const startTime = useRef(0)
  const startPos = useRef(new THREE.Vector3())
  const endPos = useRef(new THREE.Vector3())
  const startLookAt = useRef(new THREE.Vector3())
  const endLookAt = useRef(new THREE.Vector3())

  // Start a new fly-to animation when cameraTarget changes
  useEffect(() => {
    if (!cameraTarget) {
      isAnimating.current = false
      // Re-enable controls
      if (controlsRef.current) controlsRef.current.enabled = true
      return
    }

    const { position, lookAt } = getCameraPositionForLatLon(
      cameraTarget.lat,
      cameraTarget.lon
    )

    // Capture current state
    startPos.current.copy(camera.position)
    endPos.current.copy(position)

    // Current look-at: where camera is pointing
    const currentLookAt = new THREE.Vector3()
    camera.getWorldDirection(currentLookAt)
    currentLookAt.multiplyScalar(2).add(camera.position)
    startLookAt.current.copy(currentLookAt)
    endLookAt.current.copy(lookAt)

    // Disable OrbitControls during animation
    if (controlsRef.current) controlsRef.current.enabled = false

    startTime.current = -1 // will be set on first frame
    isAnimating.current = true
  }, [cameraTarget, camera, controlsRef])

  // Auto-zoom out to overview when trace starts
  useEffect(() => {
    if (prevStatusRef.current !== 'tracing' && status === 'tracing') {
      // Set a good overview position (slightly elevated, pulled back)
      startPos.current.copy(camera.position)
      endPos.current.set(12, 8, 12)

      const currentLookAt = new THREE.Vector3()
      camera.getWorldDirection(currentLookAt)
      currentLookAt.multiplyScalar(2).add(camera.position)
      startLookAt.current.copy(currentLookAt)
      endLookAt.current.set(0, 0, 0) // center of globe

      if (controlsRef.current) controlsRef.current.enabled = false
      startTime.current = -1
      isAnimating.current = true
    }
    prevStatusRef.current = status
  }, [status, camera, controlsRef])

  useFrame((state) => {
    if (!isAnimating.current) return

    // Initialize start time on first frame
    if (startTime.current < 0) {
      startTime.current = state.clock.elapsedTime
    }

    const elapsed = state.clock.elapsedTime - startTime.current
    const rawT = Math.min(elapsed / FLIGHT_DURATION, 1)
    const t = easeInOutCubic(rawT)

    // Interpolate position (with minimum radius to prevent clipping through globe)
    camera.position.lerpVectors(startPos.current, endPos.current, t)
    const minRadius = EARTH_RADIUS + 2 // never closer than 2 units above surface
    if (camera.position.length() < minRadius) {
      camera.position.normalize().multiplyScalar(minRadius)
    }

    // Interpolate look-at
    const currentLookAt = new THREE.Vector3().lerpVectors(
      startLookAt.current,
      endLookAt.current,
      t
    )
    camera.lookAt(currentLookAt)

    // Update OrbitControls target to match
    if (controlsRef.current) {
      controlsRef.current.target.copy(currentLookAt)
    }

    // Animation complete
    if (rawT >= 1) {
      isAnimating.current = false
      if (controlsRef.current) {
        controlsRef.current.target.copy(endLookAt.current)
        controlsRef.current.enabled = true
        controlsRef.current.update()
      }
    }
  })

  // Replay advancement: when fly-to completes and we're replaying, wait then advance
  useFrame(() => {
    if (!isReplaying || isAnimating.current) {
      replayPauseRef.current = 0
      return
    }

    // Animation just finished — start the pause timer
    if (replayPauseRef.current === 0) {
      replayPauseRef.current = Date.now()
      return
    }

    // Wait for the pause
    if (Date.now() - replayPauseRef.current >= REPLAY_PAUSE) {
      replayPauseRef.current = 0
      advanceReplay()
    }
  })

  return null // renderless component
}
