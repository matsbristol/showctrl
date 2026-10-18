import { useCallback, useMemo } from 'react'
import { useCollection, useDoc, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { myUrgent, unreadCount } from '../../shared/messages'
import type { Id, Msg, MsgPriority } from '../../types/model'
import { useAccess, useNow } from '../session'
import { useServerTime } from '../time'

/* ---------- when the user last opened Messages, stored with the user so it follows them across devices ---------- */

export function useLastRead(me: Id | null): number {
  return useDoc('prefs', me)?.lastRead ?? 0
}

/** Records that the user has read everything up to now. */
export function useMarkRead() {
  const store = useStore()
  const serverNow = useServerTime()
  return useCallback(async (me: Id | null) => {
    if (!me) return
    const at = serverNow()
    if (store.peek('prefs')?.[me]) await store.update('prefs', me, { lastRead: at })
    else await store.set('prefs', me, { lastRead: at })
  }, [store, serverNow])
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
