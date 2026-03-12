'use client'

import React, { useState } from 'react'
import { useTraceStore } from '../../store/traceStore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEarthAmericas, faRoute, faBezierCurve, faBolt, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

const features: { icon: IconDefinition; color: string; title: string; desc: string }[] = [
  {
    icon: faEarthAmericas,
    color: 'text-cyan-400',
    title: '3D Globe Visualization',
    desc: 'Watch your packets travel across a real-time 3D Earth with city lights, clouds, and atmospheric glow.',
  },
  {
    icon: faRoute,
    color: 'text-orange-400',
    title: 'Live Traceroute',
    desc: 'Enter any IP address or domain to trace the network path \u2014 each hop is plotted on the globe as it arrives.',
  },
  {
    icon: faBezierCurve,
    color: 'text-purple-400',
    title: 'Animated Route Arcs',
    desc: 'Color-coded arcs connect each hop, with flowing particles showing the direction of travel.',
  },
  {
    icon: faBolt,
    color: 'text-yellow-400',
    title: 'RTT Analysis',
    desc: 'Latency is color-coded green \u2192 yellow \u2192 red so you can spot slow hops at a glance.',
  },
  {
    icon: faClockRotateLeft,
    color: 'text-emerald-400',
    title: 'Export & History',
    desc: 'Export trace results as JSON and revisit previous traces from the history panel.',
  },
]

export const InfoPanel: React.FC = () => {
  const status = useTraceStore((s) => s.status)
  const [collapsed, setCollapsed] = useState(false)

  // Hide when a trace is active
  if (status !== 'idle') return null

  return (
    <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/15 rounded-md overflow-hidden">
      {/* Tab header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex justify-between items-center p-3 border-b border-orange-400/20 hover:bg-white/5 transition-colors"
      >
        <div className="text-[10px] text-orange-400 uppercase tracking-widest">
          About
        </div>
        <span className="text-gray-600 text-[10px]">
          {collapsed ? '+' : '\u2212'}
        </span>
      </button>

      {!collapsed && (
        <div className="p-3 space-y-3">
          {/* Hero blurb */}
          <div className="text-[11px] text-gray-300 leading-relaxed">
            Visualize how your internet traffic travels around the world. Type an IP address or domain above to begin.
          </div>

          {/* Feature list */}
          <div className="space-y-2.5">
            {features.map((f) => (
              <div key={f.title} className="flex gap-2.5 items-start">
                <span className={`mt-0.5 shrink-0 w-5 text-center text-xs ${f.color}`}>
                  <FontAwesomeIcon icon={f.icon} />
                </span>
                <div>
                  <div className="text-[11px] text-white font-medium">{f.title}</div>
                  <div className="text-[10px] text-gray-500 leading-relaxed">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick start hint */}
          <div className="pt-2 border-t border-white/5">
            <div className="text-[10px] text-gray-600 italic">
              Try tracing <span className="text-cyan-500/70 font-mono not-italic">8.8.8.8</span> or <span className="text-cyan-500/70 font-mono not-italic">cloudflare.com</span> to get started.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
