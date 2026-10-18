// Time zone helpers ported from public/showctrl.html. All conversion uses the
// event time zone via Intl, never the device's zone.

import { FEST_DAY_OFFSET } from '../types/constants'
import type { DayKey, Ms, TimeZone } from '../types/model'

type Parts = Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>

const fmtCache: Record<string, Intl.DateTimeFormat> = {}

/** Wall-clock parts of `ms` in `tz`. */
export function parts(ms: Ms, tz: TimeZone): Parts {
  const f = fmtCache[tz] ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const o = {} as Parts
  for (const p of f.formatToParts(ms)) if (p.type in { year: 1, month: 1, day: 1, hour: 1, minute: 1, second: 1 }) o[p.type as keyof Parts] = p.value
  if (o.hour === '24') o.hour = '00'
  return o
}

/** Offset of `tz` from UTC at `ms`, in ms. */
function tzOffset(ms: Ms, tz: TimeZone): number {
  const p = parts(ms, tz)
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000
}

/** `YYYY-MM-DDTHH:mm` wall-clock time in `tz` → epoch ms. */
export function fromLocal(str: string, tz: TimeZone): Ms | null {
  if (!str) return null
  const [d, t = '00:00'] = str.split('T')
  const [Y, M, D] = d.split('-').map(Number)
  const [h, m] = t.split(':').map(Number)
  const guess = Date.UTC(Y, M - 1, D, h, m)
  const first = guess - tzOffset(guess, tz)
  return guess - tzOffset(first, tz)
}

/** Epoch ms → `YYYY-MM-DDTHH:mm` wall-clock time in `tz`. */
export function toLocal(ms: Ms | null | undefined, tz: TimeZone): string {
  if (ms == null) return ''
  const p = parts(ms, tz)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

export function fmtTime(ms: Ms, tz: TimeZone, seconds = false): string {
  const p = parts(ms, tz)
  return `${p.hour}:${p.minute}` + (seconds ? `:${p.second}` : '')
}

export function dayKey(ms: Ms, tz: TimeZone): DayKey {
  const p = parts(ms, tz)
  return `${p.year}-${p.month}-${p.day}`
}

/** The show day `ms` belongs to. A show day runs until 06:00. */
export function festDay(ms: Ms, tz: TimeZone): DayKey {
  return dayKey(ms - FEST_DAY_OFFSET, tz)
}

export function addDays(k: DayKey, n: number): DayKey {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Every day of the event, start to end inclusive (max 21). */
export function eventDays(cfg: { start?: DayKey; end?: DayKey } | null | undefined): DayKey[] {
  const out: DayKey[] = []
  if (!cfg?.start) return out
  const last = cfg.end || cfg.start
  for (let k = cfg.start, i = 0; i < 21 && k <= last; i++, k = addDays(k, 1)) out.push(k)
  return out
}

/** e.g. "Fri 10 Jul", or "Friday 10 Jul" with `long`. */
export function dayLabel(k: DayKey, long = false): string {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-GB', { weekday: long ? 'long' : 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** The city part of a time zone, e.g. Europe/Oslo → Oslo. */
export function tzCity(tz: TimeZone): string {
  return tz.split('/').pop()!.replace(/_/g, ' ')
}
