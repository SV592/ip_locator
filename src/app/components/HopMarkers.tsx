'use client'

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useTraceStore } from '../store/traceStore'
import { latLonToVec3, EARTH_RADIUS } from '../utils/geoMath'
import { getRttColor } from '../utils/rttColor'

const _dummy = new THREE.Object3D()
const _up = new THREE.Vector3(0, 1, 0)
const _color = new THREE.Color()

const PULSE_DURATION = 800 // ms
const BASE_SCALE = 0.03
const SELECTED_SCALE = 0.05
const PULSE_PEAK_SCALE = 0.09

function createPinGeometry(): THREE.BufferGeometry {
  const points = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.12, 0.35),
    new THREE.Vector2(0.08, 0.55),
    new THREE.Vector2(0.35, 0.7),
    new THREE.Vector2(0.4, 0.85),
    new THREE.Vector2(0.35, 1.0),
    new THREE.Vector2(0, 1.1),
  ]
  return new THREE.LatheGeometry(points, 12)
}

function getAvgRtt(rtt: (number | null)[]): number | null {
  const valid = rtt.filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

export const HopMarkers: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)
  const selectedHopIndex = useTraceStore((s) => s.selectedHopIndex)
  const hoveredHopIndex = useTraceStore((s) => s.hoveredHopIndex)
  const hoverHop = useTraceStore((s) => s.hoverHop)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const pinGeometry = useMemo(() => createPinGeometry(), [])

  const geoHops = useMemo(
    () => hops.filter((h) => h.location && h.location.lat !== 0 && h.location.lon !== 0),
    [hops]
  )

  const positions = useMemo(
    () => geoHops.map((h) => latLonToVec3(h.location!.lat, h.location!.lon, EARTH_RADIUS * 1.005)),
    [geoHops]
  )

  useFrame(() => {
    if (!meshRef.current || positions.length === 0) return

    const now = Date.now()

    for (let i = 0; i < positions.length; i++) {
      _dummy.position.copy(positions[i])
      const dir = positions[i].clone().normalize()
      _dummy.quaternion.setFromUnitVectors(_up, dir)

      const hopIndex = hops.indexOf(geoHops[i])
      const isSelected = hopIndex === selectedHopIndex
      const isHovered = hopIndex === hoveredHopIndex

      const arrivedAt = geoHops[i].arrivedAt || 0
      const elapsed = now - arrivedAt
      let scale = isSelected ? SELECTED_SCALE : BASE_SCALE

      if (elapsed < PULSE_DURATION) {
        const t = elapsed / PULSE_DURATION
        const pulse = Math.sin(t * Math.PI) * (1 - t)
        scale = scale + (PULSE_PEAK_SCALE - scale) * pulse
      }

      if (isHovered && !isSelected) {
        scale = Math.max(scale, BASE_SCALE * 1.5)
      }

      _dummy.scale.setScalar(scale)
      _dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, _dummy.matrix)

      // Per-instance RTT color
      const avgRtt = getAvgRtt(geoHops[i].rtt)
      _color.set(getRttColor(avgRtt))
      meshRef.current.setColorAt(i, _color)
    }

    meshRef.current.count = positions.length
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (event.instanceId === undefined) return
    const geoHop = geoHops[event.instanceId]
    if (!geoHop) return
    const hopIndex = hops.indexOf(geoHop)
    hoverHop(hopIndex)
  }

  const handlePointerOut = () => {
    hoverHop(null)
  }

  // Compute tooltip data for the hovered hop (hidden when that hop is also selected)
  const hoveredGeoHop = useMemo(() => {
    if (hoveredHopIndex === null) return null
    const hop = hops[hoveredHopIndex]
    if (!hop) return null
    // Don't show tooltip when the LocationDetail panel is already showing for this hop
    if (hoveredHopIndex === selectedHopIndex) return null
    if (!hop.location || hop.location.lat === 0) return null
    return hop
  }, [hops, hoveredHopIndex, selectedHopIndex])

  const tooltipPosition = useMemo(() => {
    if (!hoveredGeoHop?.location) return null
    return latLonToVec3(hoveredGeoHop.location.lat, hoveredGeoHop.location.lon, EARTH_RADIUS * 1.02)
  }, [hoveredGeoHop])

  if (geoHops.length === 0) return null

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[pinGeometry, undefined, 30]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshBasicMaterial toneMapped={false} depthWrite={false} vertexColors />
      </instancedMesh>

      {hoveredGeoHop && tooltipPosition && (
        <Html
          position={tooltipPosition}
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[100, 0]}
        >
          <div className="bg-black/70 backdrop-blur-sm border border-cyan-500/30 rounded px-2 py-1 text-xs whitespace-nowrap">
            <div className="text-white font-mono">{hoveredGeoHop.ip}</div>
            {hoveredGeoHop.location?.city && (
              <div className="text-cyan-400">{hoveredGeoHop.location.city}</div>
            )}
          </div>
        </Html>
      )}
    </>
  )
}
