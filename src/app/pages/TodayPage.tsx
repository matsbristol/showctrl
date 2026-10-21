import { Link } from 'react-router-dom'
import { useCollection, useConfig } from '../../data/hooks'
import { moduleOn } from '../../shared/modules'
import { eff, itemsFor } from '../../lib/runsheet'
import { peopleFor, stageLead } from '../../shared/people'
import { TAPE } from '../../types/constants'
import type { Id } from '../../types/model'
import { Icon } from '../Icon'
import { MsgBlock } from '../messages/MsgBlock'
import { TrucksSoon } from '../trucks/parts'
import { DelayChip, SheetRow, Slot, Tel } from '../runsheet/parts'
import { useNowNext } from '../runsheet/helpers'
import { useNow, useTz } from '../session'

/** A stage's start page: now and next, what's coming up, key contacts and messages. */
export function TodayPage({ sid }: { sid: Id }) {
  const stages = useCollection('stages')
  const cfg = useConfig('event')
  const ros = useCollection('ros')
  const members = useCollection('members')
  const people = useCollection('people')
  const tz = useTz()
  const t = useNow(15_000)
  const st = stages[sid]
  const { cur, next } = useNowNext(sid)
  const upcoming = itemsFor(ros, sid, tz).filter(i => i.status !== 'done' && eff(i).e > t).sort((x, y) => eff(x).s - eff(y).s).slice(0, 10)
  const lead = stageLead(sid, members, people)
  const team = peopleFor(people, sid).slice(0, 8)
  const sub = [st.location, st.radio && `Radio ${st.radio}`, lead ? `Stage manager ${lead.name}` : 'No stage manager assigned'].filter(Boolean).join(' · ')
  return (
    <>
      <div className="head">
        <div><h1>{st.name}</h1><p>{sub}</p></div>
        <div className="actions">
          <DelayChip sid={sid} />
          {moduleOn(cfg, 'display') && <Link className="btn" to={`/s/${sid}/display`}><Icon name="display" />Stage display</Link>}
        </div>
      </div>
      <div className="grid g2" style={{ marginBottom: '1rem' }}>
        <section className="panel stagecard">
          <div className="sh"><span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} /><h2>On stage</h2></div>
          <Slot label="Now" item={cur} isNow />
          <Slot label="Next" item={next} isNow={false} />
        </section>
        <section className="panel">
          <div className="ph"><h3>Coming up</h3><div className="actions"><Link className="btn sm" to={`/s/${sid}/runsheet`}>Full run sheet</Link></div></div>
          {upcoming.length ? <ul className="sheet">{upcoming.map(i => <SheetRow key={i.id} item={i} showArtist />)}</ul> : <p className="empty">Nothing more scheduled.</p>}
        </section>
      </div>
      <div className="grid g2">
        {moduleOn(cfg, 'personnel') && <section className="panel">
          <div className="ph"><h3>Key contacts</h3><div className="actions"><Link className="btn sm" to={`/s/${sid}/personnel`}>All crew</Link></div></div>
          {team.length ? team.map(p => (
            <div className="contact" key={p.id}>
              <div><b>{p.name}</b> <span className="r">{p.title}</span></div>
              <span className="c"><Tel phone={p.phone} /></span>
            </div>
          )) : <p className="empty">No crew listed yet.</p>}
        </section>}
        <MsgBlock sid={sid} />
        <TrucksSoon sid={sid} />
      </div>
    </>
  )
}
