'use client'
import React from 'react'
import { DeviceGate } from './components/DeviceGate'

export default function Home() {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <DeviceGate />
    </div>
  )
}
