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
    }),

  addHop: (hop: Hop) =>
    set((state) => ({ hops: [...state.hops, hop] })),

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

  selectHop: (index: number | null) =>
    set({ selectedHopIndex: index }),

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
    }),
}))
