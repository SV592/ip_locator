'use client'

import React, { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { SearchBar } from './SearchBar'
import { useTraceStore } from '../store/traceStore'
import { getRttColor } from '../utils/rttColor'
import type { Hop } from '../types/trace'

function getAvgRtt(rtt: (number | null)[]): number | null {
  const valid = rtt.filter((r): r is number => r !== null)
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

function MapBoundsUpdater() {
  const map = useMap()
  const hops = useTraceStore((s) => s.hops)
  const status = useTraceStore((s) => s.status)

  useEffect(() => {
    const geoHops = hops.filter((h) => h.location && h.location.lat !== 0 && h.location.lon !== 0)
    if (geoHops.length === 0) return

    const bounds = geoHops.map((h) => [h.location!.lat, h.location!.lon] as [number, number])

    if (status === 'complete' || geoHops.length > 1) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 })
    } else {
      map.setView(bounds[0], 6)
    }
  }, [hops, status, map])

  return null
}

function HopCard({ hop, index }: { hop: Hop; index: number }) {
  const selectHop = useTraceStore((s) => s.selectHop)
  const selectedHopIndex = useTraceStore((s) => s.selectedHopIndex)
  const isSelected = selectedHopIndex === index
  const avgRtt = getAvgRtt(hop.rtt)

  return (
    <div
      onClick={() => selectHop(isSelected ? null : index)}
      className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
        isSelected ? 'bg-orange-500/20 border border-orange-500/30' : 'hover:bg-white/5'
      }`}
    >
      <span className="text-gray-600 w-5 text-right font-mono text-xs">{hop.hop}</span>
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: getRttColor(avgRtt) }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-white font-mono text-xs truncate">
          {hop.ip === '*' ? '* * *' : hop.ip}
        </div>
        {hop.location && (
          <div className="text-gray-500 text-[10px] truncate">
            {hop.location.city}, {hop.location.country}
          </div>
        )}
      </div>
      <span className="text-xs font-mono shrink-0" style={{ color: getRttColor(avgRtt) }}>
        {avgRtt !== null ? `${Math.round(avgRtt)}ms` : '\u2014'}
      </span>
    </div>
  )
}

export default function MobileView() {
  const hops = useTraceStore((s) => s.hops)
  const status = useTraceStore((s) => s.status)
  const selectedHopIndex = useTraceStore((s) => s.selectedHopIndex)
  const selectHop = useTraceStore((s) => s.selectHop)

  const geoHops = hops.filter((h) => h.location && h.location.lat !== 0 && h.location.lon !== 0)

  const polylinePositions = geoHops.map(
    (h) => [h.location!.lat, h.location!.lon] as [number, number]
  )

  return (
    <div className="w-screen h-screen bg-black flex flex-col">
      <div className="p-3 shrink-0">
        <SearchBar />
      </div>

      <div className="flex-1 min-h-0">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          className="w-full h-full"
          style={{ background: '#000' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          <MapBoundsUpdater />

          {polylinePositions.length > 1 && (
            <Polyline
              positions={polylinePositions}
              pathOptions={{ color: '#ff8c00', weight: 2, opacity: 0.6 }}
            />
          )}

          {geoHops.map((hop, i) => {
            const hopIndex = hops.indexOf(hop)
            const avgRtt = getAvgRtt(hop.rtt)
            const isSelected = hopIndex === selectedHopIndex

            return (
              <CircleMarker
                key={i}
                center={[hop.location!.lat, hop.location!.lon]}
                radius={isSelected ? 8 : 5}
                pathOptions={{
                  fillColor: getRttColor(avgRtt),
                  fillOpacity: 0.9,
                  color: isSelected ? '#f97316' : getRttColor(avgRtt),
                  weight: isSelected ? 2 : 1,
                }}
                eventHandlers={{
                  click: () => selectHop(isSelected ? null : hopIndex),
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <span className="text-xs font-mono">
                    {hop.ip} — {hop.location?.city}
                  </span>
                </Tooltip>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      <div className="shrink-0 max-h-[35vh] overflow-y-auto border-t border-cyan-500/10 bg-black/80">
        {status !== 'idle' && (
          <div className="p-2 space-y-0.5">
            {hops.map((hop, i) => (
              <HopCard key={i} hop={hop} index={i} />
            ))}
            {status === 'tracing' && (
              <div className="text-gray-600 text-[10px] animate-pulse px-3 py-2">Tracing...</div>
              )}
          </div>
        )}
      </div>
    </div>
  )
}
