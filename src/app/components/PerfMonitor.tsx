'use client'

import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Shared across components — import this ref to check if throttling
export const perfThrottle = { active: false }

const THROTTLE_THRESHOLD_MS = 22 // ~45fps — start throttling
const SAMPLE_COUNT = 30

export const PerfMonitor: React.FC = () => {
  const frameTimes = useRef<number[]>([])
  const lastTime = useRef(0)

  useFrame(() => {
    const now = performance.now()
    if (lastTime.current > 0) {
      const delta = now - lastTime.current
      frameTimes.current.push(delta)

      if (frameTimes.current.length > SAMPLE_COUNT) {
        frameTimes.current.shift()
      }

      // Average frame time over sample window
      if (frameTimes.current.length >= SAMPLE_COUNT) {
        const avg =
          frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length
        perfThrottle.active = avg > THROTTLE_THRESHOLD_MS
      }
    }
    lastTime.current = now
  })

  return null
}
