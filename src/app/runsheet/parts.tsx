import { useEffect, useRef } from 'react'
import { useCollection } from '../../data/hooks'
import { eff, packRows, stageDelay } from '../../lib/runsheet'
import { countdownState, fmtCountdown, fmtTime, fromLocal } from '../../lib/time'
import { HOUR, KINDS, MIN } from '../../types/constants'
import type { ArtistStatus, DayKey, Id, RosItem } from '../../types/model'
import { useNow, useTz } from '../session'
import { kindClass, kindIcon, kindLabel } from './helpers'
import { Icon } from '../Icon'
import { ArtistRisk } from '../risk/RiskChip'

/** A kind's colour, icon and name. The same colours are used on the timeline and run sheet rows. */
export function KindTag({ kind }: { kind: string }) {
  return <span className={`kind ${kindClass(kind)}`}><Icon name={kindIcon(kind)} />{kindLabel(kind)}</span>
}

/** A key to the colours, for the kinds that appear in `kinds`. */
export function KindLegend({ kinds }: { kinds: string[] }) {
  const order = Object.keys(KINDS)
  const present = [...new Set(kinds.map(k => (k === 'set' ? 'show' : k === 'break' ? 'other' : k)))].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  if (!present.length) return null
  return <div className="kind-legend" aria-label="Key">{present.map(k => <KindTag key={k} kind={k} />)}</div>
}

/** A live countdown to `target`, coloured as it nears and passes. */
export function Countdown({ target, warn = 5, title }: { target: number; warn?: number; title?: string }) {
  const t = useNow()
  const ms = target - t
  return <span className={`cd ${countdownState(ms, warn)}`} title={title}>{fmtCountdown(ms)}</span>
}

export function Tel({ phone }: { phone?: string }) {
  return phone ? <a className="tel" href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a> : null
}

export function StatusChip({ status }: { status?: ArtistStatus }) {
  const cls: Partial<Record<ArtistStatus, string>> = { 'on stage': 'go', ready: 'go', backstage: 'ac', arrived: 'ac', travelling: 'sb', cancelled: 'st' }
  return <span className={`chip ${status ? cls[status] ?? '' : ''}`}>{status ?? '—'}</span>
}

/** "On time", "10 min behind" or "5 min ahead" for a stage. */
export function DelayChip({ sid }: { sid: Id }) {
  const ros = useCollection('ros')
  const tz = useTz()
  const now = useNow(10_000)
  const d = stageDelay(ros, sid, now, tz)
  if (d > 0) return <span className="chip st">{Math.round(d / MIN)} min behind</span>
  if (d < 0) return <span className="chip ac">{Math.round(-d / MIN)} min ahead</span>
  return <span className="chip go">On time</span>
}

/** One "Now" or "Next" row of a stage card. */
export function Slot({ label, item, isNow }: { label: string; item?: RosItem; isNow: boolean }) {
  const tz = useTz()
  const artists = useCollection('artists')
  if (!item) {
    return <div className="slot"><span className="lbl">{label}</span><span className="ttl muted">{isNow ? 'Nothing on stage' : 'No more shows'}</span><span /></div>
  }
  const e = eff(item)
  const a = item.artist ? artists[item.artist] : undefined
  return (
    <div className={`slot${isNow ? ' now' : ''}`}>
      <span className="lbl">{label}</span>
      <span className="ttl">{item.title}{item.kind === 'show' && <> <ArtistRisk artistId={item.artist} dot /></>}</span>
      <Countdown target={isNow ? e.e : e.s} />
      <span className="sub">
        {isNow ? `${kindLabel(item.kind)} ends ${fmtTime(e.e, tz)}` : `On stage ${fmtTime(e.s, tz)}`}
        {a ? ` · ${a.status}` : ''}
      </span>
    </div>
  )
}

/** A row in a vertical day sheet. */
export function SheetRow({ item, showArtist, onClick }: { item: RosItem; showArtist?: boolean; onClick?: () => void }) {
  const tz = useTz()
  const t = useNow(5_000)
  const artists = useCollection('artists')
  const e = eff(item)
  const live = item.status === 'live'
  const running = !live && item.status !== 'done' && e.s <= t && e.e > t && e.e - e.s >= 5 * MIN
  const past = !live && item.status !== 'done' && e.e <= t && e.s < t
  const artistName = item.artist ? artists[item.artist]?.name ?? '' : ''
  const label = showArtist && item.artist ? artistName : item.artist && item.title === artistName ? '' : item.title
  return (
    <li
      className={`${item.status ?? ''}${running ? ' live' : ''} ${kindClass(item.kind)}${onClick ? ' click' : ''}`}
      {...(onClick ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (ev: React.KeyboardEvent) => { if (ev.key === 'Enter') onClick() } } : {})}
    >
      <span className="tm">
        {item.delay ? <s>{fmtTime(item.start, tz)}</s> : null}
        {fmtTime(e.s, tz)}{e.e - e.s >= 5 * MIN ? `–${fmtTime(e.e, tz)}` : ''}
      </span>
      <span className="what"><KindTag kind={item.kind} />{label}{item.notes ? <small>{item.notes}</small> : null}</span>
      {item.status === 'done' ? <span className="chip">Done</span>
        : running ? <span className="chip go">Now</span>
        : past ? <span className="chip">Passed</span>
        : <Countdown target={live ? e.e : e.s} title={live ? 'Ends in' : 'Starts in'} />}
    </li>
  )
}

