/* Small pieces shared by the workspace views. */
import type { ReactNode } from 'react'
import { useNow } from '../clock/clock'
import { cdState, fmtCountdown } from '../domain/clocks'
import { KINDS, MIN } from '../domain/constants'
import { eff, stageDelay } from '../domain/runsheet'
import { dayLabel, fmtTime } from '../domain/time'
import { useSnapshot } from '../data/hooks'
import type { ArtistStatus, Id, ItemKind, Ms, RosItem } from '../types/model'
import { useDay, useEvent } from './hooks'

/** Page heading with an optional line under it and actions on the right. */
export function Head({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

/** Live countdown to `target`; amber under `warn` minutes, red once over. */
export function Countdown({ target, warn = 5, title }: { target: Ms; warn?: number; title?: string }) {
  const t = useNow(250)
  const ms = target - t
  return <span className={`cd ${cdState(ms, warn)}`} title={title}>{fmtCountdown(ms)}</span>
}

/** Pick the festival day. */
export function DaySeg() {
  const { day, days, setDay } = useDay()
  return (
    <div className="seg" role="group" aria-label="Day">
      {days.map((d, i) => (
        <button key={d} type="button" aria-pressed={d === day} onClick={() => setDay(d)}>
          Day {i + 1} · {dayLabel(d)}
        </button>
      ))}
    </div>
  )
}

/** "On time", "10 min behind" or "5 min ahead", from what's on or next. */
export function DelayChip({ sid }: { sid: Id }) {
  const snap = useSnapshot()
  const d = stageDelay(snap.col.ros, sid, useNow(15_000))
  if (d > 0) return <span className="chip st">{Math.round(d / MIN)} min behind</span>
  if (d < 0) return <span className="chip ac">{Math.round(-d / MIN)} min ahead</span>
  return <span className="chip go">On time</span>
}

const STATUS_TONE: Partial<Record<ArtistStatus, string>> = { 'on stage': 'go', ready: 'go', backstage: 'ac', arrived: 'ac', travelling: 'sb', cancelled: 'st' }

export const StatusChip = ({ status }: { status?: ArtistStatus }) =>
  <span className={`chip ${status ? STATUS_TONE[status] ?? '' : ''}`}>{status ?? '—'}</span>

/** Coloured label for an item's kind ("Show", "Load in", …). */
export const KindTag = ({ kind }: { kind: ItemKind }) => <span className={`kind k-${kind}`}>{KINDS[kind]?.label ?? kind}</span>

/** "Now" (time left) or "Next" (time to start) for one stage. */
export function Slot({ label, item, isNow }: { label: string; item?: RosItem; isNow: boolean }) {
  const snap = useSnapshot()
  const { tz } = useEvent()
  if (!item) {
    return (
      <div className="slot">
        <span className="lbl">{label}</span>
        <span className="ttl muted">{isNow ? 'Nothing on stage' : 'No more shows'}</span>
        <span />
      </div>
    )
  }
  const e = eff(item)
  const artist = item.artist ? snap.col.artists[item.artist] : undefined
  return (
    <div className={`slot ${isNow ? 'now' : ''}`}>
      <span className="lbl">{label}</span>
      <span className="ttl">{item.title}</span>
      <Countdown target={isNow ? e.e : e.s} />
      <span className="sub">
        {isNow ? `${KINDS[item.kind]?.label ?? ''} ends ${fmtTime(e.e, false, tz)}` : `On stage ${fmtTime(e.s, false, tz)}`}
        {artist && ` · ${artist.status}`}
      </span>
    </div>
  )
}

/** A phone link that dials, with only digits and + in the number. */
export const Tel = ({ phone }: { phone?: string }) =>
  phone ? <a className="tel" href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a> : null

/**
 * One line of a vertical day sheet: time (with the planned time struck
 * through when delayed), what, and a countdown or state on the right.
 */
export function SheetRow({ item, showArtist }: { item: RosItem; showArtist?: boolean }) {
  const snap = useSnapshot()
  const { tz } = useEvent()
  const t = useNow(15_000)
  const e = eff(item)
  const live = item.status === 'live'
  const long = e.e - e.s >= 5 * MIN
  const running = !live && item.status !== 'done' && e.s <= t && e.e > t && long
  const passed = !live && item.status !== 'done' && e.e <= t && e.s < t
  const artistName = item.artist ? snap.col.artists[item.artist]?.name ?? '' : ''
  // Day sheet items are titled with the artist; don't repeat it.
  const label = showArtist && item.artist ? artistName : item.artist && item.title === artistName ? '' : item.title
  const right = item.status === 'done' ? <span className="chip">Done</span>
    : running ? <span className="chip go">Now</span>
    : passed ? <span className="chip">Passed</span>
    : <Countdown target={live ? e.e : e.s} title={live ? 'Ends in' : 'Starts in'} />
  return (
    <li className={`${item.status} ${running ? 'live' : ''} k-${item.kind}`}>
      <span className="tm">
        {item.delay ? <s>{fmtTime(item.start, false, tz)}</s> : null}
        {fmtTime(e.s, false, tz)}{long && `–${fmtTime(e.e, false, tz)}`}
      </span>
      <span className="what">
        <KindTag kind={item.kind} />{label}
        {item.notes && <small>{item.notes}</small>}
      </span>
      {right}
    </li>
  )
}
