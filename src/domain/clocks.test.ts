import { describe, expect, it } from 'vitest'
import type { Clock, RosItem, Stage } from '../types/model'
import { clockValue, clocksFor, cdState, fmtCountdown, timerPatch } from './clocks'
import { MIN } from './constants'

const tz = 'Europe/Oslo'
const t = Date.UTC(2026, 6, 2, 18, 0) // 20:00 Oslo
const stages: Record<string, Stage> = { main: { id: 'main', name: 'Main Stage', tape: 'red', order: 0 } }
const show: RosItem = { id: 's', stage: 'main', kind: 'show', title: 'Hollow Pines', start: t - 10 * MIN, end: t + 50 * MIN, status: 'pending', delay: 0 }
const ctx = { ros: { s: show }, stages, tz }

describe('formatting', () => {
  it('formats countdowns, with + once over', () => {
    expect(fmtCountdown(65_000)).toBe('01:05')
    expect(fmtCountdown(3_723_000)).toBe('1:02:03')
    expect(fmtCountdown(-90_000)).toBe('+01:30')
  })

  it('warns under the threshold and goes red past zero', () => {
    expect(cdState(10 * MIN, 5)).toBe('')
    expect(cdState(4 * MIN, 5)).toBe('warn')
    expect(cdState(-1, 5)).toBe('over')
  })
})

describe('clockValue', () => {
  it('shows time of day in its own zone', () => {
    const c: Clock = { id: 'c', label: 'NYC', kind: 'tod', tz: 'America/New_York' }
    expect(clockValue(c, t, ctx)).toEqual({ text: '14:00:00', sub: 'New York · Thu 2 Jul' })
  })

  it('counts down to a moment', () => {
    const c: Clock = { id: 'c', label: 'Curfew', kind: 'countdown', target: t + 10 * MIN, warn: 15 }
    expect(clockValue(c, t, ctx)).toEqual({ text: '10:00', state: 'warn', sub: 'At 20:10 · Thu 2 Jul' })
    expect(clockValue(c, t + 11 * MIN, ctx)).toMatchObject({ text: '+01:00', state: 'over', sub: 'Passed 20:10' })
  })

  it('runs a timer from accumulated plus running time', () => {
    const c: Clock = { id: 'c', label: 'Changeover', kind: 'timer', duration: 45 * MIN, accum: 5 * MIN, runningSince: t - 10 * MIN }
    expect(clockValue(c, t, ctx)).toEqual({ text: '30:00', state: '', sub: 'Running · 45 min' })
    expect(clockValue({ ...c, runningSince: null }, t, ctx)).toEqual({ text: '40:00', state: '', sub: 'Paused · 45 min' })
    expect(clockValue({ ...c, duration: undefined, accum: 0, runningSince: null }, t, ctx)).toEqual({ text: '00:00', sub: 'Ready' })
  })

  it('follows a stage: time left of the show, then time to the next', () => {
    const c: Clock = { id: 'c', label: 'Main', kind: 'stage', stage: 'main', warn: 5 }
    expect(clockValue(c, t, ctx)).toEqual({ text: '50:00', state: '', sub: 'Hollow Pines ends 20:50' })
    expect(clockValue(c, t - 20 * MIN, ctx)).toMatchObject({ text: '10:00', sub: 'Hollow Pines at 19:50' })
    expect(clockValue(c, t + 2 * 60 * MIN, ctx)).toEqual({ text: '--:--', sub: 'Nothing scheduled' })
    expect(clockValue({ ...c, stage: 'gone' }, t, ctx)).toEqual({ text: '--:--', sub: 'Stage removed' })
  })
})

describe('timers', () => {
  const c = { id: 'c', label: 'T', kind: 'timer' as const, duration: 10 * MIN, accum: 2 * MIN, runningSince: t - MIN }
  it('starts, pauses (banking the time), resets and adds a minute', () => {
    expect(timerPatch({ ...c, runningSince: null }, 'start', t)).toEqual({ runningSince: t })
    expect(timerPatch(c, 'pause', t)).toEqual({ runningSince: null, accum: 3 * MIN })
    expect(timerPatch(c, 'reset', t)).toEqual({ runningSince: null, accum: 0 })
    expect(timerPatch(c, 'plus', t)).toEqual({ duration: 11 * MIN })
  })
})

describe('clocksFor', () => {
  const clocks: Record<string, Clock> = {
    f: { id: 'f', label: 'Fest', kind: 'tod', order: 3 },
    m: { id: 'm', label: 'Main', kind: 'stage', stage: 'main', scope: 'main', order: 0 },
    t: { id: 't', label: 'Tent', kind: 'stage', stage: 'tent', scope: 'tent', order: 1 },
  }
  it("shows festival clocks first, then the stage's own", () => {
    expect(clocksFor(clocks, 'main', () => true).map(c => c.id)).toEqual(['f', 'm'])
    expect(clocksFor(clocks, null, sid => sid === 'tent').map(c => c.id)).toEqual(['f', 't'])
  })
})
