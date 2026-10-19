/*
 * When each person last opened Messages, for the unread badge. A per-device
 * convenience, as in the prototype: it lives in this browser's storage, so
 * reading on a phone doesn't clear the badge on a laptop. If storage is
 * blocked it falls back to memory for this visit.
 */
import { useCallback, useSyncExternalStore } from 'react'
import type { Id, Ms } from '../types/model'

const KEY = (uid: Id) => `showctrl-react-lastread-${uid}`
const memory = new Map<Id, Ms>()
const listeners = new Set<() => void>()

export function getLastRead(uid: Id | null): Ms {
  if (!uid) return 0
  try {
    return Number(localStorage.getItem(KEY(uid))) || 0
  } catch {
    // Storage blocked (private mode, settings): use this visit's memory.
    return memory.get(uid) ?? 0
  }
}

export function markRead(uid: Id | null, t: Ms) {
  if (!uid || getLastRead(uid) >= t) return
  try { localStorage.setItem(KEY(uid), String(t)) } catch { memory.set(uid, t) }
  for (const l of listeners) l()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useLastRead(uid: Id | null): Ms {
  const get = useCallback(() => getLastRead(uid), [uid])
  return useSyncExternalStore(subscribe, get, get)
}
