'use client'

import React, { useEffect, useRef, useState } from 'react'

const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]

export const KonamiCode: React.FC = () => {
  const [activated, setActivated] = useState(false)
  const keysRef = useRef<string[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current = [...keysRef.current, e.key].slice(-KONAMI_SEQUENCE.length)

      if (
        keysRef.current.length === KONAMI_SEQUENCE.length &&
        keysRef.current.every((key, i) => key === KONAMI_SEQUENCE[i])
      ) {
        keysRef.current = []
        setActivated(true)

        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          setActivated(false)
          timerRef.current = null
        }, 5000)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div
      className="fixed inset-0 pointer-events-none flex items-center justify-center"
      style={{
        zIndex: 9999,
        opacity: activated ? 1 : 0,
        transform: activated ? 'scale(1)' : 'scale(0.8)',
        transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
      }}
    >
      {/* Scanline overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15) 0px, rgba(0, 0, 0, 0.15) 1px, transparent 1px, transparent 3px)',
          pointerEvents: 'none',
        }}
      />

      {/* Pulsing gradient border */}
      <div
        className="absolute inset-0"
        style={{
          border: '4px solid transparent',
          background:
            'linear-gradient(#000, #000) padding-box, linear-gradient(45deg, #ff0080, #00ff80, #0080ff, #ff0080) border-box',
          backgroundSize: '400% 400%',
          animation: activated ? 'konamiGradient 2s ease infinite' : 'none',
          opacity: 0.8,
          pointerEvents: 'none',
        }}
      />

      {/* Centered content */}
      <div className="relative text-center">
        <div
          style={{
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '3rem',
            fontWeight: 'bold',
            color: '#00ff41',
            textShadow:
              '0 0 10px #00ff41, 0 0 20px #00ff41, 0 0 40px #00ff41, 0 0 80px #00ff41',
            letterSpacing: '0.15em',
            imageRendering: 'pixelated',
            animation: activated ? 'konamiPulse 1s ease-in-out infinite' : 'none',
          }}
        >
          CHEAT CODE ACTIVATED
        </div>
        <div
          className="mt-4"
          style={{
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '1.25rem',
            color: '#ff0080',
            textShadow: '0 0 8px #ff0080, 0 0 16px #ff0080',
            letterSpacing: '0.1em',
          }}
        >
          ALL YOUR PACKETS ARE BELONG TO US
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes konamiGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes konamiPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
