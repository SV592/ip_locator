'use client'

import React, { useEffect, useState } from 'react'
import { useTraceStore } from '../../store/traceStore'

const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'

function useGlitchText(text: string, active: boolean) {
  const [display, setDisplay] = useState(text)

  useEffect(() => {
    if (!active) { setDisplay(text); return }

    let frame = 0
    const id = setInterval(() => {
      frame++
      // Every few frames, corrupt 1-3 random chars
      if (frame % 3 === 0) {
        const chars = text.split('')
        const corruptions = 1 + Math.floor(Math.random() * 2)
        for (let c = 0; c < corruptions; c++) {
          const idx = Math.floor(Math.random() * chars.length)
          chars[idx] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
        }
        setDisplay(chars.join(''))
      } else {
        setDisplay(text)
      }
    }, 80)

    return () => clearInterval(id)
  }, [text, active])

  return display
}

export const CommandBar: React.FC = () => {
  const status = useTraceStore((s) => s.status)
  const error = useTraceStore((s) => s.error)
  const clearTrace = useTraceStore((s) => s.clearTrace)
  const hops = useTraceStore((s) => s.hops)
  const isReplaying = useTraceStore((s) => s.isReplaying)
  const startReplay = useTraceStore((s) => s.startReplay)
  const stopReplay = useTraceStore((s) => s.stopReplay)

  const isError = status === 'error'

  const statusText =
    status === 'idle'
      ? 'READY'
      : status === 'tracing'
        ? `TRACING \u00b7 ${hops.length} hops`
        : status === 'complete'
          ? `COMPLETE \u00b7 ${hops.length} hops`
          : 'SYSTEM FAULT'

  const glitchedStatus = useGlitchText(statusText, isError)
  const glitchedError = useGlitchText(error || '', isError)

  return (
    <div
      className="flex items-center justify-between backdrop-blur-sm px-3 md:px-4 py-2 transition-all duration-300"
      style={{
        background: isError ? 'rgba(127,29,29,0.15)' : 'rgba(0,0,0,0.6)',
        borderTop: isError
          ? '1px solid rgba(239,68,68,0.3)'
          : '1px solid rgba(6,182,212,0.1)',
        ...(isError ? { animation: 'cmdBarFlicker 4s infinite' } : {}),
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            status === 'tracing'
              ? 'bg-orange-400 animate-pulse'
              : status === 'complete'
                ? 'bg-green-400'
                : isError
                  ? 'bg-red-500'
                  : 'bg-gray-600'
          }`}
          style={isError ? { boxShadow: '0 0 6px rgba(239,68,68,0.8)', animation: 'errorDotPulse 1s ease-in-out infinite' } : {}}
        />
        <span
          className="text-[11px] md:text-[10px] uppercase tracking-wider font-mono"
          style={{
            color: isError ? 'rgba(248,113,113,0.9)' : 'rgba(156,163,175,1)',
            ...(isError ? { textShadow: '0 0 8px rgba(239,68,68,0.4)' } : {}),
          }}
        >
          {glitchedStatus}
        </span>
        {error && (
          <span
            className="text-[10px] font-mono ml-1 truncate max-w-[140px] md:max-w-[280px]"
            style={{
              color: 'rgba(252,165,165,0.7)',
            }}
          >
            {glitchedError}
          </span>
        )}
      </div>

      {status !== 'idle' && (
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {status === 'complete' && (
            <button
              onClick={isReplaying ? stopReplay : startReplay}
              className={`text-[11px] md:text-[10px] uppercase tracking-wider transition-colors font-mono cursor-pointer px-1 py-1 ${
                isReplaying
                  ? 'text-orange-400 hover:text-orange-300'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {isReplaying ? 'stop tour' : 'replay'}
            </button>
          )}
          {isError && (
            <button
              onClick={() => {
                const input = useTraceStore.getState().traceInput
                if (input) {
                  clearTrace()
                  // Small delay so clearTrace resets to idle before re-tracing
                  setTimeout(() => {
                    useTraceStore.getState().startTrace(input)
                  }, 100)
                }
              }}
              className="text-[11px] md:text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wider transition-colors font-mono cursor-pointer px-1 py-1"
              style={{ textShadow: '0 0 6px rgba(239,68,68,0.3)' }}
            >
              retry
            </button>
          )}
          <button
            onClick={clearTrace}
            className="text-[11px] md:text-[10px] text-gray-500 hover:text-white uppercase tracking-wider transition-colors cursor-pointer px-1 py-1"
          >
            {isError ? 'dismiss' : 'clear'}
          </button>
        </div>
      )}

      <style>{`
        @keyframes cmdBarFlicker {
          0%, 95%, 100% { opacity: 1; }
          96% { opacity: 0.7; }
          97% { opacity: 1; }
          98% { opacity: 0.5; }
          99% { opacity: 0.9; }
        }
        @keyframes errorDotPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(239,68,68,0.8); }
          50% { opacity: 0.4; box-shadow: 0 0 2px rgba(239,68,68,0.3); }
        }
      `}</style>
    </div>
  )
}
