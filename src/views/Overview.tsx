/* Festival HQ overview: every stage at a glance, plus what's arriving soon. */
import { Link } from 'react-router-dom'
import { useNow } from '../clock/clock'
import { HOUR, KINDS, MIN, tapeHex } from '../domain/constants'
import { eff, nowNext } from '../domain/runsheet'
import { peopleFor, stageLead } from '../domain/people'
import { dayKey, fmtTime } from '../domain/time'
import { useSnapshot } from '../data/hooks'
import { useAccess } from '../session/hooks'
import { hqPath, stagePath } from '../shell/nav'
import { colourVar } from '../shell/style'
import type { Stage } from '../types/model'
import { DelayChip, Head, Slot, Tel } from './common'
import { useEvent } from './hooks'

function StageCard({ stage }: { stage: Stage }) {
  const snap = useSnapshot()
  const t = useNow(15_000)
  const { T } = useEvent()
  const { cur, next } = nowNext(snap.col.ros, stage.id, t)
  const lead = stageLead(snap, stage.id)
  const crew = peopleFor(snap.col.people, stage.id).length
  return (
    <section className="panel stagecard">
      <div className="sh">
        <span className="tape" style={colourVar(tapeHex(stage.tape))} />
        <h2><Link className="plain" to={stagePath(stage.id, 'today')}>{stage.name}</Link></h2>
        <DelayChip sid={stage.id} />
      </div>
      <Slot label="Now" item={cur} isNow />
      <Slot label="Next" item={next} isNow={false} />
      <div className="sc-meta">
        {lead ? <span>SM <b>{lead.name}</b> <Tel phone={lead.phone} /></span> : <span>No {T.stage.toLowerCase()} manager yet</span>}
        {stage.radio && <span>Radio <b>{stage.radio}</b></span>}
        <span><b>{crew}</b> crew</span>
      </div>
    </section>
  )
}

/** Arrivals and departures from 30 minutes ago to 4 hours ahead. */
function ArrivalsDepartures() {
  const snap = useSnapshot()
  const access = useAccess()
  const t = useNow(30_000)
  const { tz } = useEvent()
  const soon = Object.values(snap.col.ros)
    .filter(i => (i.kind === 'arrival' || i.kind === 'departure') && access.canSeeStage(i.stage) && eff(i).s > t - 30 * MIN && eff(i).s < t + 4 * HOUR)
    .sort((a, b) => eff(a).s - eff(b).s)
    .slice(0, 10)
  return (
    <section className="panel">
      <div className="ph"><h3>Arrivals &amp; departures, next 4 hours</h3></div>
      {soon.length ? (
        <ul className="list">
          {soon.map(i => (
            <li key={i.id}>
              <span className="num tcol"><b>{fmtTime(eff(i).s, false, tz)}</b></span>
              <span className={`kind k-${i.kind}`}>{KINDS[i.kind].label}</span>
              <span>
                {i.artist ? <Link to={hqPath('artist', i.artist)}>{snap.col.artists[i.artist]?.name ?? i.title}</Link> : i.title}
                <span className="muted small"> · {snap.col.stages[i.stage]?.name}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="empty">Nobody arriving or leaving in the next four hours.</p>}
    </section>
  )
}

function CheckIns() {
  const snap = useSnapshot()
  const t = useNow(60_000)
  const { tz, T } = useEvent()
  const today = dayKey(t, tz)
  const arriving = Object.values(snap.col.bookings).filter(b => b.checkIn === today && b.status !== 'cancelled')
  const guest = (b: (typeof arriving)[number]) => (b.artist ? snap.col.artists[b.artist]?.name ?? `Removed ${T.performer.toLowerCase()}` : b.guest || 'Guest')
  return (
    <section className="panel">
      <div className="ph">
        <h3>Hotel check-ins today</h3>
        <div className="actions"><Link className="btn sm" to={hqPath('accommodation')}>Open</Link></div>
      </div>
      {arriving.length ? (
        <ul className="list">
          {arriving.slice(0, 8).map(b => (
            <li key={b.id}><span>{guest(b)}</span><span className="muted small push">{snap.col.hotels[b.hotel]?.name}</span></li>
          ))}
        </ul>
      ) : <p className="empty">No check-ins today.</p>}
    </section>
  )
}

export function Overview() {
  const access = useAccess()
  const { T } = useEvent()
  const stages = access.visibleStages()
  const stage = T.stage.toLowerCase()
  return (
    <>
      <Head title="Festival overview" sub={`Every ${stage} at a glance. Open a ${stage} for its own run sheet, crew and display.`} />
      <div className="grid g3 gap-b">
        {stages.length ? stages.map(s => <StageCard key={s.id} stage={s} />) : (
          <div className="panel"><p className="empty">No {T.stages.toLowerCase()} yet.{access.perm('admin') >= 2 && <> Add them in <Link to={hqPath('admin')}>Admin</Link>.</>}</p></div>
        )}
      </div>
      <div className="grid g2">
        {/* Latest messages join this grid in step 7. */}
        <ArrivalsDepartures />
        {access.moduleOn('accommodation') && access.perm('accommodation') >= 1 && <CheckIns />}
      </div>
    </>
  )
}
