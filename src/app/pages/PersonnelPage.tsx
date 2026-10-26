import { useState } from 'react'
import { useCollection, useConfig, useStore } from '../../data/hooks'
import { tr } from '../../i18n'
import { stageRoleOf } from '../../shared/access'
import { initials, personColor, personName } from '../../shared/people'
import { rid } from '../../lib/id'
import { relTime } from '../../lib/time'
import { TAPE } from '../../types/constants'
import type { Id, Person } from '../../types/model'
import { AccessForm} from '../admin/forms'
import { roleLabel } from '../admin/roleLabel'
import { ImportForm, PersonForm } from '../people/forms'
import { Tel } from '../runsheet/parts'
import { useAccess, useNow } from '../session'

type Dialog = { type: 'person'; person: Person | null } | { type: 'import' } | { type: 'access'; person: Person } | { type: 'edit-access'; uid: Id } | { type: 'new-access' } | null

/**
 * HQ "People": everyone on the event, their contact details and, for admins, their login (role,
 * stages) in the same list, with requests to join on top. Stage: "Crew & contacts" for that stage.
 */
export function PersonnelPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const cfg = useConfig('event')
  const people = useCollection('people')
  const members = useCollection('members')
  const stages = useCollection('stages')
  const [q, setQ] = useState('')
  const [fd, setFd] = useState('')
  const [fsState, setFs] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const fs = sid ?? fsState
  const w = sid ? a.canW('personnel', sid) : a.canW('personnel')
  const dept = (id?: Id | null) => cfg?.depts.find(d => d.id === id)
  const users = new Set(Object.values(members).map(m => m.person).filter(Boolean))
  const store = useStore()
  // Admins see and manage logins here (demo mode too, with demo people).
  const canGrant = a.canW('admin')
  const hasLogin = (p: Person) => users.has(p.id) || (!!p.email && !!members[p.email.trim().toLowerCase()])
  const stageteam = useCollection('stageteam')
  const requests = useCollection('requests')
  const now = useNow(60_000)
  const admin = !sid && canGrant
  // The login that belongs to a person: linked to their entry, or signing in with their email.
  const loginOf = (p: Person): Id | undefined => Object.values(members).find(m => m.person === p.id)?.id ?? (p.email && members[p.email.trim().toLowerCase()] ? p.email.trim().toLowerCase() : undefined)
  const roleText = (uid: Id) => {
    const m = members[uid]
    const st = a.stagesSorted().map(s => [s, stageRoleOf(members, stageteam, uid, s.id)] as const).filter(([, r]) => r).map(([s, r]) => `${r === 'manager' ? 'SM' : 'crew'} ${s.name}`)
    return [m && m.role !== 'none' ? roleLabel(a.roleDef(m.role)) : '', ...st].filter(Boolean).join(' · ') || tr('No role yet')
  }
  // Logins with no entry in the list (e.g. admins added by email): shown too, so this is the whole picture.
  const linked = new Set(Object.values(people).map(p => loginOf(p)).filter(Boolean))
  const loose = admin
    ? [...new Set([...Object.keys(members), ...Object.values(stageteam).flatMap(x => Object.keys(x.crew ?? {}))])]
      .filter(u => !linked.has(u) && (!q || `${personName(u, members, people)} ${u}`.toLowerCase().includes(q.toLowerCase())) && !fd && !fs)
      .sort((x, y) => personName(x, members, people).localeCompare(personName(y, members, people)))
    : []
  const reqs = admin ? Object.values(requests).filter(r => !members[r.id] && !a.stagesSorted().some(s => stageRoleOf(members, stageteam, r.id, s.id))) : []
  // Gives a login without an entry its own entry in the list, then opens it to fill in.
  const addDetails = async (uid: Id) => {
    const id = rid()
    const m = members[uid]
    const doc = { id, name: personName(uid, members, people), title: '', company: '', dept: m?.depts?.[0] ?? null, stages: [], phone: '', email: uid.includes('@') ? uid : '', lead: false, notes: '' } as Person
    await store.set('people', id, doc)
    if (m) await store.update('members', uid, { person: id })
    setDialog({ type: 'person', person: doc })
  }

  const list = Object.values(people)
    .filter(p => (!fs || p.stages.includes(fs)) && (!fd || p.dept === fd)
      && (!q || [p.name, p.title, p.company, p.phone, p.email].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((x, y) => (y.lead ? 1 : 0) - (x.lead ? 1 : 0) || (dept(x.dept)?.name ?? '').localeCompare(dept(y.dept)?.name ?? '') || x.name.localeCompare(y.name))
  const canEdit = (p: Person) => a.canW('personnel') || p.stages.some(s => a.canW('personnel', s))

  return (
    <>
      <div className="head">
        <div>
          <h1>{sid ? tr('Crew & contacts · {stage}', { stage: stages[sid]?.name ?? '' }) : tr('People')}</h1>
          <p>{sid ? tr('Everyone working on this stage, with how to reach them.') : admin
            ? tr('Everyone on the event: how to reach them, and who can sign in to showctrl.no and as what. Paste a crew list straight from a spreadsheet.')
            : tr('Everyone on the event and how to reach them. Filter by stage or department.')}</p>
        </div>
        {w && (
          <div className="actions">
            <button type="button" className="btn" onClick={() => setDialog({ type: 'import' })}>{tr('Paste list')}</button>
            {admin && <button type="button" className="btn" onClick={() => setDialog({ type: 'new-access' })}>{tr('+ Give someone access')}</button>}
            <button type="button" className="btn primary" onClick={() => setDialog({ type: 'person', person: null })}>{tr('+ Add person')}</button>
          </div>
        )}
      </div>
      {reqs.length > 0 && (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="ph"><h3>{tr('Waiting for access')}</h3><span className="badge">{reqs.length}</span></div>
          <ul className="list">
            {reqs.map(r => (
              <li key={r.id}>
                <div className="stack"><b>{personName(r.id, members, people)}</b><span className="small muted">{r.id}{r.note ? ` · ${r.note}` : ''}{r.stage ? ` · ${tr('wants {stage}', { stage: stages[r.stage]?.name ?? '' })}` : ''} · {relTime(r.at, now)}</span></div>
                <div className="row" style={{ marginLeft: 'auto' }}>
                  <button type="button" className="btn sm go" onClick={() => setDialog({ type: 'edit-access', uid: r.id })}>{tr('Give access')}</button>
                  <button type="button" className="btn sm danger" onClick={() => void store.delete('requests', r.id)}>{tr('Decline')}</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="filters">
        <input type="search" placeholder={tr('Search name, phone, company…')} aria-label={tr('Search personnel')} value={q} onChange={e => setQ(e.target.value)} />
        {!sid && (
          <select aria-label={tr('Stage')} value={fsState} onChange={e => setFs(e.target.value)}>
            <option value="">{tr('All stages and HQ')}</option>
            {a.stagesSorted().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select aria-label={tr('Department')} value={fd} onChange={e => setFd(e.target.value)}>
          <option value="">{tr('All departments')}</option>
          {cfg?.depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="small muted">{list.length + loose.length === 1 ? tr('1 person') : tr('{n} people', { n: list.length + loose.length })}</span>
      </div>
      <div className="panel tbl-wrap">
        <table>
          <thead>
            <tr><th>{tr('Name')}</th><th>{tr('Role')}</th><th>{tr('Department')}</th>{!sid && <th>{tr('Stages')}</th>}<th>{tr('Phone')}</th><th>{tr('Email')}</th><th>{tr('Accreditation')}</th>{admin && <th>{tr('Sign-in')}</th>}<th /></tr>
          </thead>
          <tbody>
            {list.map(p => {
              const d = dept(p.dept)
              return (
                <tr key={p.id}>
                  <td>
                    <div className="row">
                      <span className="av" style={{ ['--c' as string]: personColor(p.id) }}>{initials(p.name)}</span>
                      <div className="stack"><b>{p.name}</b>{p.company && <span className="small muted">{p.company}</span>}</div>
                    </div>
                  </td>
                  <td>{p.title}{p.lead && <> <span className="chip ac">{tr('Lead')}</span></>}</td>
                  <td>{d ? <span className="row"><span className="tape" style={{ ['--c' as string]: TAPE[d.tape], width: 10 }} />{d.name}</span> : '—'}</td>
                  {!sid && <td className="small">{p.stages.map(s => stages[s]?.name).filter(Boolean).join(', ') || 'HQ'}</td>}
                  <td>{p.phone ? <Tel phone={p.phone} /> : '—'}</td>
                  <td className="small">{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : '—'}</td>
                  <td>
                    {p.accred ? <span className="chip ac">{p.accred}</span> : '—'}
                    {!admin && hasLogin(p) && <> <span className="chip go" title={tr('Has access to showctrl.no')}>showctrl</span></>}
                  </td>
                  {admin && (
                    <td className="signin">
                      {(() => {
                        const uid = loginOf(p)
                        if (uid) return <><span className="chip go" title={tr('Signs in to showctrl.no')}>showctrl</span> <span className="small">{roleText(uid)}</span> <button type="button" className="btn sm" aria-label={tr('Edit access for {name}', { name: p.name })} onClick={() => setDialog({ type: 'edit-access', uid })}>{tr('Edit access')}</button></>
                        if (p.email || store.mode === 'local') return <button type="button" className="btn sm" title={tr('Being listed here doesn’t let them sign in. This does, and emails them.')} onClick={() => setDialog({ type: 'access', person: p })}>{tr('Give showctrl.no access')}</button>
                        return <span className="small muted" title={tr('Add an email to their entry to give them a login')}>{tr('No email')}</span>
                      })()}
                    </td>
                  )}
                  <td>{canEdit(p) && <button type="button" className="btn sm" onClick={() => setDialog({ type: 'person', person: p })} aria-label={tr('Edit {name}', { name: p.name })}>{tr('Edit')}</button>}</td>
                </tr>
              )
            })}
            {loose.map(u => (
              <tr key={`login-${u}`} className="loose">
                <td><div className="row"><span className="av" style={{ ['--c' as string]: personColor(u) }}>{initials(personName(u, members, people))}</span><div className="stack"><b>{personName(u, members, people)}</b><span className="small muted">{tr('Not in the list yet')}</span></div></div></td>
                <td>—</td><td>—</td><td>—</td><td>—</td>
                <td className="small">{u.includes('@') ? <a href={`mailto:${u}`}>{u}</a> : '—'}</td>
                <td>—</td>
                <td className="signin"><span className="chip go">showctrl</span> <span className="small">{roleText(u)}</span> <button type="button" className="btn sm" aria-label={tr('Edit access for {name}', { name: personName(u, members, people) })} onClick={() => setDialog({ type: 'edit-access', uid: u })}>{tr('Edit access')}</button></td>
                <td>{w && <button type="button" className="btn sm" onClick={() => void addDetails(u)}>{tr('Add details')}</button>}</td>
              </tr>
            ))}
            {!list.length && !loose.length && <tr><td colSpan={9} className="empty">{tr('Nobody listed yet.')}</td></tr>}
          </tbody>
        </table>
      </div>
      {dialog?.type === 'person' && <PersonForm person={dialog.person} sid={sid} onClose={() => setDialog(null)} />}
      {dialog?.type === 'import' && <ImportForm sid={sid} onClose={() => setDialog(null)} />}
      {dialog?.type === 'access' && <AccessForm uid={store.mode === 'local' ? 'demo-' + rid() : ''} isNew preset={{ email: dialog.person.email ?? '', person: dialog.person.id }} onClose={() => setDialog(null)} />}
      {dialog?.type === 'edit-access' && <AccessForm uid={dialog.uid} onClose={() => setDialog(null)} />}
      {dialog?.type === 'new-access' && <AccessForm uid={store.mode === 'local' ? 'demo-' + rid() : ''} isNew onClose={() => setDialog(null)} />}
    </>
  )
}
