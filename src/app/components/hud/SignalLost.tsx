'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useTraceStore } from '../../store/traceStore'

export const SignalLost: React.FC = () => {
  const [offline, setOffline] = useState(false)
  const [visible, setVisible] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const status = useTraceStore((s) => s.status)
  const failTrace = useTraceStore((s) => s.failTrace)

  // Track online/offline events
  useEffect(() => {
    const goOffline = () => {
      setOffline(true)
      // If actively tracing, fail the trace
      if (status === 'tracing') {
        failTrace('Connection lost — signal interrupted')
      }
    }
    const goOnline = () => setOffline(false)

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    // Check initial state
    if (!navigator.onLine) setOffline(true)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [status, failTrace])

  // Animate visibility with delay
  useEffect(() => {
    if (offline) {
      setVisible(true)
    } else {
      const timeout = setTimeout(() => setVisible(false), 800)
      return () => clearTimeout(timeout)
    }
  }, [offline])

  // Static noise canvas
  const drawNoise = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 200
    canvas.height = 100

    const draw = () => {
      const imageData = ctx.createImageData(canvas.width, canvas.height)
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() * 40
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        data[i + 3] = Math.random() * 120
      }
      ctx.putImageData(imageData, 0, 0)
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    if (visible) {
      drawNoise()
    } else {
      cancelAnimationFrame(animRef.current)
    }
    return () => cancelAnimationFrame(animRef.current)
  }, [visible, drawNoise])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
      style={{
        opacity: offline ? 1 : 0,
        transition: 'opacity 0.8s ease-out',
      }}
    >
      {/* Dark vignette overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Center panel */}
      <div className="relative flex flex-col items-center gap-4">
        {/* Static noise canvas (clipped to circle) */}
        <div
          className="w-16 h-16 rounded-full overflow-hidden border"
          style={{ borderColor: 'rgba(239,68,68,0.3)' }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ objectFit: 'cover' }}
          />
        </div>

        {/* Signal lost text */}
        <div className="text-center">
          <div
            className="text-lg font-mono font-bold tracking-[0.3em] uppercase"
            style={{
              color: 'rgba(239,68,68,0.9)',
              textShadow: '0 0 15px rgba(239,68,68,0.4)',
              animation: 'signalPulse 2s ease-in-out infinite',
            }}
          >
            Signal Lost
          </div>
          <div
            className="text-[10px] font-mono tracking-widest uppercase mt-2"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            {offline ? 'Attempting to reconnect...' : 'Signal restored'}
          </div>
        </div>

        {/* Scanning bars */}
        <div className="flex gap-1 mt-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-1 rounded-full"
              style={{
                height: `${8 + i * 4}px`,
                background: offline
                  ? `rgba(239,68,68,${0.2 + Math.random() * 0.3})`
                  : `rgba(74,222,128,${0.3 + i * 0.15})`,
                animation: offline ? `barFlicker ${0.3 + Math.random() * 0.5}s infinite` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes signalPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes barFlicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  )
}
