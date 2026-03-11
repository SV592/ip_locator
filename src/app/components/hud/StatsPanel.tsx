'use client'

import React from 'react'
import { useTraceStore } from '../../store/traceStore'

export const StatsPanel: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)
  const summary = useTraceStore((s) => s.summary)
  const status = useTraceStore((s) => s.status)

  if (status === 'idle') return null

  const respondingHops = hops.filter((h) => h.ip !== '*').length
  const countries = new Set(hops.filter((h) => h.location?.country_code).map((h) => h.location!.country_code))
  const rtts = hops.flatMap((h) => h.rtt.filter((r): r is number => r !== null))
  const avgRtt = rtts.length > 0 ? rtts.reduce((a, b) => a + b, 0) / rtts.length : 0

  const stats = summary || {
    totalHops: hops.length,
    respondingHops,
    countries: countries.size,
    averageRtt: Math.round(avgRtt * 10) / 10,
  }

  return (
    <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/15 rounded-md p-3">
      <div className="text-[10px] text-orange-400 uppercase tracking-widest mb-2 border-b border-orange-400/20 pb-1">
        Statistics
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-gray-500">Hops</div>
          <div className="text-white font-mono">{stats.totalHops}</div>
        </div>
        <div>
          <div className="text-gray-500">Responding</div>
          <div className="text-white font-mono">{stats.respondingHops}</div>
        </div>
        <div>
          <div className="text-gray-500">Countries</div>
          <div className="text-white font-mono">{stats.countries}</div>
        </div>
        <div>
          <div className="text-gray-500">Avg RTT</div>
          <div className="text-white font-mono">{stats.averageRtt} ms</div>
        </div>
      </div>
    </div>
  )
}
