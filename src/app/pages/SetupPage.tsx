import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCollection, useStore } from '../../data/hooks'
import { stageRoleOf } from '../../shared/access'
import { initials, personColor, personName } from '../../shared/people'
import { DEFAULT_TPL, TAPE, TPL_FIELDS } from '../../types/constants'
import type { Id } from '../../types/model'
import { DemoUserForm, StageForm, TemplateForm } from '../setup/forms'
import { useTerms } from '../session'

type Dialog = 'stage' | 'template' | 'crew' | null

function TeamMember({ uid, name, sub }: { uid: Id; name: string; sub: string }) {
  return (
    <>
      <span className="av" style={{ ['--c' as string]: personColor(uid) }}>{initials(name)}</span>
      <span><b>{name}</b><span className="small muted"> · {sub}</span></span>
    </>
  )
}

/** Stage details, the stage team in showctrl, and the day sheet template. Stage managers and admins only. */
export function SetupPage({ sid }: { sid: Id }) {
  const t = useTerms()
  const store = useStore()
  const navigate = useNavigate()
  const stages = useCollection('stages')
  const members = useCollection('members')
  const people = useCollection('people')
  const stageteam = useCollection('stageteam')
  const requests = useCollection('requests')
  const [dialog, setDialog] = useState<Dialog>(null)
  const st = stages[sid]
  const tp = { ...DEFAULT_TPL, ...st.template }
  const name = (uid: Id) => personName(uid, members, people)
  const managers = Object.keys(members).filter(u => members[u].stages?.[sid] === 'manager')
  const crew = Object.keys(stageteam[sid]?.crew ?? {})
  const reqs = Object.values(requests).filter(r => r.stage === sid && !stageRoleOf(members, stageteam, r.id, sid) && !(members[r.id]?.role && members[r.id].role !== 'none'))

  const setCrew = async (uid: Id, on: boolean) => {
    const next = { ...stageteam[sid]?.crew }
    if (on) next[uid] = true
    else delete next[uid]
    await store.set('stageteam', sid, { crew: next })
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Stage setup · {st.name}</h1>
          <p>Stage details, who can use this stage in showctrl, and the template every new day sheet is built from.</p>
        </div>
        <div className="actions"><button type="button" className="btn" onClick={() => setDialog('stage')}>Edit details</button></div>
      </div>
      <div className="grid g2">
        <section className="panel">
          <div className="ph"><h3>Details</h3></div>
          <div className="pb">
            <dl className="kv">
              <dt>Location</dt><dd>{st.location || '—'}</dd>
              <dt>Radio channel</dt><dd>{st.radio || '—'}</dd>
              <dt>Capacity</dt><dd>{st.capacity ? Number(st.capacity).toLocaleString('en-GB') : '—'}</dd>
              <dt>Colour</dt><dd><span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} /> {st.tape}</dd>
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="ph"><h3>Day sheet template</h3><div className="actions"><button type="button" className="btn sm" onClick={() => setDialog('template')}>Edit</button></div></div>
          <div className="pb">
            <dl className="kv">{TPL_FIELDS.map(([k, l]) => <div key={k} style={{ display: 'contents' }}><dt>{l}</dt><dd className="num">{Math.abs(tp[k])} min</dd></div>)}</dl>
          </div>
        </section>

        <section className="panel">
          <div className="ph">
            <h3>Stage team in showctrl</h3>
            {store.mode === 'local' && <div className="actions"><button type="button" className="btn sm primary" onClick={() => setDialog('crew')}>+ Add</button></div>}
          </div>
          {reqs.length > 0 && (
            <div className="pb" style={{ borderBottom: '1px solid var(--line)' }}>
              <b>Asking to join</b>
              {reqs.map(r => (
                <div key={r.id} className="row" style={{ marginTop: '.5rem' }}>
                  <TeamMember uid={r.id} name={name(r.id)} sub={r.note || 'No message'} />
                  <button type="button" className="btn sm go" style={{ marginLeft: 'auto' }} onClick={async () => { await setCrew(r.id, true); await store.delete('requests', r.id) }}>Add to team</button>
                  <button type="button" className="btn sm" onClick={() => void store.delete('requests', r.id)}>Decline</button>
                </div>
              ))}
            </div>
          )}
          <ul className="list">
            {managers.map(u => <li key={u}><TeamMember uid={u} name={name(u)} sub="Stage manager (set by festival admin)" /></li>)}
            {crew.map(u => (
              <li key={u}>
                <TeamMember uid={u} name={name(u)} sub="Stage crew" />
                <button type="button" className="btn sm danger" style={{ marginLeft: 'auto' }} onClick={() => void setCrew(u, false)}>Remove</button>
              </li>
            ))}
            {!managers.length && !crew.length && <li className="muted">Nobody yet.</li>}
          </ul>
          <p className="small muted" style={{ padding: '0 1rem 1rem' }}>
            Stage crew can see this stage’s run sheet, {t.performers.toLowerCase()}, crew list and display, and send messages. Only stage managers change things.
          </p>
        </section>
      </div>

      {dialog === 'stage' && <StageForm stage={st} onClose={() => setDialog(null)} onDeleted={() => navigate('/hq', { replace: true })} />}
      {dialog === 'template' && <TemplateForm stage={st} onClose={() => setDialog(null)} />}
      {dialog === 'crew' && <DemoUserForm sid={sid} asManager={false} onClose={() => setDialog(null)} />}
    </>
  )
}
