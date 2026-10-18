// The show day being viewed, kept in the URL (?day=YYYY-MM-DD) so it survives reloads and links.

import { useSearchParams } from 'react-router-dom'
import { useConfig } from '../data/hooks'
import { eventDays, festDay } from '../lib/time'
import type { DayKey } from '../types/model'
import { useNow, useTz } from './session'

/** The selected day, defaulting to today if it's an event day, else the first day. */
export function useDay(): [DayKey, (d: DayKey) => void] {
  const cfg = useConfig('event')
  const tz = useTz()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const days = eventDays(cfg)
  const want = params.get('day')
  const today = festDay(now, tz)
  const day = want && days.includes(want) ? want : days.includes(today) ? today : days[0] ?? today
  const set = (d: DayKey) => setParams(p => { p.set('day', d); return p }, { replace: true })
  return [day, set]
}
