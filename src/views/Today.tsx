/* A stage's start page: what's on and next, what's coming up, who to call. */
import { Link } from 'react-router-dom'
import { useNow } from '../clock/clock'
import { tapeHex } from '../domain/constants'
import { eff, itemsFor, nowNext } from '../domain/runsheet'
import { peopleFor, stageLead } from '../domain/people'
import { useSnapshot } from '../data/hooks'
import { Icon } from '../shell/Icon'
import { stagePath } from '../shell/nav'
import { colourVar } from '../shell/style'
import type { Id } from '../types/model'
import { DelayChip, Head, SheetRow, Slot, Tel } from './common'
import { useEvent } from './hooks'

/** How many upcoming items and contacts to list. */
const UPCOMING = 10
const CONTACTS = 8

export function Today({ sid }: { sid: Id }) {
  const snap = useSnapshot()
  const { T } = useEvent()
  const t = useNow(15_000)
  const stage = snap.col.stages[sid]
  const { cur, next } = nowNext(snap.col.ros, sid, t)
  const upcoming = itemsFor(snap.col.ros, sid)
    .filter(i => i.status !== 'done' && eff(i).e > t)
    .sort((a, b) => eff(a).s - eff(b).s)
    .slice(0, UPCOMING)
  const lead = stageLead(snap, sid)
  const team = peopleFor(snap.col.people, sid).slice(0, CONTACTS)
  const sub = [stage.location, stage.radio && `Radio ${stage.radio}`, lead ? `${T.stage} manager ${lead.name}` : `No ${T.stage.toLowerCase()} manager assigned`]
    .filter(Boolean).join(' · ')

  return (
    <>
      <Head
        title={stage.name}
        sub={sub}
        actions={<>
          <DelayChip sid={sid} />
          <Link className="btn" to={stagePath(sid, 'display')}><Icon name="display" />{T.stage} display</Link>
        </>}
      />
      <div className="grid g2 gap-b">
        <section className="panel stagecard">
          <div className="sh"><span className="tape" style={colourVar(tapeHex(stage.tape))} /><h2>On {T.stage.toLowerCase()}</h2></div>
          <Slot label="Now" item={cur} isNow />
          <Slot label="Next" item={next} isNow={false} />
        </section>
        <section className="panel">
          <div className="ph">
            <h3>Coming up</h3>
            <div className="actions"><Link className="btn sm" to={stagePath(sid, 'runsheet')}>Full run sheet</Link></div>
          </div>
          {upcoming.length ? <ul className="sheet">{upcoming.map(i => <SheetRow key={i.id} item={i} showArtist />)}</ul> : <p className="empty">Nothing more scheduled.</p>}
        </section>
      </div>
      <div className="grid g2">
        <section className="panel">
          <div className="ph">
            <h3>Key contacts</h3>
            <div className="actions"><Link className="btn sm" to={stagePath(sid, 'personnel')}>All crew</Link></div>
          </div>
          {team.length ? team.map(p => (
            <div className="contact" key={p.id}>
              <div><b>{p.name}</b> <span className="r">{p.title}</span></div>
              <span className="c"><Tel phone={p.phone} /></span>
            </div>
          )) : <p className="empty">No crew listed yet.</p>}
        </section>
        {/* The stage's message channel joins this grid in step 7. */}
      </div>
    </>
  )
}
