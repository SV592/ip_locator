import * as THREE from 'three'

/** Radius used for elements placed on the globe surface (slightly above Earth's radius of 2) */
export const EARTH_RADIUS = 2.01

/**
 * Convert latitude/longitude to a 3D position on a sphere.
 * Used by country borders, state borders, hop markers, and route arcs.
 */
export function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

/**
 * Build a single merged BufferGeometry from GeoJSON polygon rings.
 * Each ring is converted to line segments on the sphere surface.
 */
export function buildBorderGeometryFromFeatures(
  features: any[],
  radius: number
): THREE.BufferGeometry {
  const positions: number[] = []

  for (const feature of features) {
    const geom = feature.geometry
    const rings: number[][][] =
      geom.type === 'Polygon'
        ? geom.coordinates
        : geom.type === 'MultiPolygon'
          ? geom.coordinates.flat()
          : []

    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = latLonToVec3(ring[i][1], ring[i][0], radius)
        const b = latLonToVec3(ring[i + 1][1], ring[i + 1][0], radius)
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}
