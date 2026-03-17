'use client'

import React from 'react'
import { useTraceStore } from '../../store/traceStore'

export const TargetPanel: React.FC = () => {
  const target = useTraceStore((s) => s.target)
  const status = useTraceStore((s) => s.status)

  if (status === 'idle') return null

  return (
    <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/15 rounded-md p-2 md:p-3 mb-0 md:mb-2">
      <div className="text-[10px] text-orange-400 uppercase tracking-widest mb-2 border-b border-orange-400/20 pb-1">
        Target
      </div>
      {target ? (
        <div className="space-y-1 text-xs">
          <div className="text-white font-mono">{target.ip}</div>
          {target.hostname !== target.ip && (
            <div className="text-gray-400">{target.hostname}</div>
          )}
          <div className="text-gray-500">
            {target.city}, {target.country}
          </div>
          <div className="text-gray-600 text-[10px]">{target.org}</div>
        </div>
      ) : (
        <div className="text-gray-600 text-xs animate-pulse">Resolving...</div>
      )}
    </div>
  )
}