export interface Lane {
  label: string
  sub?: string
  /** CSS colour for the lane's blocks. */
  color?: string
  /** Short labels: the title for shows, the kind for everything else. */
  short?: boolean
  items: RosItem[]
}

/** The horizontal timeline, with blocks packed into rows and a red now line. */
export function Lanes({ lanes, day, onPick }: { lanes: Lane[]; day: DayKey; onPick?: (it: RosItem) => void }) {
  const tz = useTz()
  const t = useNow(30_000)
  const artists = useCollection('artists')
  const scroller = useRef<HTMLDivElement>(null)

  const all = lanes.flatMap(l => l.items)
  let lo: number, hi: number
  if (all.length) { lo = Math.min(...all.map(i => eff(i).s)); hi = Math.max(...all.map(i => eff(i).e)) }
  else { lo = fromLocal(`${day}T12:00`, tz)!; hi = lo + 12 * HOUR }
  lo = Math.floor((lo - 30 * MIN) / HOUR) * HOUR
  hi = Math.ceil((hi + 30 * MIN) / HOUR) * HOUR
  if (hi - lo < 6 * HOUR) hi = lo + 6 * HOUR
  const span = hi - lo
  const pct = (ms: number) => `${((ms - lo) / span * 100).toFixed(3)}%`
  const hours: number[] = []
  for (let h = lo; h <= hi; h += HOUR) hours.push(h)
  const nowIn = t >= lo && t <= hi

  // Scroll so "now" sits a third of the way in, once per day.
  useEffect(() => {
    const el = scroller.current
    const nl = el?.querySelector<HTMLElement>('.nowline')
    if (el) el.scrollLeft = nl ? Math.max(0, nl.offsetLeft + 130 - el.clientWidth / 3) : 0
  }, [day])

  return (
    <div className="panel lanes" ref={scroller} style={{ marginBottom: '1rem' }}>
      <div className="lanes-inner" style={{ ['--hw' as string]: `${(HOUR / span * 100).toFixed(3)}%`, minWidth: Math.max(820, span / HOUR * 130) }}>
        <div className="hours">{hours.map(h => <span key={h} style={{ left: pct(h) }}>{fmtTime(h, tz)}</span>)}</div>
        {lanes.map((ln, li) => {
          const { out, rows } = packRows(ln.items.filter(i => eff(i).e - eff(i).s >= 5 * MIN))
          const marks = ln.items.filter(i => eff(i).e - eff(i).s < 5 * MIN && i.kind !== 'access')
          return (
            <div className="lane" key={ln.label}>
              <div className="ln">
                {ln.color && <span className="tape" style={{ ['--c' as string]: ln.color }} />}
                <span>{ln.label}{ln.sub && <small>{ln.sub}</small>}</span>
              </div>
              <div className="lt" style={{ ['--lh' as string]: `${rows * 28 + 10}px` }}>
                {out.map(([i, r]) => {
                  const e = eff(i)
                  // The colour and icon carry the kind, so the text can name the act.
                  const text = ln.short ? (i.kind === 'show' || i.kind === 'other' || i.kind === 'meeting' ? i.title : kindLabel(i.kind)) : (i.artist && artists[i.artist]?.name) || i.title
                  const props = {
                    className: `blk ${kindClass(i.kind)} ${i.status ?? ''}`,
                    style: { left: pct(e.s), width: `max(30px, calc(${((e.e - e.s) / span * 100).toFixed(3)}% - 2px))`, top: 5 + r * 28, ['--c' as string]: ln.color ?? 'var(--accent)' },
                    title: `${kindLabel(i.kind)}: ${i.title} ${fmtTime(e.s, tz)}–${fmtTime(e.e, tz)}`,
                  }
                  return onPick
                    ? <button type="button" key={i.id} {...props} onClick={() => onPick(i)}><Icon name={kindIcon(i.kind)} /><b>{text}</b></button>
                    : <div key={i.id} {...props}><Icon name={kindIcon(i.kind)} /><b>{text}</b></div>
                })}
                {marks.map(i => (
                  <div key={i.id} className="mark" style={{ left: pct(eff(i).s) }} title={`${kindLabel(i.kind)}: ${i.title} ${fmtTime(eff(i).s, tz)}`}>
                    {(i.kind === 'curfew' || i.kind === 'doors') && <span>{kindLabel(i.kind)} {fmtTime(eff(i).s, tz)}</span>}
                  </div>
                ))}
                {nowIn && <div className="nowline" style={{ left: pct(t) }} data-l={li === 0 ? fmtTime(t, tz) : undefined} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
