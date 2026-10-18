// Clock values, ported from clockValue() in the prototype.

import type { Clock, Id, Ms, RosItem, Stage, TimeZone } from '../types/model'
import { MIN } from '../types/constants'
import { eff, nowNext } from './runsheet'
import { countdownState, dayKey, dayLabel, fmtCountdown, fmtTime, tzCity, type CountdownState } from './time'

export interface ClockValue {
  text: string
  state?: CountdownState
  sub?: string
}

export interface ClockEnv {
  tz: TimeZone
  ros: Readonly<Record<Id, RosItem>>
  stages: Readonly<Record<Id, Stage>>
}

export function clockValue(c: Clock, t: Ms, env: ClockEnv): ClockValue {
  switch (c.kind) {
    case 'tod': {
      const tz = c.tz || env.tz
      return { text: fmtTime(t, tz, true), sub: `${tzCity(tz)} · ${dayLabel(dayKey(t, tz))}` }
    }
    case 'countdown': {
      const ms = (c.target || 0) - t
      return {
        text: fmtCountdown(ms),
        state: countdownState(ms, c.warn ?? 5),
        sub: ms < 0 ? `Passed ${fmtTime(c.target, env.tz)}` : `At ${fmtTime(c.target, env.tz)} · ${dayLabel(dayKey(c.target, env.tz))}`,
      }
    }
    case 'timer': {
      const el = (c.accum || 0) + (c.runningSince ? t - c.runningSince : 0)
      const status = c.runningSince ? 'Running' : el ? 'Paused' : 'Ready'
      if (c.duration) {
        const ms = c.duration - el
        return { text: fmtCountdown(ms), state: c.runningSince ? countdownState(ms, c.warn ?? 2) : '', sub: `${status} · ${Math.round(c.duration / MIN)} min` }
      }
      return { text: fmtCountdown(el).replace('+', ''), sub: status }
    }
    case 'stage': {
      if (!env.stages[c.stage]) return { text: '--:--', sub: 'Stage removed' }
      const { cur, next } = nowNext(env.ros, c.stage, t, env.tz)
      if (cur) {
        const ms = eff(cur).e - t
        return { text: fmtCountdown(ms), state: countdownState(ms, c.warn ?? 5), sub: `${cur.title} ends ${fmtTime(eff(cur).e, env.tz)}` }
      }
      if (next) {
        const ms = eff(next).s - t
        return { text: fmtCountdown(ms), state: countdownState(ms, c.warn ?? 5), sub: `${next.title} at ${fmtTime(eff(next).s, env.tz)}` }
      }
      return { text: '--:--', sub: 'Nothing scheduled' }
    }
  }
}

/** Festival-wide clocks first, then by position. */
export function sortClocks(cs: Clock[]): Clock[] {
  return [...cs].sort((a, b) => (a.scope ? 1 : 0) - (b.scope ? 1 : 0) || (a.order ?? 0) - (b.order ?? 0))
}
