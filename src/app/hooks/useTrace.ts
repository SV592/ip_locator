import { useCallback, useRef } from 'react'
import { useTraceStore } from '../store/traceStore'
import type { Hop, TargetInfo, TraceSummary } from '../types/trace'

async function consumeSSEStream(
  url: string,
  signal: AbortSignal,
  handlers: {
    onHop: (hop: Hop) => void
    onTarget: (target: TargetInfo) => void
    onSummary: (summary: TraceSummary) => void
    onError: (msg: string) => void
  }
): Promise<void> {
  const res = await fetch(url, { signal })

  if (!res.ok) {
    const err = await res.json()
    handlers.onError(err.error || 'Request failed')
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    handlers.onError('No response stream')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const messages = buffer.split('\n\n')
    buffer = messages.pop() || ''

    for (const msg of messages) {
      const eventMatch = msg.match(/^event:\s*(.+)$/m)
      const dataMatch = msg.match(/^data:\s*(.+)$/m)
      if (!eventMatch || !dataMatch) continue

      const event = eventMatch[1].trim()
      const data = JSON.parse(dataMatch[1])

      switch (event) {
        case 'hop':
          handlers.onHop(data as Hop)
          break
        case 'target':
          handlers.onTarget(data as TargetInfo)
          break
        case 'summary':
          handlers.onSummary(data as TraceSummary)
          break
        case 'error':
          handlers.onError(data.message || 'Unknown error')
          break
      }
    }
  }
}

export function useTrace() {
  const status = useTraceStore((s) => s.status)
  const startTrace = useTraceStore((s) => s.startTrace)
  const addHop = useTraceStore((s) => s.addHop)
  const setTarget = useTraceStore((s) => s.setTarget)
  const completeTrace = useTraceStore((s) => s.completeTrace)
  const failTrace = useTraceStore((s) => s.failTrace)
  const abortRef = useRef<AbortController | null>(null)

  const trace = useCallback(async (input: string) => {
    // Abort any in-progress trace
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    startTrace(input)

    const url = `/api/trace?target=${encodeURIComponent(input)}`
    const handlers = {
      onHop: addHop,
      onTarget: setTarget,
      onSummary: completeTrace,
      onError: failTrace,
    }

    try {
      await consumeSSEStream(url, controller.signal, handlers)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return

      // Retry once on connection failure (spec: retry once then show error)
      try {
        const retryController = new AbortController()
        abortRef.current = retryController
        await consumeSSEStream(url, retryController.signal, handlers)
      } catch (retryErr: unknown) {
        if (retryErr instanceof Error && retryErr.name !== 'AbortError') {
          failTrace(retryErr.message || 'Connection failed after retry')
        } else if (!(retryErr instanceof Error)) {
          failTrace('Connection failed after retry')
        }
      }
    }
  }, [startTrace, addHop, setTarget, completeTrace, failTrace])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { trace, abort, isTracing: status === 'tracing' }
}
