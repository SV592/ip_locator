'use client'

import React from 'react'
import { useTraceStore } from '../../store/traceStore'

export const CommandBar: React.FC = () => {
  const status = useTraceStore((s) => s.status)
  const error = useTraceStore((s) => s.error)
  const clearTrace = useTraceStore((s) => s.clearTrace)
  const hops = useTraceStore((s) => s.hops)

  const statusText =
    status === 'idle'
      ? 'READY'
      : status === 'tracing'
        ? `TRACING \u00b7 ${hops.length} hops`
        : status === 'complete'
          ? `COMPLETE \u00b7 ${hops.length} hops`
          : `ERROR`

  return (
    <div className="flex items-center justify-between bg-black/60 backdrop-blur-sm border-t border-cyan-500/10 px-4 py-2">
      <div className="flex items-center gap-2">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            status === 'tracing'
              ? 'bg-orange-400 animate-pulse'
              : status === 'complete'
                ? 'bg-green-400'
                : status === 'error'
                  ? 'bg-red-400'
                  : 'bg-gray-600'
          }`}
        />
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">
          {statusText}
        </span>
        {error && <span className="text-[10px] text-red-400 ml-2">{error}</span>}
      </div>

      {status !== 'idle' && (
        <button
          onClick={clearTrace}
          className="text-[10px] text-gray-500 hover:text-white uppercase tracking-wider transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}
