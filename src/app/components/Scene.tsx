'use client'
import React, { Suspense, useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import { CameraController } from './CameraController'

import { Stars } from './Stars'
import { Countries } from './Countries'
import { States } from './States'
import { Sun } from './Sun'
import { Moon } from './Moon'
import { Earth } from './Earth'
import { HopMarkers } from './HopMarkers'
import { RouteArcs } from './RouteArcs'
import { ArcParticles } from './ArcParticles'
import { PerfMonitor } from './PerfMonitor'

const Scene: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null)

  return (
    <Canvas camera={{ position: [20, 15, 20], fov: 60 }}>
      <Suspense fallback={null}>
        <Sun
          intensity={2}
          radius={5}
          enableOrbit={true}
          orbitRadius={50}
          orbitSpeed={0.02}
        />

        <Moon
          intensity={0.3}
          radius={0.54}
          enableOrbit={true}
          orbitRadius={8}
          orbitSpeed={0.1}
          orbitTilt={0.089}
        />
        <ambientLight intensity={0.1} />

        <Earth />
        <Countries />
        <States />
        <HopMarkers />
        <RouteArcs />
        <ArcParticles />

        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          target={[0, 0, 0]}
          maxDistance={100}
          minDistance={5}
        />
        <CameraController controlsRef={controlsRef} />
        <PerfMonitor />

        <Stars />
        <color attach="background" args={['#000000']} />
      </Suspense>
    </Canvas>
  )
}

export default Scene
