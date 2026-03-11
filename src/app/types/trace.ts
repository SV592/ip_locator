export interface HopLocation {
  city: string
  region: string
  country: string
  country_code: string
  lat: number
  lon: number
}

export interface Hop {
  hop: number
  ip: string
  hostname: string
  rtt: (number | null)[]
  location: HopLocation | null
  org: string | null
  asn: string | null
}

export interface TargetInfo {
  ip: string
  hostname: string
  city: string
  region: string
  country: string
  lat: number
  lon: number
  org: string
}

export interface TraceSummary {
  totalHops: number
  respondingHops: number
  countries: number
  averageRtt: number
}

export interface HistoryEntry {
  input: string
  target: TargetInfo | null
  timestamp: number
  hopCount: number
}

export type TraceStatus = 'idle' | 'tracing' | 'complete' | 'error'
