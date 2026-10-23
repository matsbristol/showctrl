// The shared clock. One ticker drives every clock, countdown and display, with
// the server offset applied, so every component shows the same second.

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import type { SyncResult } from '../lib/clockSync'

export type TimeSync = SyncResult

export const TimeContext = createContext<TimeSync>({ offset: 0, state: 'device' })

/* ---------- one ticker for the whole app ---------- */

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let tickOffset = 0

/** The ticker fires on the server's whole seconds, so every device flips its displays together. */
export function setTickOffset(ms: number) { tickOffset = ms }

function schedule() {
  const now = Date.now() + tickOffset
  timer = setTimeout(() => {
    listeners.forEach(l => l())
    schedule()
  }, 1000 - (((now % 1000) + 1000) % 1000) + 5)
}

function subscribeTick(l: () => void) {
  listeners.add(l)
  if (!timer) schedule()
  return () => {
    listeners.delete(l)
    if (!listeners.size && timer) { clearTimeout(timer); timer = null }
  }
}

/**
 * Server-corrected current time in ms, re-rendering every `everyMs`
 * (rounded down to that step, so a 10 s hook re-renders every 10 s).
 */
export function useNow(everyMs = 1000): number {
  const { offset } = useContext(TimeContext)
  const get = useCallback(() => {
    const t = Date.now() + offset
    return everyMs > 1000 ? t - (t % everyMs) : t - (t % 1000)
  }, [offset, everyMs])
  return useSyncExternalStore(subscribeTick, get, get)
}

/** Read the server offset without subscribing to ticks (for actions that stamp a time). */
export function useServerTime(): () => number {
  const { offset } = useContext(TimeContext)
  return useCallback(() => Date.now() + offset, [offset])
}

export function useSyncState(): TimeSync {
  return useContext(TimeContext)
}
