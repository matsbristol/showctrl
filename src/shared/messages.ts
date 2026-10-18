// Message channels, unread counts and urgent alerts, ported from the prototype's Messages view.

import { HOUR } from '../types/constants'
import type { Dept, Id, Ms, Msg, Stage, TapeColor } from '../types/model'
import type { Access } from './access'

export interface Channel {
  /** inbox | all | direct | urgent | stage:<id> | dept:<id> */
  id: string
  label: string
  tape?: TapeColor
}

/** The channels a user sees: their inbox, everyone, their stages and departments, direct and urgent. */
export function messageChannels(a: Access, stages: Stage[], depts: Dept[]): Channel[] {
  const deptIds = a.perm('admin') >= 2 ? depts.map(d => d.id) : a.myDepts()
  return [
    { id: 'inbox', label: 'Everything for you' },
    { id: 'all', label: 'Everyone' },
    ...stages.filter(s => a.stageRole(s.id) || a.perm('messages') >= 1).map(s => ({ id: `stage:${s.id}`, label: s.name, tape: s.tape })),
    ...deptIds.map(id => depts.find(d => d.id === id)).filter((d): d is Dept => !!d).map(d => ({ id: `dept:${d.id}`, label: d.name, tape: d.tape })),
    { id: 'direct', label: 'Direct messages' },
    { id: 'urgent', label: 'Urgent' },
  ]
}

/** Whether a message belongs in a channel. */
export function inChannel(m: Msg, channel: string): boolean {
  if (channel === 'inbox') return true
  if (channel === 'all') return !m.to || m.to.t === 'all'
  if (channel === 'direct') return m.to?.t === 'user'
  if (channel === 'urgent') return m.pri === 'urgent'
  const [t, id] = channel.split(':')
  return m.to?.t === t && 'id' in m.to && m.to.id === id
}

/** Messages the user can see, newest first. `addressedOnly` keeps only those meant for them. */
export function visibleMsgs(a: Access, msgs: Readonly<Record<Id, Msg>>, addressedOnly = false): Msg[] {
  return Object.values(msgs).filter(m => a.canSeeMsg(m, addressedOnly)).sort((x, y) => y.at - x.at)
}

/** Messages for the user, from others, since they last opened Messages. */
export function unreadCount(a: Access, msgs: Readonly<Record<Id, Msg>>, lastRead: Ms): number {
  if (a.anyLv('messages') < 1) return 0
  return visibleMsgs(a, msgs, true).filter(m => m.at > lastRead && m.from !== a.me).length
}

/** Urgent messages for the user from the last 12 hours that they haven't acknowledged. */
export function myUrgent(a: Access, msgs: Readonly<Record<Id, Msg>>, now: Ms): Msg[] {
  return visibleMsgs(a, msgs, true).filter(m => m.pri === 'urgent' && m.from !== a.me && !m.acks?.[a.me ?? ''] && now - m.at < 12 * HOUR)
}

/** "stage:main" → { t: 'stage', id: 'main' }; "all" → { t: 'all' }. */
export function parseTarget(v: string): Msg['to'] {
  const i = v.indexOf(':')
  if (i < 0) return { t: 'all' }
  const t = v.slice(0, i) as 'stage' | 'dept' | 'user'
  return { t, id: v.slice(i + 1) }
}
