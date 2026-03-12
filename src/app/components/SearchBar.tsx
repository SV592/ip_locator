'use client'

import React, { useState, type FormEvent } from 'react'
import { useTrace } from '../hooks/useTrace'

export const SearchBar: React.FC = () => {
  const [input, setInput] = useState('')
  const { trace, abort, isTracing } = useTrace()

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
      className="flex items-center gap-0 rounded-full overflow-hidden border border-orange-500/40 bg-black/60 backdrop-blur-md max-w-lg w-full mx-auto"
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter IP or domain..."
        className="flex-1 bg-transparent text-white placeholder-gray-500 px-5 py-3 text-sm focus:outline-none"
      />
      <button
        type="submit"
        className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
          isTracing
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-orange-500 hover:bg-orange-600 text-black'
        }`}
      >
        {isTracing ? 'STOP' : 'TRACE'}
      </button>
    </form>
  )
}
