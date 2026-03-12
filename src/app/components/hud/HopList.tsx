'use client'

import React from 'react'
import { useTraceStore } from '../../store/traceStore'
import { getRttTextClass } from '../../utils/rttColor'

export const HopList: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)
  const selectedHopIndex = useTraceStore((s) => s.selectedHopIndex)
  const selectHop = useTraceStore((s) => s.selectHop)
  const hoverHop = useTraceStore((s) => s.hoverHop)
  const status = useTraceStore((s) => s.status)
  const traceInput = useTraceStore((s) => s.traceInput)

  const isLocalhost = ['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(
    traceInput?.trim().toLowerCase() ?? ''
  )

  if (status === 'idle') return null

  return (
    <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/15 rounded-md p-3 max-h-[40vh] overflow-y-auto hud-scrollbar">
      <div className="text-[10px] text-orange-400 uppercase tracking-widest mb-2 border-b border-orange-400/20 pb-1">
        Route
      </div>
      <div className="space-y-0.5">
        {isLocalhost && (status === 'complete' || status === 'tracing') && (
          <div className="text-[10px] text-red-400/80 font-mono italic px-2 py-1.5 border-b border-red-500/20 mb-1">
            The packets are coming from inside the house!
          </div>
        )}
        {hops.map((hop, i) => {
          const avgRtt = hop.rtt.filter((r): r is number => r !== null)
          const avg = avgRtt.length > 0 ? avgRtt.reduce((a, b) => a + b, 0) / avgRtt.length : null
          const isSelected = selectedHopIndex === i

          return (
            <div
              key={i}
              onClick={() => selectHop(isSelected ? null : i)}
              onMouseEnter={() => hoverHop(i)}
              onMouseLeave={() => hoverHop(null)}
              className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-orange-500/20 border border-orange-500/30'
                  : 'hover:bg-white/5'
              }`}
            >
              <span className="text-gray-600 w-5 text-right font-mono">{hop.hop}</span>
              <span className="text-white font-mono flex-1 truncate">
                {hop.ip === '*' ? '* * *' : hop.ip}
              </span>
              <span
                className={`font-mono ${getRttTextClass(avg)}`}
                {...(avg !== null && avg < 1 ? { title: 'Faster than light!' } : {})}
              >
                {avg !== null ? `${Math.round(avg)}ms${avg < 1 ? ' ⚡' : ''}` : '\u2014'}
              </span>
              {hop.location?.country_code && (
                <span className="text-gray-500 text-[9px]">{hop.location.country_code}</span>
              )}
            </div>
          )
        })}
        {status === 'tracing' && (
          <div className="text-gray-600 text-[10px] animate-pulse px-2 py-1">Tracing...</div>
        )}
      </div>
    </div>
  )
}
