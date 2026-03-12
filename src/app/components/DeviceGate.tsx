'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Scene from './Scene'
import { HUD } from './HUD'
import { SceneErrorBoundary } from './SceneErrorBoundary'

const MobileView = dynamic(() => import('./MobileView'), { ssr: false })

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    return !!gl
  } catch {
    return false
  }
}

export const DeviceGate: React.FC = () => {
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null)

  useEffect(() => {
    setHasWebGL(detectWebGL())
  }, [])

  if (hasWebGL === null) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-500/40 text-xs font-mono animate-pulse">initializing...</div>
      </div>
    )
  }

  if (!hasWebGL) {
    return <MobileView />
  }

  return (
    <>
      <div className="absolute inset-0">
        <SceneErrorBoundary>
          <Scene />
        </SceneErrorBoundary>
      </div>
      <HUD />
    </>
  )
}
