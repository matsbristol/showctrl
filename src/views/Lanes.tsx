/*
 * Horizontal timeline: one lane per stage (running order) or per track
 * (run sheet). Overlapping items stack into rows; points in time such as
 * doors and curfew are dashed marks; a red line marks now.
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import { useNow } from '../clock/clock'
import { HOUR, KINDS } from '../domain/constants'
import { eff } from '../domain/runsheet'
import { isPoint, packRows, timelineRange } from '../domain/timeline'
import { fmtTime } from '../domain/time'
import { useSnapshot } from '../data/hooks'
import type { DayKey, RosItem } from '../types/model'
import { useEvent } from './hooks'

export interface Lane {
  label: string
  sub?: string
  /** CSS colour for the lane's tape and its show blocks. */
  tape?: string
  /** Short block labels (title for shows, kind for the rest) instead of "Kind · Artist". */
  short?: boolean
  items: RosItem[]
}

const ROW_H = 28
/** Pixels per hour, so a long day scrolls instead of squashing. */
const PX_PER_HOUR = 130

export function Lanes({ lanes, day, onEdit }: { lanes: Lane[]; day: DayKey; onEdit?: (item: RosItem) => void }) {
  const snap = useSnapshot()
  const { tz } = useEvent()
  const t = useNow(30_000)
  const { lo, hi } = timelineRange(lanes.flatMap(l => l.items), day, tz)
  const span = hi - lo
  const pct = (ms: number) => `${((ms - lo) / span * 100).toFixed(3)}%`
  const hours: number[] = []
  for (let h = lo; h <= hi; h += HOUR) hours.push(h)
  const artistName = (id?: string) => (id ? snap.col.artists[id]?.name ?? '' : '')

  // Open each day scrolled so "now" sits a third of the way in (or at the
  // start if today isn't shown). Later re-renders keep the user's scroll.
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const line = el.querySelector<HTMLElement>('.nowline')
    el.scrollLeft = line ? Math.max(0, line.offsetLeft - el.clientWidth / 3) : 0
  }, [day])

  return (
    <div className="panel lanes" ref={box}>
      <div className="lanes-inner" style={{ '--hw': `${(HOUR / span * 100).toFixed(3)}%`, minWidth: Math.max(820, span / HOUR * PX_PER_HOUR) } as CSSProperties}>
        <div className="hours">
          {hours.map(h => <span key={h} style={{ left: pct(h) }}>{fmtTime(h, false, tz)}</span>)}
        </div>
        {lanes.map((ln, li) => {
          const { rows, count } = packRows(ln.items.filter(i => !isPoint(i)))
          // Stage access is a point too, but too frequent to be worth a mark.
          const marks = ln.items.filter(i => isPoint(i) && i.kind !== 'access')
          return (
            <div className="lane" key={ln.label}>
              <div className="ln">
                {ln.tape && <span className="tape" style={{ '--c': ln.tape } as CSSProperties} />}
                <span>{ln.label}{ln.sub && <small>{ln.sub}</small>}</span>
              </div>
              <div className="lt" style={{ '--lh': `${count * ROW_H + 10}px` } as CSSProperties}>
                {rows.map(([i, r]) => {
                  const e = eff(i)
                  const kind = KINDS[i.kind]?.label ?? i.kind
                  const text = ln.short ? (i.kind === 'show' ? i.title : kind) : `${kind} · ${artistName(i.artist) || i.title}`
                  const style = {
                    left: pct(e.s),
                    width: `max(30px, calc(${((e.e - e.s) / span * 100).toFixed(3)}% - 2px))`,
                    top: 5 + r * ROW_H,
                    '--c': ln.tape ?? 'var(--accent)',
                  } as CSSProperties
                  const props = {
                    className: `blk k-${i.kind} ${i.status}`,
                    style,
                    title: `${kind}: ${i.title} ${fmtTime(e.s, false, tz)}–${fmtTime(e.e, false, tz)}`,
                  }
                  return onEdit
                    ? <button key={i.id} type="button" {...props} onClick={() => onEdit(i)}><b>{text}</b></button>
                    : <div key={i.id} {...props}><b>{text}</b></div>
                })}
                {marks.map(i => (
                  <div key={i.id} className="mark" style={{ left: pct(eff(i).s) }} title={`${KINDS[i.kind]?.label}: ${i.title} ${fmtTime(eff(i).s, false, tz)}`}>
                    {(i.kind === 'curfew' || i.kind === 'doors') && <span>{KINDS[i.kind].label} {fmtTime(eff(i).s, false, tz)}</span>}
                  </div>
                ))}
                {t >= lo && t <= hi && <div className="nowline" style={{ left: pct(t) }} data-l={li === 0 ? fmtTime(t, false, tz) : undefined} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
