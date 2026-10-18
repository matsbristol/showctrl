import { useState } from 'react'
import { useCollection, useConfig } from '../../data/hooks'
import { initials, personColor } from '../../shared/people'
import { TAPE } from '../../types/constants'
import type { Id, Person } from '../../types/model'
import { ImportForm, PersonForm } from '../people/forms'
import { Tel } from '../runsheet/parts'
import { useAccess } from '../session'

type Dialog = { type: 'person'; person: Person | null } | { type: 'import' } | null

/** HQ: the festival-wide contact list. Stage: "Crew & contacts" for that stage. */
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

  const list = Object.values(people)
    .filter(p => (!fs || p.stages.includes(fs)) && (!fd || p.dept === fd)
      && (!q || [p.name, p.title, p.company, p.phone, p.email].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((x, y) => (y.lead ? 1 : 0) - (x.lead ? 1 : 0) || (dept(x.dept)?.name ?? '').localeCompare(dept(y.dept)?.name ?? '') || x.name.localeCompare(y.name))
  const canEdit = (p: Person) => a.canW('personnel') || p.stages.some(s => a.canW('personnel', s))

  return (
    <>
      <div className="head">
        <div>
          <h1>{sid ? `Crew & contacts · ${stages[sid]?.name}` : 'Personnel'}</h1>
          <p>{sid ? 'Everyone working on this stage, with how to reach them.' : 'The festival-wide contact list. Filter by stage or department, or paste a crew list straight from a spreadsheet.'}</p>
        </div>
        {w && (
          <div className="actions">
            <button type="button" className="btn" onClick={() => setDialog({ type: 'import' })}>Paste list</button>
            <button type="button" className="btn primary" onClick={() => setDialog({ type: 'person', person: null })}>+ Add person</button>
          </div>
        )}
      </div>
      <div className="filters">
        <input type="search" placeholder="Search name, phone, company…" aria-label="Search personnel" value={q} onChange={e => setQ(e.target.value)} />
        {!sid && (
          <select aria-label="Stage" value={fsState} onChange={e => setFs(e.target.value)}>
            <option value="">All stages and HQ</option>
            {a.stagesSorted().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select aria-label="Department" value={fd} onChange={e => setFd(e.target.value)}>
          <option value="">All departments</option>
          {cfg?.depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="small muted">{list.length} {list.length === 1 ? 'person' : 'people'}</span>
      </div>
      <div className="panel tbl-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Role</th><th>Department</th>{!sid && <th>Stages</th>}<th>Phone</th><th>Email</th><th>Accreditation</th><th /></tr>
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
                  <td>{p.title}{p.lead && <> <span className="chip ac">Lead</span></>}</td>
                  <td>{d ? <span className="row"><span className="tape" style={{ ['--c' as string]: TAPE[d.tape], width: 10 }} />{d.name}</span> : '—'}</td>
                  {!sid && <td className="small">{p.stages.map(s => stages[s]?.name).filter(Boolean).join(', ') || 'HQ'}</td>}
                  <td>{p.phone ? <Tel phone={p.phone} /> : '—'}</td>
                  <td className="small">{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : '—'}</td>
                  <td>
                    {p.accred ? <span className="chip ac">{p.accred}</span> : '—'}
                    {users.has(p.id) && <> <span className="chip go" title="Has access to showctrl">App</span></>}
                  </td>
                  <td>{canEdit(p) && <button type="button" className="btn sm" onClick={() => setDialog({ type: 'person', person: p })} aria-label={`Edit ${p.name}`}>Edit</button>}</td>
                </tr>
              )
            })}
            {!list.length && <tr><td colSpan={8} className="empty">Nobody listed yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {dialog?.type === 'person' && <PersonForm person={dialog.person} sid={sid} onClose={() => setDialog(null)} />}
      {dialog?.type === 'import' && <ImportForm sid={sid} onClose={() => setDialog(null)} />}
    </>
  )
}
