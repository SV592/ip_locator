import * as THREE from 'three'
import { EARTH_RADIUS } from './geoMath'

/**
 * Given a lat/lon on the globe, compute a camera position that orbits
 * to look at that point from a comfortable viewing distance.
 * Returns { position, target } where target is the point on the globe.
 */
export function getCameraPositionForLatLon(
  lat: number,
  lon: number,
  distance: number = 6
): { position: THREE.Vector3; lookAt: THREE.Vector3 } {
  // Point on globe surface
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)

  const surfacePoint = new THREE.Vector3(
    -EARTH_RADIUS * Math.sin(phi) * Math.cos(theta),
    EARTH_RADIUS * Math.cos(phi),
    EARTH_RADIUS * Math.sin(phi) * Math.sin(theta)
  )

  // Camera position: along the same radial direction but further out
  const direction = surfacePoint.clone().normalize()
  const cameraPos = direction.multiplyScalar(distance)

  return { position: cameraPos, lookAt: surfacePoint }
}

/**
 * Smoothly interpolate between two camera states.
 * Returns a value between 0 and 1 using ease-in-out cubic.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}
