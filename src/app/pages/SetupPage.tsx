import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCollection, useStore } from '../../data/hooks'
import { tr } from '../../i18n'
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
          <h1>{tr('Stage setup · {stage}', { stage: st.name })}</h1>
          <p>{tr('Stage details, who can use this stage in showctrl, and the template every new day sheet is built from.')}</p>
        </div>
        <div className="actions"><button type="button" className="btn" onClick={() => setDialog('stage')}>{tr('Edit details')}</button></div>
      </div>
      <div className="grid g2">
        <section className="panel">
          <div className="ph"><h3>{tr('Details')}</h3></div>
          <div className="pb">
            <dl className="kv">
              <dt>{tr('Location')}</dt><dd>{st.location || '—'}</dd>
              <dt>{tr('Radio channel')}</dt><dd>{st.radio || '—'}</dd>
              <dt>{tr('Capacity')}</dt><dd>{st.capacity ? Number(st.capacity).toLocaleString('en-GB') : '—'}</dd>
              <dt>{tr('Colour')}</dt><dd><span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} /> {tr(st.tape)}</dd>
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="ph"><h3>{tr('Day sheet template')}</h3><div className="actions"><button type="button" className="btn sm" onClick={() => setDialog('template')}>{tr('Edit')}</button></div></div>
          <div className="pb">
            <dl className="kv">{TPL_FIELDS.map(([k, l]) => <div key={k} style={{ display: 'contents' }}><dt>{tr(l)}</dt><dd className="num">{Math.abs(tp[k])} min</dd></div>)}</dl>
          </div>
        </section>

        <section className="panel">
          <div className="ph">
            <h3>{tr('Stage team in showctrl')}</h3>
            {store.mode === 'local' && <div className="actions"><button type="button" className="btn sm primary" onClick={() => setDialog('crew')}>{tr('+ Add')}</button></div>}
          </div>
          {reqs.length > 0 && (
            <div className="pb" style={{ borderBottom: '1px solid var(--line)' }}>
              <b>{tr('Asking to join')}</b>
              {reqs.map(r => (
                <div key={r.id} className="row" style={{ marginTop: '.5rem' }}>
                  <TeamMember uid={r.id} name={name(r.id)} sub={r.note || tr('No message')} />
                  <button type="button" className="btn sm go" style={{ marginLeft: 'auto' }} onClick={async () => { await setCrew(r.id, true); await store.delete('requests', r.id) }}>{tr('Add to team')}</button>
                  <button type="button" className="btn sm" onClick={() => void store.delete('requests', r.id)}>{tr('Decline')}</button>
                </div>
              ))}
            </div>
          )}
          <ul className="list">
            {managers.map(u => <li key={u}><TeamMember uid={u} name={name(u)} sub={tr('Stage manager (set by festival admin)')} /></li>)}
            {crew.map(u => (
              <li key={u}>
                <TeamMember uid={u} name={name(u)} sub={tr('Stage crew')} />
                <button type="button" className="btn sm danger" style={{ marginLeft: 'auto' }} onClick={() => void setCrew(u, false)}>{tr('Remove')}</button>
              </li>
            ))}
            {!managers.length && !crew.length && <li className="muted">{tr('Nobody yet.')}</li>}
          </ul>
          <p className="small muted" style={{ padding: '0 1rem 1rem' }}>
            {tr('Stage crew can see this stage’s run sheet, {performers}, crew list and display, and send messages. Only stage managers change things.', { performers: t.performers.toLowerCase() })}
          </p>
        </section>
      </div>

      {dialog === 'stage' && <StageForm stage={st} onClose={() => setDialog(null)} onDeleted={() => navigate('/hq', { replace: true })} />}
      {dialog === 'template' && <TemplateForm stage={st} onClose={() => setDialog(null)} />}
      {dialog === 'crew' && <DemoUserForm sid={sid} asManager={false} onClose={() => setDialog(null)} />}
    </>
  )
}
