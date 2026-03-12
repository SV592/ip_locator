'use client'

import React, { useEffect, useRef } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  // Starfield background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      alpha: Math.random() * 0.8 + 0.2,
      drift: (Math.random() - 0.5) * 0.15,
    }))

    let frame = 0
    let animId = 0

    const draw = () => {
      frame++
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      for (const s of stars) {
        s.y += s.drift
        if (s.y < 0) s.y = canvas.height
        if (s.y > canvas.height) s.y = 0

        const flicker = 0.6 + 0.4 * Math.sin(frame * 0.02 + s.x)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.alpha * flicker})`
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
        {/* Glitch title */}
        <div className="relative mb-6">
          <h1
            className="text-5xl md:text-7xl font-mono font-bold tracking-wider"
            style={{
              color: '#ff4444',
              textShadow: '0 0 20px rgba(255,68,68,0.5), 0 0 60px rgba(255,68,68,0.2)',
              animation: 'errorGlitch 3s infinite',
            }}
          >
            HOUSTON
          </h1>
          <p
            className="text-lg md:text-xl font-mono mt-2 tracking-[0.3em]"
            style={{
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            WE HAVE A PROBLEM
          </p>
        </div>

        {/* Error telemetry box */}
        <div
          className="max-w-lg w-full rounded border px-5 py-4 mb-8 text-left font-mono"
          style={{
            background: 'rgba(255,68,68,0.05)',
            borderColor: 'rgba(255,68,68,0.2)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-red-400 uppercase tracking-widest">
              system fault detected
            </span>
          </div>
          <p className="text-red-300/80 text-sm leading-relaxed break-words">
            {error.message || 'An unexpected system failure occurred'}
          </p>
          {error.digest && (
            <p className="text-red-400/40 text-[10px] mt-2 tracking-wider">
              DIGEST: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded font-mono text-sm uppercase tracking-widest transition-all duration-200 border cursor-pointer"
            style={{
              color: '#f97316',
              borderColor: 'rgba(249,115,22,0.3)',
              background: 'rgba(249,115,22,0.05)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(249,115,22,0.15)'
              e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(249,115,22,0.05)'
              e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'
            }}
          >
            Reboot systems
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2.5 rounded font-mono text-sm uppercase tracking-widest transition-all duration-200 border cursor-pointer"
            style={{
              color: 'rgba(255,255,255,0.5)',
              borderColor: 'rgba(255,255,255,0.1)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            }}
          >
            Return to base
          </button>
        </div>

        {/* Bottom telemetry */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <span
            className="text-[9px] font-mono tracking-[0.3em] uppercase"
            style={{ color: 'rgba(255,255,255,0.15)' }}
          >
            Mission Control &middot; Error Recovery Protocol
          </span>
        </div>
      </div>

      <style>{`
        @keyframes errorGlitch {
          0%, 90%, 100% { transform: translate(0); }
          92% { transform: translate(-3px, 1px); filter: hue-rotate(90deg); }
          94% { transform: translate(3px, -1px); filter: hue-rotate(-90deg); }
          96% { transform: translate(-1px, 2px); }
          98% { transform: translate(2px, -1px); filter: hue-rotate(45deg); }
        }
      `}</style>
    </div>
  )
}
