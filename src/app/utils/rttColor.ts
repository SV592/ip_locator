/**
 * Returns a hex color string based on average RTT.
 * Green (<20ms), Yellow (20-100ms), Red (>100ms), Gray (no data).
 */
export function getRttColor(avgRtt: number | null): string {
  if (avgRtt === null) return '#6b7280'
  if (avgRtt < 20) return '#4ade80'
  if (avgRtt < 100) return '#facc15'
  return '#ef4444'
}

/**
 * Returns a Tailwind text color class based on average RTT.
 * For use in HUD text elements.
 */
export function getRttTextClass(avgRtt: number | null): string {
  if (avgRtt === null) return 'text-gray-600'
  if (avgRtt < 20) return 'text-green-400'
  if (avgRtt < 100) return 'text-yellow-400'
  return 'text-red-400'
}
