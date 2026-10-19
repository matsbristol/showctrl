/*
 * Personnel: the festival-wide contact list in HQ, or "Crew & contacts" for
 * one stage. These are records of people, separate from app users; an
 * "App" chip marks someone who also has access to showctrl.
 */
import { useState } from 'react'
import { deptName, deptTape, filterPeople, personUser } from '../domain/people'
import { sortStages } from '../access/access'
import { useSnapshot } from '../data/hooks'
import { useAccess } from '../session/hooks'
import { Avatar } from '../shell/Avatar'
import { Icon } from '../shell/Icon'
import { colourVar } from '../shell/style'
import type { Id } from '../types/model'
import { Head, Tel } from './common'
import { usePersonnelActions } from './personnelActions'

export function Personnel({ sid }: { sid: Id | null }) {
  const snap = useSnapshot()
  const access = useAccess()
  const act = usePersonnelActions(sid)
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const depts = snap.cfg?.depts ?? []
  const stages = sortStages(Object.values(snap.col.stages))
  const canAdd = access.canW('personnel', sid)
  const list = filterPeople(snap.col.people, depts, { stage: sid ?? (stageFilter || undefined), dept: dept || undefined, q })

  return (
    <>
      <Head
        title={sid ? `Crew & contacts · ${snap.col.stages[sid]?.name}` : 'Personnel'}
        sub={sid ? 'Everyone working on this stage, with how to reach them.' : 'The festival-wide contact list. Filter by stage or department, or paste a crew list straight from a spreadsheet.'}
        actions={canAdd && <>
          <button type="button" className="btn" onClick={act.importList}>Paste list</button>
          <button type="button" className="btn primary" onClick={() => act.editPerson()}><Icon name="plus" />Add person</button>
        </>}
      />
      <div className="filters">
        <input type="search" placeholder="Search name, phone, company…" aria-label="Search personnel" value={q} onChange={e => setQ(e.target.value)} />
        {!sid && (
          <select aria-label="Stage" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
            <option value="">All stages and HQ</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select aria-label="Department" value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">All departments</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
              const uid = personUser(snap, p.id)
              // You can edit someone if you can edit personnel on (their first) stage, or here.
              const canEdit = access.canW('personnel', p.stages?.[0]) || canAdd
              return (
                <tr key={p.id}>
                  <td>
                    <div className="row nowrap">
                      <Avatar uid={uid ?? p.id} name={p.name} />
                      <div className="stack"><b>{p.name}</b>{p.company && <span className="small muted">{p.company}</span>}</div>
                    </div>
                  </td>
                  <td>{p.title}{p.lead && <> <span className="chip ac">Lead</span></>}</td>
                  <td>{p.dept ? <span className="row nowrap"><span className="tape thin" style={colourVar(deptTape(depts, p.dept))} />{deptName(depts, p.dept)}</span> : '—'}</td>
                  {!sid && <td className="small">{p.stages?.map(s => snap.col.stages[s]?.name).filter(Boolean).join(', ') || 'HQ'}</td>}
                  <td>{p.phone ? <Tel phone={p.phone} /> : '—'}</td>
                  <td className="small">{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : '—'}</td>
                  <td>
                    {p.accred ? <span className="chip ac">{p.accred}</span> : '—'}
                    {uid && <> <span className="chip go" title="Has access to showctrl">App</span></>}
                  </td>
                  <td>{canEdit && <button type="button" className="btn sm" onClick={() => act.editPerson(p)} aria-label={`Edit ${p.name}`}><Icon name="edit" /></button>}</td>
                </tr>
              )
            })}
            {!list.length && <tr><td colSpan={8} className="empty">{q || dept || stageFilter ? 'Nobody matches.' : 'Nobody listed yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
