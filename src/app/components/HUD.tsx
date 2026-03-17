'use client'

import React, { useState } from 'react'
import { SearchBar } from './SearchBar'
import { TargetPanel } from './hud/TargetPanel'
import { StatsPanel } from './hud/StatsPanel'
import { HopList } from './hud/HopList'
import { CommandBar } from './hud/CommandBar'
import { LocationDetail } from './hud/LocationDetail'
import { HistoryPanel } from './hud/HistoryPanel'
import { InfoPanel } from './hud/InfoPanel'
import { KonamiCode } from './KonamiCode'
import { Achievement } from './hud/Achievement'
import { SignalLost } from './hud/SignalLost'
import { useTraceStore } from '../store/traceStore'

export const HUD: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const status = useTraceStore((s) => s.status)
  const hops = useTraceStore((s) => s.hops)

  const hasData = status !== 'idle'

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col">
      {/* Top: SearchBar */}
      <div className="pointer-events-auto pt-3 md:pt-4 px-3 md:px-4 flex justify-center">
        <SearchBar />
      </div>

      {/* Desktop: Side panels */}
      <div className="hidden md:flex flex-1 justify-between items-start p-4 gap-4">
        {/* Left panels */}
        <div className="pointer-events-auto w-64 space-y-2">
          <InfoPanel />
          <TargetPanel />
          <StatsPanel />
          <HistoryPanel />
        </div>

        {/* Right panels */}
        <div className="pointer-events-auto w-72 space-y-2">
          <HopList />
          <LocationDetail />
        </div>
      </div>

      {/* Mobile: Bottom drawer toggle */}
      {hasData && (
        <div className="md:hidden flex-1" />
      )}
      {hasData && (
        <div className="md:hidden pointer-events-auto">
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-black/70 backdrop-blur-sm border-t border-cyan-500/15"
          >
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${
                status === 'tracing' ? 'bg-orange-400 animate-pulse'
                  : status === 'complete' ? 'bg-green-400'
                  : status === 'error' ? 'bg-red-500'
                  : 'bg-gray-600'
              }`} />
              <span className="text-xs text-gray-300 font-mono uppercase tracking-wider">
                {status === 'tracing' ? `Tracing · ${hops.length} hops` : `${hops.length} hops`}
              </span>
            </div>
            <span className="text-gray-500 text-lg leading-none">
              {drawerOpen ? '▾' : '▴'}
            </span>
          </button>
        </div>
      )}

      {/* Mobile: Drawer content */}
      {hasData && drawerOpen && (
        <div className="md:hidden pointer-events-auto bg-black/80 backdrop-blur-md border-t border-cyan-500/15 max-h-[60vh] overflow-y-auto hud-scrollbar">
          <div className="p-3 space-y-2">
            <TargetPanel />
            <StatsPanel />
            <HopList />
            <LocationDetail />
            <HistoryPanel />
          </div>
        </div>
      )}

      {/* Mobile: InfoPanel when idle */}
      {!hasData && (
        <div className="md:hidden pointer-events-auto px-3 pb-3 mt-auto">
          <InfoPanel />
        </div>
      )}

      {/* Bottom: Command bar */}
      <div className="pointer-events-auto">
        <CommandBar />
      </div>
      <Achievement />
      <KonamiCode />
      <SignalLost />
    </div>
  )
}
