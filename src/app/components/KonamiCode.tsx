'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'

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

// Touch swipe version: up, up, down, down, left, right, left, right, tap, tap
const SWIPE_SEQUENCE = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'tap', 'tap']
const SWIPE_THRESHOLD = 30 // px minimum swipe distance
const SWIPE_TIMEOUT = 3000 // ms to complete the sequence

const DURATION = 6000
const COLUMN_COUNT = 50
const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲン0123456789ABCDEF'

interface RainDrop {
  x: number
  speed: number
  chars: string[]
  offset: number
}

export const KonamiCode: React.FC = () => {
  const [activated, setActivated] = useState(false)
  const keysRef = useRef<string[]>([])
  const swipesRef = useRef<string[]>([])
  const swipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const dropsRef = useRef<RainDrop[]>([])

  const activate = useCallback(() => {
    setActivated(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setActivated(false)
      timerRef.current = null
    }, DURATION)
  }, [])

  const startRain = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const fontSize = Math.floor(canvas.width / COLUMN_COUNT)
    const columns = Math.ceil(canvas.width / fontSize)

    // Initialize drops
    dropsRef.current = Array.from({ length: columns }, (_, i) => ({
      x: i,
      speed: 0.3 + Math.random() * 0.7,
      chars: Array.from({ length: 30 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]),
      offset: -Math.random() * 30,
    }))

    let lastTime = 0

    const draw = (time: number) => {
      const delta = time - lastTime
      if (delta < 33) {
        animRef.current = requestAnimationFrame(draw)
        return
      }
      lastTime = time

      // Fade trail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.font = `${fontSize}px monospace`

      for (const drop of dropsRef.current) {
        drop.offset += drop.speed

        for (let j = 0; j < drop.chars.length; j++) {
          const y = (drop.offset - j) * fontSize
          if (y < -fontSize || y > canvas.height + fontSize) continue

          // Head char is bright white-green, rest fade to darker green
          if (j === 0) {
            ctx.fillStyle = '#ffffff'
            ctx.shadowColor = '#00ff41'
            ctx.shadowBlur = 10
          } else {
            const alpha = Math.max(0, 1 - j / drop.chars.length)
            const g = Math.floor(180 + 75 * (1 - j / drop.chars.length))
            ctx.fillStyle = `rgba(0, ${g}, 65, ${alpha})`
            ctx.shadowBlur = 0
          }

          // Occasionally randomize a character
          if (Math.random() < 0.02) {
            drop.chars[j] = CHARS[Math.floor(Math.random() * CHARS.length)]
          }

          ctx.fillText(drop.chars[j], drop.x * fontSize, y)
        }

        // Reset when fully off screen
        if ((drop.offset - drop.chars.length) * fontSize > canvas.height) {
          drop.offset = -Math.random() * 20
          drop.speed = 0.3 + Math.random() * 0.7
        }
      }

      ctx.shadowBlur = 0
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
  }, [])

  const stopRain = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
      animRef.current = 0
    }
  }, [])

  // Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current = [...keysRef.current, e.key].slice(-KONAMI_SEQUENCE.length)

      if (
        keysRef.current.length === KONAMI_SEQUENCE.length &&
        keysRef.current.every((key, i) => key === KONAMI_SEQUENCE[i])
      ) {
        keysRef.current = []
        activate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
      stopRain()
    }
  }, [stopRain, activate])

  // Touch swipe listener
  useEffect(() => {
    const resetSwipeSequence = () => {
      swipesRef.current = []
      if (swipeTimerRef.current) {
        clearTimeout(swipeTimerRef.current)
        swipeTimerRef.current = null
      }
    }

    const addSwipe = (direction: string) => {
      // Reset timeout — user has 3s between gestures
      if (swipeTimerRef.current) clearTimeout(swipeTimerRef.current)
      swipeTimerRef.current = setTimeout(resetSwipeSequence, SWIPE_TIMEOUT)

      swipesRef.current = [...swipesRef.current, direction].slice(-SWIPE_SEQUENCE.length)

      if (
        swipesRef.current.length === SWIPE_SEQUENCE.length &&
        swipesRef.current.every((s, i) => s === SWIPE_SEQUENCE[i])
      ) {
        resetSwipeSequence()
        activate()
      }
    }

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      const elapsed = Date.now() - touchStartRef.current.time
      touchStartRef.current = null

      // Must complete within 500ms
      if (elapsed > 500) return

      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
        // Tap
        addSwipe('tap')
      } else if (absDx > absDy) {
        // Horizontal swipe
        addSwipe(dx > 0 ? 'right' : 'left')
      } else {
        // Vertical swipe
        addSwipe(dy > 0 ? 'down' : 'up')
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
      if (swipeTimerRef.current) clearTimeout(swipeTimerRef.current)
    }
  }, [activate])

  // Start/stop rain when activated changes
  useEffect(() => {
    if (activated) {
      startRain()
    } else {
      stopRain()
    }
  }, [activated, startRain, stopRain])

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 9999,
        opacity: activated ? 1 : 0,
        transition: activated ? 'opacity 0.3s ease-in' : 'opacity 1s ease-out',
      }}
    >
      {/* Matrix rain canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Center message */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="text-center"
          style={{
            opacity: activated ? 1 : 0,
            transform: activated ? 'scale(1)' : 'scale(0.8)',
            transition: 'all 0.5s ease-out 0.3s',
          }}
        >
          <div
            style={{
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: 'clamp(1.5rem, 4vw, 3rem)',
              fontWeight: 'bold',
              color: '#00ff41',
              textShadow: '0 0 10px #00ff41, 0 0 30px #00ff41, 0 0 60px #003300',
              letterSpacing: '0.15em',
            }}
          >
            ENTER THE MATRIX
          </div>
          <div
            className="mt-3"
            style={{
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: 'clamp(0.7rem, 1.5vw, 1.1rem)',
              color: '#00ff41',
              textShadow: '0 0 8px #00ff41',
              letterSpacing: '0.2em',
              opacity: 0.7,
            }}
          >
            FOLLOW THE WHITE PACKET
          </div>
        </div>
      </div>
    </div>
  )
}
