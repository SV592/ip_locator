import React, { useMemo } from 'react'
import statesData from '../../../public/geo_json/countries_states.json'
import { buildBorderGeometryFromFeatures } from '../utils/geoMath'

interface StatesProps {
  radius?: number
  color?: string
}

export const States: React.FC<StatesProps> = ({
  radius = 2.01,
  color = '#ffffff',
}) => {
  const geometry = useMemo(() => {
    const geojson = statesData as any
    return buildBorderGeometryFromFeatures(geojson.features, radius)
  }, [radius])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.15} />
    </lineSegments>
  )
}
