import { describe, expect, it } from 'vitest'
import { createAccess } from '../access/access'
import { buildSample } from '../data/sample'
import type { Msg } from '../types/model'
import { HOUR, MIN } from './constants'
import { channels, inChannel, parseTarget, pendingUrgent, targetLabel, unreadCount, visibleMsgs } from './messages'

const NOW = Date.UTC(2026, 6, 2, 18, 0)
const snap = buildSample(NOW)
const viewer = (uid: string) => ({ uid, access: createAccess(snap, { uid }) })
const ids = (ms: Msg[]) => ms.map(m => m.id)

// The sample's messages:
//   m1 pm → everyone            m2 sm-main → Main Stage     m3 liaison → The Tent (urgent)
//   m4 hosp → Artist liaison    m5 sm-fjord → Transport

describe('visibleMsgs', () => {
  it('shows the admin everything, newest first', () => {
    expect(ids(visibleMsgs(snap.col.msgs, viewer('demo-admin')))).toEqual(['m5', 'm4', 'm3', 'm2', 'm1'])
  })

  it("shows a stage manager everyone's messages and their own stage's", () => {
    expect(ids(visibleMsgs(snap.col.msgs, viewer('demo-sm-main')))).toEqual(['m2', 'm1'])
    expect(ids(visibleMsgs(snap.col.msgs, viewer('demo-sm-tent')))).toEqual(['m3', 'm1'])
  })

  it("shows what you sent even when it isn't addressed to you", () => {
    expect(ids(visibleMsgs(snap.col.msgs, viewer('demo-sm-fjord')))).toEqual(['m5', 'm1'])
    expect(ids(visibleMsgs(snap.col.msgs, viewer('demo-sm-fjord'), true))).toEqual(['m1'])
  })

  it('gives department members their department, and festival-wide readers every stage', () => {
    // Artist liaison is in the "al" department and has festival-wide messages access.
    expect(ids(visibleMsgs(snap.col.msgs, viewer('demo-al')))).toEqual(['m4', 'm3', 'm2', 'm1'])
    // But only m4 (their department) and m1 (everyone) are addressed to them.
    expect(ids(visibleMsgs(snap.col.msgs, viewer('demo-al'), true))).toEqual(['m4', 'm1'])
  })
})

describe('urgent and unread', () => {
  it('flags urgent messages until acknowledged, for 12 hours', () => {
    const v = viewer('demo-sm-tent')
    expect(ids(pendingUrgent(snap.col.msgs, v, NOW))).toEqual(['m3'])
    const acked = { ...snap.col.msgs, m3: { ...snap.col.msgs.m3, acks: { 'demo-sm-tent': NOW } } }
    expect(pendingUrgent(acked, v, NOW)).toEqual([])
    expect(pendingUrgent(snap.col.msgs, v, NOW + 13 * HOUR)).toEqual([])
    // Not for the sender, nor for people it wasn't sent to.
    expect(pendingUrgent(snap.col.msgs, viewer('demo-al'), NOW)).toEqual([])
    expect(pendingUrgent(snap.col.msgs, viewer('demo-sm-main'), NOW)).toEqual([])
  })

  it("counts unread messages addressed to you, not your own", () => {
    expect(unreadCount(snap.col.msgs, viewer('demo-sm-main'), 0)).toBe(1) // m1; m2 is their own
    expect(unreadCount(snap.col.msgs, viewer('demo-sm-main'), NOW)).toBe(0)
    expect(unreadCount(snap.col.msgs, viewer('demo-sm-tent'), NOW - 30 * MIN)).toBe(1) // m3 (18 min ago)
  })
})

describe('channels', () => {
  it('lists your stages and departments', () => {
    const ch = channels(snap, createAccess(snap, { uid: 'demo-sm-main' })).map(c => c.id)
    expect(ch).toEqual(['inbox', 'all', 'stage:main', 'dept:stage', 'direct', 'urgent'])
  })

  it('lists every stage for festival-wide readers and every department for admins', () => {
    const al = channels(snap, createAccess(snap, { uid: 'demo-al' })).map(c => c.id)
    expect(al.filter(c => c.startsWith('stage:'))).toHaveLength(5)
    expect(al.filter(c => c.startsWith('dept:'))).toEqual(['dept:al'])
    const admin = channels(snap, createAccess(snap, { uid: 'demo-admin' })).map(c => c.id)
    expect(admin.filter(c => c.startsWith('dept:'))).toHaveLength(snap.cfg!.depts.length)
  })

  it('files messages into channels', () => {
    const { m1, m2, m3 } = snap.col.msgs
    expect(inChannel(m1, 'all')).toBe(true)
    expect(inChannel(m2, 'stage:main')).toBe(true)
    expect(inChannel(m2, 'stage:tent')).toBe(false)
    expect(inChannel(m3, 'urgent')).toBe(true)
    expect(inChannel(m1, 'stage:main')).toBe(false)
    expect(inChannel({ ...m1, to: { t: 'user', id: 'x' } }, 'direct')).toBe(true)
  })
})

describe('targets', () => {
  it('labels and parses targets', () => {
    const name = (uid: string) => `Name of ${uid}`
    expect(targetLabel({ t: 'all' }, snap, 'me', name)).toBe('Everyone')
    expect(targetLabel({ t: 'stage', id: 'tent' }, snap, 'me', name)).toBe('The Tent')
    expect(targetLabel({ t: 'dept', id: 'al' }, snap, 'me', name)).toBe('Artist liaison')
    expect(targetLabel({ t: 'user', id: 'me' }, snap, 'me', name)).toBe('you')
    expect(targetLabel({ t: 'user', id: 'x' }, snap, 'me', name)).toBe('Name of x')
    expect(parseTarget('all')).toEqual({ t: 'all' })
    expect(parseTarget('stage:main')).toEqual({ t: 'stage', id: 'main' })
    expect(parseTarget('user:demo:odd')).toEqual({ t: 'user', id: 'demo:odd' })
  })
})
