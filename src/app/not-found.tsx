'use client'

import React, { useEffect, useRef } from 'react'
import Link from 'next/link'

export default function NotFound() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Drifting starfield with a subtle pull toward center
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const cx = canvas.width / 2
    const cy = canvas.height / 2

    const stars = Array.from({ length: 300 }, () => {
      const angle = Math.random() * Math.PI * 2
      const dist = 50 + Math.random() * Math.max(canvas.width, canvas.height) * 0.6
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        r: Math.random() * 1.2 + 0.2,
        alpha: Math.random() * 0.6 + 0.2,
        speed: Math.random() * 0.08 + 0.02,
      }
    })

    let animId = 0
    let frame = 0

    const draw = () => {
      frame++
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      for (const s of stars) {
        // Slow spiral drift
        const dx = s.x - cx
        const dy = s.y - cy
        const angle = Math.atan2(dy, dx) + 0.001
        const dist = Math.sqrt(dx * dx + dy * dy) - s.speed
        s.x = cx + Math.cos(angle) * dist
        s.y = cy + Math.sin(angle) * dist

        // Reset when too close to center
        if (dist < 30) {
          const newAngle = Math.random() * Math.PI * 2
          const newDist = Math.max(canvas.width, canvas.height) * 0.5
          s.x = cx + Math.cos(newAngle) * newDist
          s.y = cy + Math.sin(newAngle) * newDist
        }

        const flicker = 0.7 + 0.3 * Math.sin(frame * 0.015 + s.x * 0.1)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(120,180,255,${s.alpha * flicker})`
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
        {/* Giant 404 */}
        <div className="relative mb-4">
          <span
            className="text-[8rem] md:text-[12rem] font-mono font-bold leading-none select-none"
            style={{
              color: 'transparent',
              WebkitTextStroke: '1px rgba(6,182,212,0.25)',
              textShadow: '0 0 80px rgba(6,182,212,0.1)',
              animation: 'notFoundFloat 6s ease-in-out infinite',
            }}
          >
            404
          </span>

          {/* Overlay 404 with glow */}
          <span
            className="absolute inset-0 flex items-center justify-center text-[8rem] md:text-[12rem] font-mono font-bold leading-none select-none"
            style={{
              color: 'rgba(6,182,212,0.08)',
              textShadow: '0 0 40px rgba(6,182,212,0.15), 0 0 80px rgba(6,182,212,0.05)',
              animation: 'notFoundFloat 6s ease-in-out infinite',
            }}
          >
            404
          </span>
        </div>

        <h1
          className="text-xl md:text-2xl font-mono tracking-[0.25em] uppercase mb-3"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          Lost in the void
        </h1>

        <p
          className="text-sm font-mono mb-10 max-w-md leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          The coordinates you requested don&apos;t map to any known sector.
          This route has no destination.
        </p>

        <Link
          href="/"
          className="px-8 py-3 rounded font-mono text-sm uppercase tracking-[0.2em] transition-all duration-300 border inline-block"
          style={{
            color: '#06b6d4',
            borderColor: 'rgba(6,182,212,0.25)',
            background: 'rgba(6,182,212,0.05)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(6,182,212,0.12)'
            e.currentTarget.style.borderColor = 'rgba(6,182,212,0.4)'
            e.currentTarget.style.boxShadow = '0 0 30px rgba(6,182,212,0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(6,182,212,0.05)'
            e.currentTarget.style.borderColor = 'rgba(6,182,212,0.25)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Navigate home
        </Link>

        {/* Bottom scan line */}
        <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden">
          <div
            className="h-full w-1/3"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.3), transparent)',
              animation: 'scanLine 4s linear infinite',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes notFoundFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes scanLine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}
