/*
 * Admin (HQ): create the event, add stages and hand each one to its stage
 * manager, decide who has access, and set what each festival role may do.
 * Everyone with admin view sees it; only admin edit can change anything.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAccess, sortStages, stageRoleOf, type Preview } from '../access/access'
import { useNow } from '../clock/clock'
import { pendingRequests, roleLevel, stageCrew, usersWithAccess } from '../domain/admin'
import { DEFAULT_ROLES, EVENT_TYPES, LEVELS, PERM_KEYS, tapeHex } from '../domain/constants'
import { peopleFor } from '../domain/people'
import { stageManagers } from '../domain/people'
import { dayLabel, eventDays, relTime } from '../domain/time'
import { useSnapshot } from '../data/hooks'
import { useAccess, useSession } from '../session/hooks'
import { Avatar } from '../shell/Avatar'
import { Icon } from '../shell/Icon'
import { homePath } from '../shell/nav'
import { personName } from '../shell/people'
import { colourVar } from '../shell/style'
import type { Level, ModuleId } from '../types/model'
import { useAdminActions } from './adminActions'
import { Head } from './common'
import { useEvent } from './hooks'

type Tab = 'stages' | 'access' | 'roles' | 'event' | 'depts'

function StagesTab({ canEdit }: { canEdit: boolean }) {
  const snap = useSnapshot()
  const act = useAdminActions()
  const { T } = useEvent()
  const name = (uid: string) => personName(snap, uid)
  return (
    <>
      {canEdit && <div className="row end gap-b"><button type="button" className="btn primary" onClick={() => act.editStage()}><Icon name="plus" />Add {T.stage.toLowerCase()}</button></div>}
      <div className="grid g3">
        {sortStages(Object.values(snap.col.stages)).map(s => {
          const managers = stageManagers(snap, s.id)
          return (
            <section key={s.id} className="panel tapeL" style={colourVar(tapeHex(s.tape))} aria-label={s.name}>
              <div className="ph">
                <h3>{s.name}</h3>
                {canEdit && <div className="actions"><button type="button" className="btn sm" onClick={() => act.editStage(s, true)} aria-label={`Edit ${s.name}`}><Icon name="edit" /></button></div>}
              </div>
              <div className="pb stack small">
                <span className="muted">{[s.location, s.radio && `Radio ${s.radio}`, s.capacity && `${Number(s.capacity).toLocaleString('en-GB')} capacity`].filter(Boolean).join(' · ')}</span>
                <span><b>{T.stage} managers</b></span>
                {managers.length ? managers.map(u => (
                  <span key={u} className="row nowrap">
                    <Avatar uid={u} name={name(u)} />{name(u)}
                    {canEdit && <button type="button" className="btn sm danger push" onClick={() => act.removeManager(u, s.id)} aria-label={`Remove ${name(u)} as manager of ${s.name}`}>Remove</button>}
                  </span>
                )) : <span className="muted">None yet</span>}
                {canEdit && <button type="button" className="btn sm self-start" onClick={() => act.addDemoUser(s.id, true)}><Icon name="plus" />Appoint {T.stage.toLowerCase()} manager</button>}
                <span className="muted">{stageCrew(snap, s.id).length} crew with app access · {peopleFor(snap.col.people, s.id).length} in personnel list</span>
              </div>
            </section>
          )
        })}
        {!Object.keys(snap.col.stages).length && <div className="panel"><p className="empty">No {T.stages.toLowerCase()} yet.</p></div>}
      </div>
    </>
  )
}

function AccessTab({ canEdit }: { canEdit: boolean }) {
  const snap = useSnapshot()
  const act = useAdminActions()
  const t = useNow(60_000)
  const name = (uid: string) => personName(snap, uid)
  const requests = pendingRequests(snap)
  const users = usersWithAccess(snap).sort((a, b) => name(a).localeCompare(name(b)))
  const stages = sortStages(Object.values(snap.col.stages))
  return (
    <>
      {canEdit && requests.length > 0 && (
        <section className="panel gap-b">
          <div className="ph"><h3>Waiting for access</h3><span className="badge">{requests.length}</span></div>
          <ul className="list">
            {requests.map(r => (
              <li key={r.id}>
                <Avatar uid={r.id} name={name(r.id)} />
                <div className="stack">
                  <b>{name(r.id)}</b>
                  <span className="small muted">{[r.note, r.stage && `wants ${snap.col.stages[r.stage]?.name}`, relTime(r.at, t)].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="row push">
                  <button type="button" className="btn sm go" onClick={() => act.editAccess(r.id)}>Give access</button>
                  <button type="button" className="btn sm danger" onClick={() => act.decline(r.id)}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="panel">
        <div className="ph">
          <h3>People with access</h3>
          {canEdit && <div className="actions"><button type="button" className="btn sm primary" onClick={() => act.editAccess()}><Icon name="plus" />Give someone access</button></div>}
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Name</th><th>Festival role</th><th>Stages</th><th>Linked personnel entry</th><th /></tr></thead>
            <tbody>
              {users.map(u => {
                const m = snap.col.members[u]
                const roles = stages.map(s => [s, stageRoleOf(snap, u, s.id)] as const).filter(([, r]) => r)
                return (
                  <tr key={u}>
                    <td><div className="row nowrap"><Avatar uid={u} name={name(u)} /><b>{name(u)}</b></div></td>
                    <td>{(snap.roles[m?.role ?? 'none'] ?? DEFAULT_ROLES.none).label}</td>
                    <td>
                      {roles.length ? roles.map(([s, r]) => (
                        <span key={s.id} className="chip mr"><span className="tape thin" style={colourVar(tapeHex(s.tape))} />{s.name} · {r === 'manager' ? 'SM' : 'crew'}</span>
                      )) : '—'}
                    </td>
                    <td className="small">{m?.person && snap.col.people[m.person] ? snap.col.people[m.person].name : <span className="muted">—</span>}</td>
                    <td>{canEdit && <button type="button" className="btn sm" onClick={() => act.editAccess(u)} aria-label={`Edit access for ${name(u)}`}><Icon name="edit" /></button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function RolesTab({ canEdit }: { canEdit: boolean }) {
  const snap = useSnapshot()
  const act = useAdminActions()
  const session = useSession()
  const navigate = useNavigate()
  const { T } = useEvent()
  const roles = snap.roles
  const stages = sortStages(Object.values(snap.col.stages))

  /** "Preview the app as": see exactly what a role or stage role sees, then land where they would. */
  const preview = (v: string) => {
    let p: Preview | null = null
    if (v.startsWith('role:')) p = { type: 'role', role: v.slice(5) }
    else if (v.startsWith('stage:')) {
      const [, level, sid] = v.split(':')
      p = { type: 'stage', sid, level: level as 'manager' | 'crew' }
    }
    session.setPreview(p)
    navigate(homePath(createAccess(snap, { ...session.viewer, preview: p })))
  }

  return (
    <>
      <p className="muted gap-b measure">
        Festival roles apply everywhere. On top of that, a <b>{T.stage.toLowerCase()} manager</b> can edit everything on their own {T.stage.toLowerCase()} (run sheet, {T.performers.toLowerCase()}, contacts, crew list, clocks, riders), and <b>{T.stage.toLowerCase()} crew</b> can view their {T.stage.toLowerCase()} and send messages.
      </p>
      <section className="panel">
        <div className="ph">
          <h3>Festival roles</h3>
          {canEdit && <div className="actions"><button type="button" className="btn sm" onClick={act.newRole}><Icon name="plus" />Add role</button></div>}
        </div>
        <div className="tbl-wrap">
          <table className="matrix">
            <thead><tr><th>Role</th>{PERM_KEYS.map(([k, l]) => <th key={k}>{l.replace('Artists', T.performers)}</th>)}<th>{T.performer} contacts</th></tr></thead>
            <tbody>
              {Object.entries(roles).map(([key, r]) => {
                const editable = canEdit && !r.locked
                return (
                  <tr key={key}>
                    <td>
                      <b>{r.label}</b>
                      {canEdit && !DEFAULT_ROLES[key] && <> <button type="button" className="btn sm danger" onClick={() => act.deleteRole(key)}>Remove</button></>}
                    </td>
                    {PERM_KEYS.map(([k, l]) => {
                      const v = roleLevel(roles, key, k)
                      return (
                        <td key={k}>
                          {editable
                            ? (
                              <select value={v} aria-label={`${r.label}: ${l}`} onChange={e => act.setPerm(key, k, Number(e.target.value) as Level)}>
                                {LEVELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                              </select>
                            )
                            : <span className={`lv${v}`}>{LEVELS[v]}</span>}
                        </td>
                      )
                    })}
                    <td>
                      {editable
                        ? <input type="checkbox" checked={!!r.contacts} aria-label={`${r.label} sees ${T.performer.toLowerCase()} contacts`} onChange={e => act.setContacts(key, e.target.checked)} />
                        : r.contacts || key === 'admin' ? 'Yes' : 'No'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="row gap-t">
        <label className="row small">
          Preview the app as
          <select className="inline-sel" value="" onChange={e => preview(e.target.value)} aria-label="Preview the app as">
            <option value="">—</option>
            <optgroup label="Festival roles">{Object.entries(roles).map(([k, r]) => <option key={k} value={`role:${k}`}>{r.label}</option>)}</optgroup>
            {stages.map(s => (
              <optgroup key={s.id} label={s.name}>
                <option value={`stage:manager:${s.id}`}>{T.stage} manager</option>
                <option value={`stage:crew:${s.id}`}>{T.stage} crew</option>
              </optgroup>
            ))}
          </select>
        </label>
      </div>
    </>
  )
}

const MODULES: [ModuleId, string][] = [['accommodation', 'Accommodation'], ['riders', 'Riders']]

function EventTab({ canEdit }: { canEdit: boolean }) {
  const access = useAccess()
  const session = useSession()
  const act = useAdminActions()
  const { cfg, tz, T } = useEvent()
  if (!cfg) return null
  const days = eventDays(cfg.start, cfg.end)
  return (
    <div className="grid g2">
      <section className="panel">
        <div className="ph">
          <h3>{cfg.name || 'Event'}</h3>
          {canEdit && <div className="actions"><button type="button" className="btn sm" onClick={act.editEvent}><Icon name="edit" />Edit</button></div>}
        </div>
        <div className="pb">
          <dl className="kv">
            <dt>Type</dt><dd>{EVENT_TYPES[cfg.type]?.label}</dd>
            <dt>Dates</dt><dd>{days.length ? `${dayLabel(days[0], true)} – ${dayLabel(days[days.length - 1], true)}` : '—'}</dd>
            <dt>Time zone</dt><dd>{tz}</dd>
            <dt>Expected visitors</dt><dd>{cfg.visitors ? Number(cfg.visitors).toLocaleString('en-GB') : '—'}</dd>
            <dt>Vocabulary</dt><dd>{T.performer} / {T.stage}</dd>
          </dl>
        </div>
      </section>
      <section className="panel">
        <div className="ph"><h3>Modules</h3></div>
        <ul className="list">
          {MODULES.map(([k, l]) => (
            <li key={k}><label className="row"><input type="checkbox" checked={access.moduleOn(k)} disabled={!canEdit} onChange={e => act.setModule(k, e.target.checked)} /> <b>{l}</b></label></li>
          ))}
          <li className="small muted">Run sheets, clocks, personnel and messages are always on.</li>
        </ul>
      </section>
      {session.mode === 'demo' && canEdit && (
        <section className="panel">
          <div className="ph"><h3>Demo data</h3></div>
          <div className="pb stack">
            <p className="muted">Demo mode keeps everything in this browser only. With the backend, it's shared live with your team.</p>
            <div className="row">
              <button type="button" className="btn" onClick={() => act.resetDemo(false)}>Reload sample festival</button>
              <button type="button" className="btn" onClick={() => act.resetDemo(true)}>Start a blank event</button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function DeptsTab({ canEdit }: { canEdit: boolean }) {
  const act = useAdminActions()
  const { cfg } = useEvent()
  return (
    <section className="panel narrow">
      <div className="ph">
        <h3>Departments</h3>
        {canEdit && <div className="actions"><button type="button" className="btn sm" onClick={() => act.editDept()}><Icon name="plus" />Add</button></div>}
      </div>
      <ul className="list">
        {(cfg?.depts ?? []).map(d => (
          <li key={d.id}>
            <span className="tape" style={colourVar(tapeHex(d.tape))} />
            <span>{d.name}</span>
            {canEdit && <button type="button" className="btn sm push" onClick={() => act.editDept(d)} aria-label={`Edit ${d.name}`}><Icon name="edit" /></button>}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Admin() {
  const access = useAccess()
  const { T } = useEvent()
  const [tab, setTab] = useState<Tab>('stages')
  const canEdit = access.perm('admin') >= 2
  const tabs: [Tab, string][] = [['stages', `${T.stages} & managers`], ['access', 'People with access'], ['roles', 'Roles'], ['event', 'Event'], ['depts', 'Departments']]
  return (
    <>
      <Head title="Admin" sub={`Create the event, add ${T.stages.toLowerCase()}, and hand each ${T.stage.toLowerCase()} to its ${T.stage.toLowerCase()} manager. They take it from there.`} />
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={k === tab} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div role="tabpanel">
        {tab === 'stages' && <StagesTab canEdit={canEdit} />}
        {tab === 'access' && <AccessTab canEdit={canEdit} />}
        {tab === 'roles' && <RolesTab canEdit={canEdit} />}
        {tab === 'event' && <EventTab canEdit={canEdit} />}
        {tab === 'depts' && <DeptsTab canEdit={canEdit} />}
      </div>
    </>
  )
}
