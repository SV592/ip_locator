'use client'

import React, { useState, type FormEvent } from 'react'
import { useTrace } from '../hooks/useTrace'
import { useTraceStore } from '../store/traceStore'

export const SearchBar: React.FC = () => {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const { trace, abort, isTracing } = useTrace()
  const status = useTraceStore((s) => s.status)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return

    if (isTracing) {
      abort()
    } else {
      trace(trimmed)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative max-w-md w-full mx-auto group"
    >
      {/* Outer glow on focus/tracing */}
      <div
        className={`absolute -inset-[1px] rounded-md transition-opacity duration-300 ${
          isTracing
            ? 'opacity-100'
            : isFocused
              ? 'opacity-60'
              : 'opacity-0'
        }`}
        style={{
          background: isTracing
            ? 'linear-gradient(135deg, rgba(249,115,22,0.3), rgba(234,88,12,0.1))'
            : 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(249,115,22,0.1))',
          filter: 'blur(4px)',
        }}
      />

      {/* Main container */}
      <div
        className={`relative flex items-center bg-black/60 backdrop-blur-sm border rounded-md transition-colors duration-200 ${
          isTracing
            ? 'border-orange-500/40'
            : isFocused
              ? 'border-cyan-500/30'
              : 'border-cyan-500/15'
        }`}
      >
        {/* Label */}
        <div className="text-[9px] text-orange-400/70 uppercase tracking-[0.2em] absolute -top-2 left-3 bg-black/80 px-1.5 font-mono">
          target
        </div>

        {/* Scan line indicator */}
        <div className="flex items-center pl-3.5 pr-2">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isTracing
                ? 'bg-orange-400 animate-pulse'
                : status === 'complete'
                  ? 'bg-green-400'
                  : status === 'error'
                    ? 'bg-red-400'
                    : 'bg-cyan-500/40'
            }`}
          />
        </div>

        {/* Input */}
        <input
          type="text"
          inputMode="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="0.0.0.0"
          spellCheck={false}
          className="flex-1 bg-transparent text-white/90 placeholder-white/15 py-2.5 text-sm font-mono tracking-wide focus:outline-none"
        />

        {/* Divider */}
        <div className="w-px h-5 bg-cyan-500/15 mr-1" />

        {/* Action button */}
        <button
          type="submit"
          className={`px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-all duration-200 whitespace-nowrap rounded-r-md ${
            isTracing
              ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
              : 'text-orange-400/80 hover:text-orange-300 hover:bg-orange-500/10'
          }`}
        >
          {isTracing ? 'abort' : 'trace'}
        </button>
      </div>
    </form>
  )
}
