'use client'

import React from 'react'
import { SearchBar } from './SearchBar'
import { TargetPanel } from './hud/TargetPanel'
import { StatsPanel } from './hud/StatsPanel'
import { HopList } from './hud/HopList'
import { CommandBar } from './hud/CommandBar'
import { LocationDetail } from './hud/LocationDetail'
import { HistoryPanel } from './hud/HistoryPanel'

export const HUD: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col">
      {/* Top: SearchBar */}
      <div className="pointer-events-auto pt-4 px-4 flex justify-center">
        <SearchBar />
      </div>

      {/* Middle: Side panels */}
      <div className="flex-1 flex justify-between items-start p-4 gap-4">
        {/* Left panels */}
        <div className="pointer-events-auto w-64 space-y-2">
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

      {/* Bottom: Command bar */}
      <div className="pointer-events-auto">
        <CommandBar />
      </div>
    </div>
  )
}
