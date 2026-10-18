import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useCollection, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { myUrgent, unreadCount } from '../../shared/messages'
import type { Id, Msg, MsgPriority } from '../../types/model'
import { useAccess, useNow } from '../session'
import { useServerTime } from '../time'

/* ---------- when each user last opened Messages (per browser) ---------- */

const KEY = (me: Id | null) => `showctrl-lastread-${me ?? ''}`
const listeners = new Set<() => void>()

function readLast(me: Id | null): number {
  try { return Number(localStorage.getItem(KEY(me))) || 0 } catch { return 0 }
}

export function markRead(me: Id | null, at: number) {
  try { localStorage.setItem(KEY(me), String(at)) } catch { /* private mode */ }
  listeners.forEach(l => l())
}

export function useLastRead(me: Id | null): number {
  const sub = useCallback((l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }, [])
  const get = () => readLast(me)
  return useSyncExternalStore(sub, get, () => 0)
}

/* ---------- counts ---------- */

export function useUnreadCount(): number {
  const a = useAccess()
  const msgs = useCollection('msgs')
  const last = useLastRead(a.me)
  return unreadCount(a, msgs, last)
}

export function useMyUrgent(): Msg[] {
  const a = useAccess()
  const msgs = useCollection('msgs')
  const now = useNow(30_000)
  return useMemo(() => myUrgent(a, msgs, now), [a, msgs, now])
}

/* ---------- actions ---------- */

export function useMessageActions() {
  const store = useStore()
  const a = useAccess()
  const serverNow = useServerTime()
  return useMemo(() => ({
    send: (to: Msg['to'], text: string, pri: MsgPriority) =>
      store.set('msgs', rid(), { from: a.me ?? '', to, text, pri, at: serverNow(), acks: {} }),
    ack: (id: Id) => (a.me ? store.update('msgs', id, { acks: { [a.me]: serverNow() } }) : Promise.resolve()),
    remove: (id: Id) => store.delete('msgs', id),
  }), [store, a.me, serverNow])
}
