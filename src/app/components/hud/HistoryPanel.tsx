'use client'

import React from 'react'
import { useTraceStore } from '../../store/traceStore'
import { useTrace } from '../../hooks/useTrace'

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export const HistoryPanel: React.FC = () => {
  const searchHistory = useTraceStore((s) => s.searchHistory)
  const clearHistory = useTraceStore((s) => s.clearHistory)
  const { trace } = useTrace()

  if (searchHistory.length === 0) return null

  return (
    <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/15 rounded-md p-2 md:p-3 max-h-[25vh] md:max-h-[30vh] overflow-y-auto">
      <div className="text-[10px] text-orange-400 uppercase tracking-widest mb-2 border-b border-orange-400/20 pb-1">
        History
      </div>
      <div className="space-y-1">
        {searchHistory.map((entry) => (
          <div
            key={`${entry.input}-${entry.timestamp}`}
            onClick={() => trace(entry.input)}
            className="flex items-center justify-between gap-2 text-xs md:text-[11px] px-2 py-2 md:py-1.5 rounded cursor-pointer hover:bg-white/5 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-white font-mono truncate">{entry.input}</div>
              {entry.target && (
                <div className="text-gray-500 text-[9px] truncate">
                  {entry.target.city}, {entry.target.country}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-gray-600 text-[9px]">{entry.hopCount} hops</div>
              <div className="text-gray-600 text-[9px]">{formatRelativeTime(entry.timestamp)}</div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); clearHistory() }}
        className="mt-2 w-full text-[11px] md:text-[9px] text-gray-600 hover:text-red-400 uppercase tracking-wider transition-colors py-2 md:py-1 border-t border-cyan-500/10"
      >
        clear history
      </button>
    </div>
  )
}
