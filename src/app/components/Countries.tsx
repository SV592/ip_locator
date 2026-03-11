import React, { useMemo } from 'react'
import * as topojson from 'topojson-client'
import worldData from 'world-atlas/countries-50m.json'
import { buildBorderGeometryFromFeatures } from '../utils/geoMath'

interface CountriesProps {
  radius?: number
  color?: string
}

export const Countries: React.FC<CountriesProps> = ({
  radius = 2.01,
  color = '#ffffff',
}) => {
  const geometry = useMemo(() => {
    const topology = worldData as any
    const geojson = topojson.feature(topology, topology.objects.countries) as any
    return buildBorderGeometryFromFeatures(geojson.features, radius)
  }, [radius])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.4} />
    </lineSegments>
  )
}
