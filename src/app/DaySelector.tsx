import { useConfig } from '../data/hooks'
import { dayLabel, eventDays } from '../lib/time'
import { useDay } from './day'

export function DaySelector() {
  const cfg = useConfig('event')
  const [day, setDay] = useDay()
  return (
    <div className="seg" role="group" aria-label="Day">
      {eventDays(cfg).map((d, i) => (
        <button key={d} type="button" aria-pressed={d === day} onClick={() => setDay(d)}>Day {i + 1} · {dayLabel(d)}</button>
      ))}
    </div>
  )
}
