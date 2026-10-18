import { describe, expect, it } from 'vitest'
import { buildSample } from '../data/sample'
import { HOUR, MIN } from '../types/constants'
import type { Msg } from '../types/model'
import { createAccess } from './access'
import { inChannel, messageChannels, myUrgent, parseTarget, unreadCount, visibleMsgs } from './messages'

const T = Date.UTC(2026, 6, 10, 18)
const d = buildSample(T)
const { col } = d
const as = (me: string) => createAccess({ me, roles: d.roles, members: col.members, stageteam: col.stageteam, stages: col.stages })
const stages = Object.values(col.stages)

describe('messageChannels', () => {
  it('gives an admin every stage and department', () => {
    const ids = messageChannels(as('demo-admin'), stages, d.cfg!.depts).map(c => c.id)
    expect(ids).toContain('stage:tent')
    expect(ids).toContain('dept:security')
  })

  it('gives stage crew their own stage and department only', () => {
    const ids = messageChannels(as('demo-crew-main-3'), stages, d.cfg!.depts).map(c => c.id)
    expect(ids.filter(i => i.startsWith('stage:'))).toEqual(['stage:main'])
    expect(ids.filter(i => i.startsWith('dept:'))).toEqual(['dept:audio'])
  })
})

describe('channel filters', () => {
  const m = (to: Msg['to'], pri: Msg['pri'] = 'normal'): Msg => ({ id: 'x', from: 'u', to, text: '', pri, at: 0, acks: {} })
  it('sorts messages into channels', () => {
    expect(inChannel(m({ t: 'stage', id: 'main' }), 'stage:main')).toBe(true)
    expect(inChannel(m({ t: 'stage', id: 'main' }), 'stage:tent')).toBe(false)
    expect(inChannel(m({ t: 'all' }), 'all')).toBe(true)
    expect(inChannel(m({ t: 'user', id: 'a' }), 'direct')).toBe(true)
    expect(inChannel(m({ t: 'dept', id: 'al' }, 'urgent'), 'urgent')).toBe(true)
    expect(inChannel(m({ t: 'dept', id: 'al' }), 'inbox')).toBe(true)
  })

  it('parses compose targets', () => {
    expect(parseTarget('all')).toEqual({ t: 'all' })
    expect(parseTarget('stage:main')).toEqual({ t: 'stage', id: 'main' })
    expect(parseTarget('user:demo-x:y')).toEqual({ t: 'user', id: 'demo-x:y' })
  })
})

describe('unread and urgent', () => {
  it('counts messages for me since I last read, not my own', () => {
    const a = as('demo-sm-tent')
    const mine = visibleMsgs(a, col.msgs, true)
    expect(mine.map(m => m.id).sort()).toEqual(['m1', 'm3'])
    expect(unreadCount(a, col.msgs, 0)).toBe(2)
    expect(unreadCount(a, col.msgs, T)).toBe(0)
  })

  it('lists unacknowledged urgent messages from the last 12 hours', () => {
    expect(myUrgent(as('demo-sm-tent'), col.msgs, T).map(m => m.id)).toEqual(['m3'])
    expect(myUrgent(as('demo-pm'), col.msgs, T)).toEqual([]) // already acknowledged
    expect(myUrgent(as('demo-sm-tent'), col.msgs, T + 13 * HOUR)).toEqual([])
    expect(myUrgent(as('demo-al'), col.msgs, T + MIN)).toEqual([]) // the sender
  })

  it('lets only festival-wide message rights send to everyone', () => {
    expect(as('demo-crew-main-3').canSendTo({ t: 'all' })).toBe(false)
    expect(as('demo-crew-main-3').canSendTo({ t: 'stage', id: 'main' })).toBe(true)
    expect(as('demo-pm').canSendTo({ t: 'all' })).toBe(true)
  })
})
