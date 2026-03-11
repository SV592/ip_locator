export interface SunProps {
  position?: [number, number, number]
  intensity?: number
  radius?: number
  color?: string | number
  enableOrbit?: boolean
  orbitRadius?: number
  orbitSpeed?: number
  orbitHeight?: number
}

export interface MoonProps {
  position?: [number, number, number]
  intensity?: number
  radius?: number
  color?: string | number
  enableOrbit?: boolean
  orbitRadius?: number
  orbitSpeed?: number
  orbitTilt?: number
}
