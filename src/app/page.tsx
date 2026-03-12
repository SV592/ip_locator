'use client'
import React from 'react'

import Scene from './components/Scene'
import { HUD } from './components/HUD'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'

export default function Home() {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Canvas background */}
      <div className="absolute inset-0">
        <SceneErrorBoundary>
          <Scene />
        </SceneErrorBoundary>
      </div>

      {/* HUD overlay */}
      <HUD />
    </div>
  )
}
