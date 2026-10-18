import { Link } from 'react-router-dom'
import { useCollection, useConfig } from '../../data/hooks'
import { eff } from '../../lib/runsheet'
import { dayKey, fmtTime } from '../../lib/time'
import { moduleOn } from '../../shared/access'
import { peopleFor, stageLead } from '../../shared/people'
import { HOUR, MIN, TAPE } from '../../types/constants'
import type { Stage } from '../../types/model'
import { MsgBlock } from '../messages/MsgBlock'
import { DelayChip, KindTag, Slot, Tel } from '../runsheet/parts'
import { useNowNext } from '../runsheet/helpers'
import { useAccess, useNow, useTerms, useTz } from '../session'

function StageCard({ st }: { st: Stage }) {
  const { cur, next } = useNowNext(st.id)
  const members = useCollection('members')
  const people = useCollection('people')
  const lead = stageLead(st.id, members, people)
  const crew = peopleFor(people, st.id).length
  return (
    <section className="panel stagecard">
      <div className="sh">
        <span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} />
        <h2><Link to={`/s/${st.id}/today`} style={{ color: 'inherit', textDecoration: 'none' }}>{st.name}</Link></h2>
        <DelayChip sid={st.id} />
      </div>
      <Slot label="Now" item={cur} isNow />
      <Slot label="Next" item={next} isNow={false} />
      <div className="sc-meta">
        {lead ? <span>SM <b>{lead.name}</b> <Tel phone={lead.phone} /></span> : <span>No stage manager yet</span>}
        {st.radio && <span>Radio <b>{st.radio}</b></span>}
        <span><b>{crew}</b> crew</span>
      </div>
    </section>
  )
}

function ArrivalsBlock() {
  const ros = useCollection('ros')
  const artists = useCollection('artists')
  const stages = useCollection('stages')
  const tz = useTz()
  const t = useNow(30_000)
  const soon = Object.values(ros)
    .filter(i => (i.kind === 'arrival' || i.kind === 'departure') && eff(i).s > t - 30 * MIN && eff(i).s < t + 4 * HOUR)
    .sort((x, y) => eff(x).s - eff(y).s)
    .slice(0, 10)
  return (
    <section className="panel">
      <div className="ph"><h3>Arrivals &amp; departures, next 4 hours</h3></div>
      {soon.length ? (
        <ul className="list">
          {soon.map(i => (
            <li key={i.id}>
              <span className="num" style={{ minWidth: '3.2rem' }}><b>{fmtTime(eff(i).s, tz)}</b></span>
              <KindTag kind={i.kind} />
              <span>
                {i.artist ? <Link to={`/hq/artists/${i.artist}`}>{artists[i.artist]?.name ?? i.title}</Link> : i.title}
                {' '}<span className="muted small">· {stages[i.stage]?.name}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="empty">Nobody arriving or leaving in the next four hours.</p>}
    </section>
  )
}

function CheckInsBlock() {
  const bookings = useCollection('bookings')
  const hotels = useCollection('hotels')
  const artists = useCollection('artists')
  const tz = useTz()
  const today = dayKey(useNow(60_000), tz)
  const list = Object.values(bookings).filter(b => b.checkIn === today && b.status !== 'cancelled')
  return (
    <section className="panel">
      <div className="ph"><h3>Hotel check-ins today</h3><div className="actions"><Link className="btn sm" to="/hq/accommodation">Open</Link></div></div>
      {list.length ? (
        <ul className="list">
          {list.slice(0, 8).map(b => (
            <li key={b.id}>
              <span>{(b.artist && artists[b.artist]?.name) || b.guest || 'Guest'}</span>
              <span className="muted small" style={{ marginLeft: 'auto' }}>{hotels[b.hotel]?.name ?? ''}</span>
            </li>
          ))}
        </ul>
      ) : <p className="empty">No check-ins today.</p>}
    </section>
  )
}

export function OverviewPage() {
  const a = useAccess()
  const t = useTerms()
  const cfg = useConfig('event')
  const stages = a.visibleStages()
  return (
    <>
      <div className="head">
        <div>
          <h1>Festival overview</h1>
          <p>Every {t.stage.toLowerCase()} at a glance. Open a {t.stage.toLowerCase()} for its own run sheet, crew and display.</p>
        </div>
      </div>
      <div className="grid g3" style={{ marginBottom: '1rem' }}>
        {stages.length ? stages.map(s => <StageCard key={s.id} st={s} />) : (
          <div className="panel"><p className="empty">No {t.stages.toLowerCase()} yet. {a.perm('admin') >= 2 && <>Add them in <Link to="/hq/admin">Admin</Link>.</>}</p></div>
        )}
      </div>
      <div className="grid g2">
        <MsgBlock sid={null} />
        <ArrivalsBlock />
        {moduleOn(cfg, 'accommodation') && a.perm('accommodation') >= 1 && <CheckInsBlock />}
      </div>
    </>
  )
}
