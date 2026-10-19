/*
 * Who sees which message, the channels in the Messages screen, and which
 * urgent messages still need acknowledging.
 *
 * A message goes to everyone, one stage team, one department, or one
 * person. As in the prototype, direct messages are not private in the
 * shared store: this filtering is for the UI. The real backend must apply
 * the same rule server-side.
 */
import type { Access } from '../access/access'
import { sortStages } from '../access/access'
import type { Id, Ms, Msg, MsgTarget, Snapshot, TapeColor } from '../types/model'
import { HOUR } from './constants'
import { deptName } from './people'

/** An urgent message stops flashing after this long, acknowledged or not. */
export const URGENT_WINDOW = 12 * HOUR

export interface Viewer {
  uid: Id | null
  access: Access
}

const isForAll = (to?: MsgTarget) => !to || to.t === 'all'

/**
 * Messages someone sees, newest first.
 *
 * `addressedOnly` is "is this for me": everyone, my departments, stages
 * where I'm on the team, or me. Without it, a viewer also sees what they
 * sent, every stage channel if they have festival-wide messages access,
 * and everything at all if they're a festival admin.
 */
export function visibleMsgs(msgs: Record<Id, Msg>, v: Viewer, addressedOnly = false): Msg[] {
  const { uid, access } = v
  const depts = access.myDepts()
  const all = !addressedOnly && access.perm('admin') >= 2
  return Object.values(msgs)
    .filter(m =>
      all ||
      (!addressedOnly && m.from === uid) ||
      isForAll(m.to) ||
      (m.to.t === 'dept' && depts.includes(m.to.id)) ||
      (m.to.t === 'stage' && (!!access.stageRole(m.to.id) || (!addressedOnly && access.perm('messages') >= 1))) ||
      (m.to.t === 'user' && m.to.id === uid))
    .sort((a, b) => b.at - a.at)
}

/** Urgent messages for this person that they haven't acknowledged, from the last 12 hours. */
export function pendingUrgent(msgs: Record<Id, Msg>, v: Viewer, t: Ms): Msg[] {
  return visibleMsgs(msgs, v, true).filter(m =>
    m.pri === 'urgent' && m.from !== v.uid && !(v.uid && m.acks?.[v.uid]) && t - m.at < URGENT_WINDOW)
}

/** Messages for this person, from others, since they last opened Messages. */
export function unreadCount(msgs: Record<Id, Msg>, v: Viewer, lastRead: Ms): number {
  if (v.access.anyLv('messages') < 1) return 0
  return visibleMsgs(msgs, v, true).filter(m => m.at > lastRead && m.from !== v.uid).length
}

/* ---------------- channels ---------------- */

/** 'inbox' | 'all' | 'direct' | 'urgent' | 'stage:<id>' | 'dept:<id>' */
export type ChannelId = string

export interface Channel {
  id: ChannelId
  label: string
  tape?: TapeColor
}

/**
 * The channel list: everything for you, everyone, each stage you're on (or
 * all of them with festival-wide messages access), your departments (all of
 * them for admins), direct messages and urgent.
 */
export function channels(snap: Snapshot, access: Access): Channel[] {
  const depts = snap.cfg?.depts ?? []
  const myDepts = access.perm('admin') >= 2 ? depts.map(d => d.id) : access.myDepts()
  return [
    { id: 'inbox', label: 'Everything for you' },
    { id: 'all', label: 'Everyone' },
    ...sortStages(Object.values(snap.col.stages))
      .filter(s => access.stageRole(s.id) || access.perm('messages') >= 1)
      .map(s => ({ id: `stage:${s.id}`, label: s.name, tape: s.tape })),
    ...myDepts.map(id => ({ id: `dept:${id}`, label: deptName(depts, id), tape: depts.find(d => d.id === id)?.tape })),
    { id: 'direct', label: 'Direct messages' },
    { id: 'urgent', label: 'Urgent' },
  ]
}

/** Does a message belong in a channel? */
export function inChannel(m: Msg, ch: ChannelId): boolean {
  if (ch === 'inbox') return true
  if (ch === 'all') return isForAll(m.to)
  if (ch === 'direct') return m.to?.t === 'user'
  if (ch === 'urgent') return m.pri === 'urgent'
  const [t, id] = ch.split(':')
  return !isForAll(m.to) && m.to.t === t && 'id' in m.to && m.to.id === id
}

/** "Everyone", a stage or department name, a person's name, or "you". */
export function targetLabel(to: MsgTarget | undefined, snap: Snapshot, me: Id | null, nameOf: (uid: Id) => string): string {
  if (!to || to.t === 'all') return 'Everyone'
  if (to.t === 'dept') return deptName(snap.cfg?.depts ?? [], to.id) || 'Department'
  if (to.t === 'stage') return snap.col.stages[to.id]?.name || 'Stage'
  return to.id === me ? 'you' : nameOf(to.id)
}

/** Parses the compose form's "To" value: 'all', 'stage:<id>', 'dept:<id>' or 'user:<id>'. */
export function parseTarget(v: string): MsgTarget {
  const i = v.indexOf(':')
  if (i < 0) return { t: 'all' }
  return { t: v.slice(0, i) as 'stage' | 'dept' | 'user', id: v.slice(i + 1) }
}
