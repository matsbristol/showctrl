import { describe, expect, it } from 'vitest'
import { buildSample } from '../data/sample'
import { MIN } from '../types/constants'
import type { Clock, RosItem } from '../types/model'
import { measureOffset } from './clockSync'
import { clockValue, sortClocks } from './clocks'
import { packRows, shiftTargets, stageDelay } from './runsheet'
import { countdownState, fmtCountdown, relTime } from './time'

const T = Date.UTC(2026, 6, 10, 18)
const d = buildSample(T)
const env = { tz: 'Europe/Oslo', ros: d.col.ros, stages: d.col.stages }
const base = { id: 'c', label: 'x' }

describe('countdown formatting', () => {
  it('formats and flags countdowns', () => {
    expect(fmtCountdown(65_000)).toBe('01:05')
    expect(fmtCountdown(3_725_000)).toBe('1:02:05')
    expect(fmtCountdown(-10_000)).toBe('+00:10')
    expect(countdownState(-1)).toBe('over')
    expect(countdownState(4 * MIN)).toBe('warn')
    expect(countdownState(6 * MIN)).toBe('')
    expect(relTime(T - 5 * MIN, T)).toBe('5 min ago')
    expect(relTime(T + 90 * MIN, T)).toBe('in 1.5 h')
  })
})

describe('clockValue', () => {
  it('shows time of day in the clock’s own zone', () => {
    expect(clockValue({ ...base, kind: 'tod', tz: 'America/New_York' }, T, env).text).toBe('14:00:00')
  })

  it('counts down to a target and warns near it', () => {
    const c: Clock = { ...base, kind: 'countdown', target: T + 3 * MIN, warn: 5 }
    expect(clockValue(c, T, env)).toMatchObject({ text: '03:00', state: 'warn' })
    expect(clockValue(c, T + 4 * MIN, env)).toMatchObject({ text: '+01:00', state: 'over' })
  })

  it('runs, pauses and counts up timers', () => {
    const run: Clock = { ...base, kind: 'timer', duration: 10 * MIN, accum: 2 * MIN, runningSince: T - MIN }
    expect(clockValue(run, T, env)).toMatchObject({ text: '07:00', sub: 'Running · 10 min' })
    const paused: Clock = { ...base, kind: 'timer', duration: null, accum: 90_000, runningSince: null }
    expect(clockValue(paused, T, env)).toMatchObject({ text: '01:30', sub: 'Paused' })
  })

  it('follows a stage’s now and next', () => {
    const v = clockValue({ ...base, kind: 'stage', stage: 'main' }, T, env)
    expect(v.text).not.toBe('--:--')
    expect(v.sub).toMatch(/ends|at/)
    expect(clockValue({ ...base, kind: 'stage', stage: 'gone' }, T, env).sub).toBe('Stage removed')
  })

  it('sorts festival-wide clocks first', () => {
    const cs = sortClocks(Object.values(d.col.clocks))
    expect(cs[0].scope ?? null).toBeNull()
    expect(cs[cs.length - 1].scope).toBeTruthy()
  })
})

describe('run sheet helpers', () => {
  const tentItems = Object.values(d.col.ros).filter(r => r.stage === 'tent')

  it('reports The Tent running 10 min behind', () => {
    expect(stageDelay(d.col.ros, 'tent', T, 'Europe/Oslo')).toBe(10 * MIN)
    expect(stageDelay(d.col.ros, 'forest', T, 'Europe/Oslo')).toBe(0)
  })

  it('shifts an item and everything after it that day, optionally skipping dock items', () => {
    const show = tentItems.filter(r => r.kind === 'show' && r.status === 'pending').sort((a, b) => a.start - b.start)[0]
    const all = shiftTargets(d.col.ros, show, 'Europe/Oslo')
    expect(all[0].start).toBeGreaterThanOrEqual(show.start)
    expect(all.every(x => x.status !== 'done')).toBe(true)
    const stageOnly = shiftTargets(d.col.ros, show, 'Europe/Oslo', false)
    expect(stageOnly.length).toBeLessThan(all.length)
  })

  it('packs overlapping blocks into separate rows', () => {
    const mk = (id: string, s: number, e: number): RosItem => ({ id, stage: 's', kind: 'show', title: id, start: s, end: e, status: 'pending', delay: 0 })
    const { out, rows } = packRows([mk('a', 0, 60 * MIN), mk('b', 30 * MIN, 90 * MIN), mk('c', 60 * MIN, 120 * MIN)])
    expect(rows).toBe(2)
    expect(Object.fromEntries(out.map(([i, r]) => [i.id, r]))).toEqual({ a: 0, b: 1, c: 0 })
  })
})

describe('measureOffset', () => {
  const res = (headers: Record<string, string>, body?: unknown) =>
    (async () => new Response(body === undefined ? '' : JSON.stringify(body), { headers })) as unknown as typeof fetch

  it('prefers a JSON { now } body', async () => {
    let t = 1_000_000
    const r = await measureOffset('/time', res({ 'content-type': 'application/json' }, { now: 1_010_000 }), () => (t += 0))
    expect(r).toEqual({ offset: 10_000, state: 'corrected' })
  })

  it('falls back to the Date header, and calls small offsets in sync', async () => {
    const now = Date.UTC(2026, 6, 10, 18, 0, 0)
    const r = await measureOffset('/', res({ date: new Date(now).toUTCString() }), () => now)
    expect(r).toEqual({ offset: 0, state: 'ok' })
  })

  it('stays on device time when the request fails', async () => {
    const r = await measureOffset('/', (async () => { throw new Error('offline') }) as unknown as typeof fetch)
    expect(r.state).toBe('device')
  })
})
