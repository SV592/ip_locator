import { create } from 'zustand'
import type { Hop, TargetInfo, TraceSummary, TraceStatus, HistoryEntry } from '../types/trace'

interface TraceStore {
  // Trace data
  status: TraceStatus
  traceInput: string  // raw user input, persisted for history
  target: TargetInfo | null
  hops: Hop[]
  summary: TraceSummary | null
  error: string | null

  // UI state
  selectedHopIndex: number | null
  hoveredHopIndex: number | null
  isReplaying: boolean
  replayIndex: number       // current hop in auto-tour (-1 = not replaying)
  cameraTarget: { lat: number; lon: number } | null  // where camera should fly to
  panelVisibility: { target: boolean; hops: boolean; stats: boolean }

  // History
  searchHistory: HistoryEntry[]

  // Actions
  startTrace: (input: string) => void
  addHop: (hop: Hop) => void
  setTarget: (target: TargetInfo) => void
  completeTrace: (summary: TraceSummary) => void
  failTrace: (error: string) => void
  selectHop: (index: number | null) => void
  hoverHop: (index: number | null) => void
  clearTrace: () => void
  startReplay: () => void
  stopReplay: () => void
  advanceReplay: () => void
  setCameraTarget: (target: { lat: number; lon: number } | null) => void
}

const MAX_HISTORY = 20

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('trace-history')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(history: HistoryEntry[]) {
  try {
    localStorage.setItem('trace-history', JSON.stringify(history))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export const useTraceStore = create<TraceStore>((set, get) => ({
  status: 'idle',
  traceInput: '',
  target: null,
  hops: [],
  summary: null,
  error: null,
  selectedHopIndex: null,
  hoveredHopIndex: null,
  isReplaying: false,
  replayIndex: -1,
  cameraTarget: null,
  panelVisibility: { target: true, hops: true, stats: true },
  searchHistory: loadHistory(),

  startTrace: (input: string) =>
    set({
      status: 'tracing',
      traceInput: input,
      target: null,
      hops: [],
      summary: null,
      error: null,
      selectedHopIndex: null,
      hoveredHopIndex: null,
      isReplaying: false,
      replayIndex: -1,
      cameraTarget: null,
    }),

  addHop: (hop: Hop) =>
    set((state) => ({
      hops: [...state.hops, { ...hop, arrivedAt: Date.now() }],
    })),

  setTarget: (target: TargetInfo) =>
    set({ target }),

  completeTrace: (summary: TraceSummary) => {
    const { traceInput, target, hops } = get()
    const entry: HistoryEntry = {
      input: traceInput,
      target,
      timestamp: Date.now(),
      hopCount: hops.length,
    }
    const history = [entry, ...get().searchHistory.filter(h => h.input !== traceInput)].slice(0, MAX_HISTORY)
    saveHistory(history)
    set({ status: 'complete', summary, searchHistory: history })
  },

  failTrace: (error: string) =>
    set({ status: 'error', error }),

  selectHop: (index: number | null) => {
    if (index === null) {
      set({ selectedHopIndex: null, cameraTarget: null })
      return
    }
    const hop = get().hops[index]
    if (hop?.location && hop.location.lat !== 0 && hop.location.lon !== 0) {
      set({
        selectedHopIndex: index,
        cameraTarget: { lat: hop.location.lat, lon: hop.location.lon },
      })
    } else {
      set({ selectedHopIndex: index, cameraTarget: null })
    }
  },

  hoverHop: (index: number | null) =>
    set({ hoveredHopIndex: index }),

  clearTrace: () =>
    set({
      status: 'idle',
      traceInput: '',
      target: null,
      hops: [],
      summary: null,
      error: null,
      selectedHopIndex: null,
      hoveredHopIndex: null,
      isReplaying: false,
      replayIndex: -1,
      cameraTarget: null,
    }),

  startReplay: () => {
    const { hops } = get()
    const firstGeo = hops.findIndex(
      (h) => h.location && h.location.lat !== 0 && h.location.lon !== 0
    )
    if (firstGeo === -1) return
    set({
      isReplaying: true,
      replayIndex: firstGeo,
      selectedHopIndex: firstGeo,
      cameraTarget: {
        lat: hops[firstGeo].location!.lat,
        lon: hops[firstGeo].location!.lon,
      },
    })
  },

  stopReplay: () =>
    set({ isReplaying: false, replayIndex: -1, cameraTarget: null }),

  advanceReplay: () => {
    const { hops, replayIndex } = get()
    let next = replayIndex + 1
    while (next < hops.length) {
      const h = hops[next]
      if (h.location && h.location.lat !== 0 && h.location.lon !== 0) break
      next++
    }
    if (next >= hops.length) {
      set({ isReplaying: false, replayIndex: -1, cameraTarget: null })
      return
    }
    set({
      replayIndex: next,
      selectedHopIndex: next,
      cameraTarget: {
        lat: hops[next].location!.lat,
        lon: hops[next].location!.lon,
      },
    })
  },

  setCameraTarget: (target) => set({ cameraTarget: target }),
}))
