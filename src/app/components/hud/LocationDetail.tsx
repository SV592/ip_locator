'use client'

import React, { useState, useEffect } from 'react'
import { useTraceStore } from '../../store/traceStore'
import { getRandomFact } from '../../data/funFacts'

export const LocationDetail: React.FC = () => {
  const hops = useTraceStore((s) => s.hops)
  const selectedHopIndex = useTraceStore((s) => s.selectedHopIndex)
  const [funFact, setFunFact] = useState<string | null>(null)

  const hop = selectedHopIndex !== null ? hops[selectedHopIndex] : null

  // Generate a new fun fact whenever selected hop changes
  useEffect(() => {
    if (!hop) {
      setFunFact(null)
      return
    }
    setFunFact(getRandomFact(hop.location?.country_code))
  }, [selectedHopIndex, hop])

  if (!hop) return null

  const loc = hop.location
  const avgRtt = hop.rtt.filter((r): r is number => r !== null)
  const avg = avgRtt.length > 0 ? avgRtt.reduce((a, b) => a + b, 0) / avgRtt.length : null

  return (
    <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/15 rounded-md p-3">
      <div className="text-[10px] text-orange-400 uppercase tracking-widest mb-2 border-b border-orange-400/20 pb-1">
        Location — Hop {hop.hop}
      </div>

      <div className="space-y-2">
        {/* IP & Hostname */}
        <div>
          <div className="text-white font-mono text-xs">{hop.ip}</div>
          {hop.hostname !== hop.ip && (
            <div className="text-gray-400 text-[11px] truncate">{hop.hostname}</div>
          )}
        </div>

        {/* Location details */}
        {loc ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <div>
                <span className="text-gray-600 uppercase tracking-wider">City</span>
                <div className="text-white">{loc.city}</div>
              </div>
              <div>
                <span className="text-gray-600 uppercase tracking-wider">Region</span>
                <div className="text-white">{loc.region || '\u2014'}</div>
              </div>
              <div>
                <span className="text-gray-600 uppercase tracking-wider">Country</span>
                <div className="text-white">{loc.country}</div>
              </div>
              <div>
                <span className="text-gray-600 uppercase tracking-wider">Coordinates</span>
                <div className="text-white font-mono">
                  {loc.lat.toFixed(2)}, {loc.lon.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Network info */}
            {(hop.org || hop.asn) && (
              <div className="pt-1 border-t border-cyan-500/10">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  {hop.org && (
                    <div className="col-span-2">
                      <span className="text-gray-600 uppercase tracking-wider">Organization</span>
                      <div className="text-white truncate">{hop.org}</div>
                    </div>
                  )}
                  {hop.asn && (
                    <div>
                      <span className="text-gray-600 uppercase tracking-wider">ASN</span>
                      <div className="text-white font-mono">{hop.asn}</div>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600 uppercase tracking-wider">Avg RTT</span>
                    <div className="text-white font-mono">
                      {avg !== null ? `${Math.round(avg)}ms` : '\u2014'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-600 text-[10px]">No location data available</div>
        )}

        {/* Fun fact */}
        {funFact && (
          <div className="pt-1.5 border-t border-cyan-500/10">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Did you know?</div>
            <div className="text-[10px] text-cyan-300/80 leading-relaxed">{funFact}</div>
          </div>
        )}
      </div>
    </div>
  )
}
