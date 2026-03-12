'use client'

import React, { useMemo } from 'react'
import * as THREE from 'three'

const SEGMENTS = 72
const LAT_STEP = 30
const LON_STEP = 30
const RADIUS = 2.006

export const GlobeGrid: React.FC = () => {
  const geometry = useMemo(() => {
    const positions: number[] = []

    // Latitude lines (-60 to 60)
    for (let lat = -60; lat <= 60; lat += LAT_STEP) {
      const phi = (90 - lat) * (Math.PI / 180)
      const y = RADIUS * Math.cos(phi)
      const r = RADIUS * Math.sin(phi)

      for (let i = 0; i < SEGMENTS; i++) {
        const a = (i / SEGMENTS) * Math.PI * 2
        const b = ((i + 1) / SEGMENTS) * Math.PI * 2
        positions.push(
          r * Math.cos(a), y, r * Math.sin(a),
          r * Math.cos(b), y, r * Math.sin(b)
        )
      }
    }

    // Longitude lines (every 30°)
    for (let lon = 0; lon < 360; lon += LON_STEP) {
      const theta = (lon + 180) * (Math.PI / 180)

      for (let i = 0; i < SEGMENTS; i++) {
        const p1 = (i / SEGMENTS) * Math.PI
        const p2 = ((i + 1) / SEGMENTS) * Math.PI
        positions.push(
          -RADIUS * Math.sin(p1) * Math.cos(theta), RADIUS * Math.cos(p1), RADIUS * Math.sin(p1) * Math.sin(theta),
          -RADIUS * Math.sin(p2) * Math.cos(theta), RADIUS * Math.cos(p2), RADIUS * Math.sin(p2) * Math.sin(theta)
        )
      }
    }

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geom
  }, [])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#06b6d4" transparent opacity={0.15} depthWrite={false} />
    </lineSegments>
  )
}
