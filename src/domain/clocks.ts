/*
 * What each clock shows. Four kinds:
 *   tod        time of day, in any zone (artists' home time, for example)
 *   countdown  to a fixed moment, such as curfew
 *   timer      start / pause / reset; counts down from a length, or up
 *   stage      follows a stage's run sheet: time left of what's on, else time to the next show
 */
import type { Clock, ClockKind, Id, Ms, RosItem, Stage, TimeZone } from '../types/model'
import { MIN } from './constants'
import { eff, nowNext } from './runsheet'
import { dayKey, dayLabel, fmtTime, tzCity } from './time'

export const CLOCK_KINDS: Record<ClockKind, string> = {
  tod: 'Time of day',
  countdown: 'Countdown to a time',
  timer: 'Timer (start/stop)',
  stage: 'Follows a stage',
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "12:34", "1:02:03", or "+3:10" once past zero (running over). */
export function fmtCountdown(ms: Ms): string {
  const neg = ms < 0
  const s = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const x = s % 60
  return (neg ? '+' : '') + (h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`)
}

/** '' while comfortable, 'warn' under `warnMin` minutes (amber), 'over' past zero (red). */
export type CdState = '' | 'warn' | 'over'
export const cdState = (ms: Ms, warnMin = 5): CdState => (ms < 0 ? 'over' : ms < warnMin * MIN ? 'warn' : '')

export interface ClockValue {
  text: string
  state?: CdState
  sub?: string
}

export interface ClockContext {
  ros: Record<Id, RosItem>
  stages: Record<Id, Stage>
  /** The event time zone. */
  tz: TimeZone
}

export function clockValue(c: Clock, t: Ms, ctx: ClockContext): ClockValue {
  const { tz } = ctx
  switch (c.kind) {
    case 'tod': {
      const z = c.tz || tz
      return { text: fmtTime(t, true, z), sub: `${tzCity(z)} · ${dayLabel(dayKey(t, z))}` }
    }
    case 'countdown': {
      const ms = (c.target || 0) - t
      return {
        text: fmtCountdown(ms),
        state: cdState(ms, c.warn ?? 5),
        sub: ms < 0 ? `Passed ${fmtTime(c.target, false, tz)}` : `At ${fmtTime(c.target, false, tz)} · ${dayLabel(dayKey(c.target, tz))}`,
      }
    }
    case 'timer': {
      const elapsed = timerElapsed(c, t)
      const state = c.runningSince ? 'Running' : elapsed ? 'Paused' : 'Ready'
      if (c.duration) {
        const ms = c.duration - elapsed
        // Only warn while it is running; a paused timer isn't urgent.
        return { text: fmtCountdown(ms), state: c.runningSince ? cdState(ms, c.warn ?? 2) : '', sub: `${state} · ${Math.round(c.duration / MIN)} min` }
      }
      return { text: fmtCountdown(elapsed).replace('+', ''), sub: state }
    }
    case 'stage': {
      if (!ctx.stages[c.stage]) return { text: '--:--', sub: 'Stage removed' }
      const { cur, next } = nowNext(ctx.ros, c.stage, t)
      if (cur) {
        const ms = eff(cur).e - t
        return { text: fmtCountdown(ms), state: cdState(ms, c.warn ?? 5), sub: `${cur.title} ends ${fmtTime(eff(cur).e, false, tz)}` }
      }
      if (next) {
        const ms = eff(next).s - t
        return { text: fmtCountdown(ms), state: cdState(ms, c.warn ?? 5), sub: `${next.title} at ${fmtTime(eff(next).s, false, tz)}` }
      }
      return { text: '--:--', sub: 'Nothing scheduled' }
    }
  }
}

export const timerElapsed = (c: Pick<Clock & { kind: 'timer' }, 'accum' | 'runningSince'>, t: Ms) =>
  (c.accum || 0) + (c.runningSince ? t - c.runningSince : 0)

export type TimerOp = 'start' | 'pause' | 'reset' | 'plus'

/**
 * Timer controls as a patch. Running time is stored as `accum` (time banked
 * while paused) plus `runningSince`, so every screen computes the same value
 * from server time without the timer having to tick in the database.
 */
export function timerPatch(c: Clock & { kind: 'timer' }, op: TimerOp, t: Ms): Partial<Clock & { kind: 'timer' }> {
  switch (op) {
    case 'start': return { runningSince: t }
    case 'pause': return { runningSince: null, accum: timerElapsed(c, t) }
    case 'reset': return { runningSince: null, accum: 0 }
    case 'plus': return { duration: (c.duration || 0) + MIN }
  }
}

/**
 * Clocks shown in a workspace: festival-wide ones plus that stage's own.
 * In HQ, festival-wide plus every stage the viewer can see.
 * Festival-wide first, then by position.
 */
export function clocksFor(clocks: Record<Id, Clock>, sid: Id | null, canSeeStage: (sid: Id) => boolean): Clock[] {
  return Object.values(clocks)
    .filter(c => (sid ? !c.scope || c.scope === sid : !c.scope || canSeeStage(c.scope)))
    .sort((a, b) => (a.scope ? 1 : 0) - (b.scope ? 1 : 0) || (a.order ?? 0) - (b.order ?? 0))
}
