/* Message hooks shared by the Messages screen, the urgent banner, the badge and the panels. */
import { useMemo } from 'react'
import { now, useNow } from '../clock/clock'
import { pendingUrgent, targetLabel, unreadCount } from '../domain/messages'
import { rid } from '../domain/runsheet'
import { useSnapshot, useStore } from '../data/hooks'
import { useAccess, useSession } from '../session/hooks'
import { useLastRead } from '../session/lastRead'
import { personName } from '../shell/people'
import type { Id, Msg, MsgTarget } from '../types/model'

/** The current viewer in the shape the message rules take. */
export function useMsgViewer() {
  const access = useAccess()
  const { viewer } = useSession()
  return useMemo(() => ({ uid: viewer.uid, access }), [viewer.uid, access])
}

export function useMessages() {
  const store = useStore()
  const snap = useSnapshot()
  const v = useMsgViewer()

  const send = (to: MsgTarget, text: string, urgent: boolean) =>
    store.set('msgs', rid(), { from: v.uid ?? 'unknown', to, text, pri: urgent ? 'urgent' : 'normal', at: now(), acks: {} })

  // Merges just this person's acknowledgement, so two people acking at once don't overwrite each other.
  const ack = (m: Msg) => v.uid && store.update('msgs', m.id, { acks: { [v.uid]: now() } })

  const remove = (m: Msg) => store.delete('msgs', m.id)

  /** Only the sender and festival admins may delete a message. */
  const canDelete = (m: Msg) => m.from === v.uid || v.access.perm('admin') >= 2

  const label = (to?: MsgTarget) => targetLabel(to, snap, v.uid, uid => personName(snap, uid, v.uid))
  const nameOf = (uid: Id) => personName(snap, uid, v.uid)

  return { send, ack, remove, canDelete, label, nameOf }
}

export function usePendingUrgent(): Msg[] {
  const snap = useSnapshot()
  const v = useMsgViewer()
  const t = useNow(30_000)
  return pendingUrgent(snap.col.msgs, v, t)
}

export function useUnread(): number {
  const snap = useSnapshot()
  const v = useMsgViewer()
  return unreadCount(snap.col.msgs, v, useLastRead(v.uid))
}
