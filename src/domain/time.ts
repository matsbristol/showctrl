/*
 * Time helpers. All display and input conversion uses the event time zone,
 * never the device's zone.
 */
import type { DayKey, Ms, TimeZone } from '../types/model'
import { HOUR } from './constants'

export const DEFAULT_TZ: TimeZone = 'Europe/Oslo'

export interface TimeParts {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
}

const fmtCache: Record<string, Intl.DateTimeFormat> = {}

/** Wall-clock parts of `ms` in `tz`, zero-padded. */
export function parts(ms: Ms, tz: TimeZone = DEFAULT_TZ): TimeParts {
  const f = fmtCache[tz] ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const o: Record<string, string> = {}
  for (const p of f.formatToParts(ms)) o[p.type] = p.value
  if (o.hour === '24') o.hour = '00'
  return o as unknown as TimeParts
}

/** Offset of `tz` from UTC at `ms`, in ms. */
function tzOffset(ms: Ms, tz: TimeZone): number {
  const p = parts(ms, tz)
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000
}

/** `YYYY-MM-DDTHH:mm` wall time in `tz` → epoch ms. */
export function fromLocal(str: string, tz: TimeZone = DEFAULT_TZ): Ms | null {
  if (!str) return null
  const [d, t = '00:00'] = str.split('T')
  const [Y, M, D] = d.split('-').map(Number)
  const [h, m] = t.split(':').map(Number)
  const guess = Date.UTC(Y, M - 1, D, h, m)
  // Two passes so times next to a DST change land on the right side of it.
  const first = guess - tzOffset(guess, tz)
  return guess - tzOffset(first, tz)
}

/** Epoch ms → `YYYY-MM-DDTHH:mm` wall time in `tz`, for `<input type="datetime-local">`. */
export function toLocal(ms: Ms | null | undefined, tz: TimeZone = DEFAULT_TZ): string {
  if (ms == null) return ''
  const p = parts(ms, tz)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** `HH:mm` or `HH:mm:ss` in `tz`. */
export function fmtTime(ms: Ms, seconds = false, tz: TimeZone = DEFAULT_TZ): string {
  const p = parts(ms, tz)
  return `${p.hour}:${p.minute}` + (seconds ? `:${p.second}` : '')
}

export function dayKey(ms: Ms, tz: TimeZone = DEFAULT_TZ): DayKey {
  const p = parts(ms, tz)
  return `${p.year}-${p.month}-${p.day}`
}

/** A show day runs until 06:00, so a 02:00 set belongs to the previous day. */
export function festDay(ms: Ms, tz: TimeZone = DEFAULT_TZ): DayKey {
  return dayKey(ms - 6 * HOUR, tz)
}

export function addDays(k: DayKey, n: number): DayKey {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** "Thu 2 Jul", or "Thursday 2 Jul" when `long`. Day keys are zone-free, so format in UTC. */
export function dayLabel(k: DayKey, long = false): string {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-GB', { weekday: long ? 'long' : 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** "Oslo" from "Europe/Oslo", "New York" from "America/New_York". */
export const tzCity = (tz: TimeZone) => tz.split('/').pop()!.replace(/_/g, ' ')

/** Every day from `start` to `end` inclusive (capped at 21). */
export function eventDays(start?: DayKey, end?: DayKey): DayKey[] {
  const out: DayKey[] = []
  if (!start) return out
  let k = start
  for (let i = 0; i < 21 && k <= (end || start); i++) {
    out.push(k)
    k = addDays(k, 1)
  }
  return out
}
