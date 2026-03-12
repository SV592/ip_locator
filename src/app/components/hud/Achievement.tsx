'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useTraceStore } from '../../store/traceStore'

const MILESTONES: { threshold: number; message: string }[] = [
  { threshold: 10, message: 'Novice Tracer \u2014 10 traces completed' },
  { threshold: 25, message: 'Route Explorer \u2014 25 traces completed' },
  { threshold: 50, message: 'Packet Veteran \u2014 50 traces completed' },
  { threshold: 100, message: 'Network Legend \u2014 100 traces completed' },
]

export const Achievement: React.FC = () => {
  const searchHistory = useTraceStore((s) => s.searchHistory)
  const [achievement, setAchievement] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const lastShownMilestone = useRef(0)

  useEffect(() => {
    const count = searchHistory.length

    for (const milestone of MILESTONES) {
      if (count >= milestone.threshold && milestone.threshold > lastShownMilestone.current) {
        lastShownMilestone.current = milestone.threshold
        setAchievement(milestone.message)
        setVisible(true)

        const timer = setTimeout(() => {
          setVisible(false)
          setTimeout(() => setAchievement(null), 500)
        }, 4000)

        return () => clearTimeout(timer)
      }
    }
  }, [searchHistory.length])

  if (!achievement) return null

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div
        style={{
          transition: 'all 0.5s ease-out',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
        }}
      >
        <div className="bg-black/80 backdrop-blur-sm border border-amber-400/40 rounded-lg px-5 py-3 text-center shadow-lg shadow-amber-500/10">
          <div className="text-amber-400 text-[10px] uppercase tracking-widest mb-1">
            Achievement Unlocked
          </div>
          <div className="text-white text-sm font-medium">{achievement}</div>
        </div>
      </div>
    </div>
  )
}
