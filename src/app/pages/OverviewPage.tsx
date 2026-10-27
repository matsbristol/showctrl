import { aOrAn } from '../../lib/text'
import { Link } from 'react-router-dom'
import { useCollection, useConfig } from '../../data/hooks'
import { eff } from '../../lib/runsheet'
import { dayKey, fmtTime } from '../../lib/time'
import { moduleOn } from '../../shared/modules'
import { peopleFor, stageLead } from '../../shared/people'
import { HOUR, MIN, TAPE } from '../../types/constants'
import type { Stage } from '../../types/model'
import { MsgBlock } from '../messages/MsgBlock'
import { DelayChip, KindTag, Slot, Tel } from '../runsheet/parts'
import { useNowNext } from '../runsheet/helpers'
import { useAccess, useNow, useTerms, useTz } from '../session'
import { SetupChecklist } from '../SetupChecklist'
import { tr } from '../../i18n'

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
      <Slot label={tr('Now')} item={cur} isNow />
      <Slot label={tr('Next')} item={next} isNow={false} />
      <div className="sc-meta">
        {lead ? <span>{tr('Stage manager')} <b>{lead.name}</b> <Tel phone={lead.phone} /></span> : <span>{tr('No stage manager yet')}</span>}
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
      <div className="ph"><h3>{tr('Arrivals & departures, next 4 hours')}</h3></div>
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
      ) : <p className="empty">{tr('Nobody arriving or leaving in the next four hours.')}</p>}
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
      <div className="ph"><h3>{tr('Hotel check-ins today')}</h3><div className="actions"><Link className="btn sm" to="/hq/accommodation">{tr('Open')}</Link></div></div>
      {list.length ? (
        <ul className="list">
          {list.slice(0, 8).map(b => (
            <li key={b.id}>
              <span>{(b.artist && artists[b.artist]?.name) || b.guest || tr('Guest')}</span>
              <span className="muted small" style={{ marginLeft: 'auto' }}>{hotels[b.hotel]?.name ?? ''}</span>
            </li>
          ))}
        </ul>
      ) : <p className="empty">{tr('No check-ins today.')}</p>}
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
          <h1>{tr('Festival overview')}</h1>
          <p>{tr('Every {stage} at a glance. Open {aStage} for its own run sheet, crew and display.', { stage: t.stage.toLowerCase(), aStage: aOrAn(t.stage.toLowerCase()), stages: t.stages.toLowerCase() })}</p>
        </div>
      </div>
      <SetupChecklist />
      <div className="grid g3" style={{ marginBottom: '1rem' }}>
        {stages.length ? stages.map(s => <StageCard key={s.id} st={s} />) : (
          <div className="panel"><p className="empty">{tr('No {stages} yet.', { stages: t.stages.toLowerCase() })} {a.perm('admin') >= 2 && <>{tr('Add them in')} <Link to="/hq/admin">{tr('Admin')}</Link>.</>}</p></div>
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
