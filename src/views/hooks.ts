/* Hooks shared by the workspace views. */
import { useSearchParams } from 'react-router-dom'
import { now } from '../clock/clock'
import { termsOf } from '../domain/constants'
import { DEFAULT_TZ, eventDays, festDay } from '../domain/time'
import { useSnapshot } from '../data/hooks'
import type { DayKey } from '../types/model'

/** The event time zone and vocabulary. */
export function useEvent() {
  const snap = useSnapshot()
  return { cfg: snap.cfg, tz: snap.cfg?.tz ?? DEFAULT_TZ, T: termsOf(snap.cfg) }
}

/**
 * The festival day being looked at, kept in the URL (`?day=2026-07-03`) so
 * a link opens the same day. Defaults to today during the event, else day 1.
 */
export function useDay(): { day: DayKey; days: DayKey[]; setDay: (d: DayKey) => void } {
  const { cfg, tz } = useEvent()
  const [params, setParams] = useSearchParams()
  const days = eventDays(cfg?.start, cfg?.end)
  const asked = params.get('day')
  const today = festDay(now(), tz)
  const day = asked && days.includes(asked) ? asked : days.includes(today) ? today : days[0] ?? today
  const setDay = (d: DayKey) => setParams(p => { p.set('day', d); return p }, { replace: true })
  return { day, days, setDay }
}
