import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCollection, useConfig, useStore } from '../../data/hooks'
import { LocalStore } from '../../data/localStore'
import { blankEvent, buildSample } from '../../data/sample'
import { accredLevels } from '../../lib/accred'
import { dayLabel, eventDays, relTime } from '../../lib/time'
import { rid } from '../../lib/id'
import { stageRoleOf } from '../../shared/access'
import { MODULES, moduleOn, permHidden } from '../../shared/modules'
import { initials, personColor, personName, peopleFor } from '../../shared/people'
import { DEFAULT_ROLES, EVENT_TYPES, LEVELS, PERM_KEYS, TAPE } from '../../types/constants'
import type { Dept, Id, ModuleId, PermKey, PermLevel, Stage } from '../../types/model'
import { AccessForm, DeptForm, EventForm, ManagerForm, RoleAddForm } from '../admin/forms'
import { StageForm } from '../setup/forms'
import { useAccess, useNow, useSession, useTerms } from '../session'
import { useToast } from '../ui/toast'

const TABS = ['stages', 'access', 'roles', 'modules', 'event', 'depts', 'accred'] as const
type Tab = (typeof TABS)[number]

type Dialog =
  | { type: 'stage'; stage: Stage | null } | { type: 'manager'; sid: Id }
  | { type: 'access'; uid: Id; isNew?: boolean } | { type: 'role' } | { type: 'event' }
  | { type: 'dept'; dept: Dept | null } | null

function Avatar({ uid, name }: { uid: Id; name: string }) {
  return <span className="av" style={{ ['--c' as string]: personColor(uid) }}>{initials(name)}</span>
}

/** Create the event, add stages, and hand each stage to its stage manager. */
export function AdminPage() {
  const a = useAccess()
  const t = useTerms()
  const [params, setParams] = useSearchParams()
  const want = params.get('tab') as Tab | null
  const tab: Tab = want && TABS.includes(want) ? want : 'stages'
  const [dialog, setDialog] = useState<Dialog>(null)
  const w = a.canW('admin')
  const labels: Record<Tab, string> = { stages: `${t.stages} & managers`, access: 'People with access', roles: 'Roles', modules: 'Modules', event: 'Event', depts: 'Departments', accred: 'Accreditation' }
  const close = () => setDialog(null)

  return (
    <>
      <div className="head">
        <div><h1>Admin</h1><p>Create the event, add {t.stages.toLowerCase()}, and hand each {t.stage.toLowerCase()} to its stage manager. They take it from there.</p></div>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(k => (
          <button key={k} type="button" role="tab" aria-selected={k === tab} onClick={() => setParams(p => { p.set('tab', k); return p }, { replace: true })}>{labels[k]}</button>
        ))}
      </div>
      {tab === 'stages' && <StagesTab w={w} open={setDialog} />}
      {tab === 'access' && <AccessTab w={w} open={setDialog} />}
      {tab === 'roles' && <RolesTab w={w} open={setDialog} />}
      {tab === 'modules' && <ModulesTab w={w} />}
      {tab === 'event' && <EventTab w={w} open={setDialog} />}
      {tab === 'depts' && <DeptsTab w={w} open={setDialog} />}
      {tab === 'accred' && <AccredTab w={w} />}

      {dialog?.type === 'stage' && <StageForm stage={dialog.stage} onClose={close} />}
      {dialog?.type === 'manager' && <ManagerForm sid={dialog.sid} onClose={close} />}
      {dialog?.type === 'access' && <AccessForm uid={dialog.uid} isNew={dialog.isNew} onClose={close} />}
      {dialog?.type === 'role' && <RoleAddForm onClose={close} />}
      {dialog?.type === 'event' && <EventForm onClose={close} />}
      {dialog?.type === 'dept' && <DeptForm dept={dialog.dept} onClose={close} />}
    </>
  )
}

type TabProps = { w: boolean; open: (d: Dialog) => void }

function StagesTab({ w, open }: TabProps) {
  const a = useAccess()
  const t = useTerms()
  const store = useStore()
  const members = useCollection('members')
  const people = useCollection('people')
  const stageteam = useCollection('stageteam')
  return (
    <>
      {w && <div className="row" style={{ marginBottom: '1rem', justifyContent: 'flex-end' }}><button type="button" className="btn primary" onClick={() => open({ type: 'stage', stage: null })}>+ Add {t.stage.toLowerCase()}</button></div>}
      <div className="grid g3">
        {a.stagesSorted().map(s => {
          const mgrs = Object.keys(members).filter(u => members[u].stages?.[s.id] === 'manager')
          const meta = [s.location, s.radio && `Radio ${s.radio}`, s.capacity && `${Number(s.capacity).toLocaleString('en-GB')} capacity`].filter(Boolean).join(' · ')
          return (
            <section key={s.id} className="panel tapeL" style={{ ['--c' as string]: TAPE[s.tape] }}>
              <div className="ph">
                <h3>{s.name}</h3>
                {w && <div className="actions"><button type="button" className="btn sm" aria-label={`Edit ${s.name}`} onClick={() => open({ type: 'stage', stage: s })}>Edit</button></div>}
              </div>
              <div className="pb stack small">
                {meta && <span className="muted">{meta}</span>}
                <span><b>Stage managers</b></span>
                {mgrs.map(u => (
                  <span key={u} className="row">
                    <Avatar uid={u} name={personName(u, members, people)} />{personName(u, members, people)}
                    {w && <button type="button" className="btn sm danger" style={{ marginLeft: 'auto' }} onClick={() => void store.update('members', u, { stages: { [s.id]: undefined } })}>Remove</button>}
                  </span>
                ))}
                {!mgrs.length && <span className="muted">None yet</span>}
                {w && <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => open({ type: 'manager', sid: s.id })}>+ Appoint stage manager</button>}
                <span className="muted">{Object.keys(stageteam[s.id]?.crew ?? {}).length} crew with app access · {peopleFor(people, s.id).length} in personnel list</span>
              </div>
            </section>
          )
        })}
        {!a.stagesSorted().length && <div className="panel"><p className="empty">No {t.stages.toLowerCase()} yet.</p></div>}
      </div>
    </>
  )
}

function AccessTab({ w, open }: TabProps) {
  const a = useAccess()
  const store = useStore()
  const members = useCollection('members')
  const people = useCollection('people')
  const stageteam = useCollection('stageteam')
  const stages = useCollection('stages')
  const requests = useCollection('requests')
  const now = useNow(60_000)
  const name = (u: Id) => personName(u, members, people)
  const reqs = Object.values(requests).filter(r => !members[r.id] && !a.stagesSorted().some(s => stageRoleOf(members, stageteam, r.id, s.id)))
  const users = [...new Set([...Object.keys(members), ...Object.values(stageteam).flatMap(x => Object.keys(x.crew ?? {}))])]
    .sort((x, y) => name(x).localeCompare(name(y)))

  return (
    <>
      {w && reqs.length > 0 && (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="ph"><h3>Waiting for access</h3><span className="badge">{reqs.length}</span></div>
          <ul className="list">
            {reqs.map(r => (
              <li key={r.id}>
                <Avatar uid={r.id} name={name(r.id)} />
                <div className="stack"><b>{name(r.id)}</b><span className="small muted">{r.note}{r.stage ? ` · wants ${stages[r.stage]?.name}` : ''} · {relTime(r.at, now)}</span></div>
                <div className="row" style={{ marginLeft: 'auto' }}>
                  <button type="button" className="btn sm go" onClick={() => open({ type: 'access', uid: r.id })}>Give access</button>
                  <button type="button" className="btn sm danger" onClick={() => void store.delete('requests', r.id)}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="panel">
        <div className="ph">
          <h3>People with access</h3>
          {w && <div className="actions"><button type="button" className="btn sm primary" onClick={() => open({ type: 'access', uid: store.mode === 'local' ? 'demo-' + rid() : '', isNew: true })}>+ Give someone access</button></div>}
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Name</th><th>Festival role</th><th>Stages</th><th>Linked personnel entry</th><th /></tr></thead>
            <tbody>
              {users.map(u => {
                const m = members[u]
                const st = a.stagesSorted().map(s => [s, stageRoleOf(members, stageteam, u, s.id)] as const).filter(([, r]) => r)
                return (
                  <tr key={u}>
                    <td><div className="row"><Avatar uid={u} name={name(u)} /><b>{name(u)}</b></div></td>
                    <td>{a.roleDef(m?.role || 'none').label}</td>
                    <td>{st.length ? st.map(([s, r]) => (
                      <span key={s.id} className="chip" style={{ marginRight: '.25rem' }}><span className="tape" style={{ ['--c' as string]: TAPE[s.tape], width: 10 }} />{s.name} · {r === 'manager' ? 'SM' : 'crew'}</span>
                    )) : '—'}</td>
                    <td className="small">{m?.person && people[m.person] ? people[m.person].name : <span className="muted">—</span>}</td>
                    <td>{w && <button type="button" className="btn sm" aria-label={`Edit access for ${name(u)}`} onClick={() => open({ type: 'access', uid: u })}>Edit</button>}</td>
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

function RolesTab({ w, open }: TabProps) {
  const a = useAccess()
  const t = useTerms()
  const store = useStore()
  const toast = useToast()
  const members = useCollection('members')
  const navigate = useNavigate()
  const { preview, setPreview } = useSession()

  const setPerm = (rk: string, k: PermKey, lv: PermLevel) => {
    const roles = structuredClone(a.roles)
    roles[rk].perms[k] = lv
    return store.setConfig('roles', { roles })
  }
  const setContacts = (rk: string, on: boolean) => {
    const roles = structuredClone(a.roles)
    roles[rk].contacts = on
    return store.setConfig('roles', { roles })
  }
  const removeRole = async (rk: string) => {
    if (Object.values(members).some(m => m.role === rk)) { toast('Move everyone off this role first.'); return }
    const roles = { ...a.roles }
    delete roles[rk]
    await store.setConfig('roles', { roles })
  }
  const cfg = useConfig('event')
  const keys = PERM_KEYS.filter(p => !permHidden(cfg, p.key))
  const pv = !preview ? '' : preview.type === 'role' ? `role:${preview.role}` : `stage:${preview.level}:${preview.sid}`

  return (
    <>
      <p className="muted" style={{ marginBottom: '1rem', maxWidth: '70ch' }}>
        Festival roles apply everywhere. On top of that, a <b>stage manager</b> can edit everything on their own stage (run sheet, {t.performers.toLowerCase()}, contacts, crew list, clocks, riders), and <b>stage crew</b> can view their stage and send messages.
      </p>
      <section className="panel">
        <div className="ph"><h3>Festival roles</h3>{w && <div className="actions"><button type="button" className="btn sm" onClick={() => open({ type: 'role' })}>+ Add role</button></div>}</div>
        <div className="tbl-wrap">
          <table className="matrix">
            <thead><tr><th>Role</th>{keys.map(p => <th key={p.key}>{p.key === 'artists' ? t.performers : p.label}</th>)}<th>{t.performer} contacts</th></tr></thead>
            <tbody>
              {Object.entries(a.roles).map(([rk, r]) => (
                <tr key={rk}>
                  <td>
                    <b>{r.label}</b>
                    {w && !DEFAULT_ROLES[rk] && <> <button type="button" className="btn sm danger" onClick={() => void removeRole(rk)}>Remove</button></>}
                  </td>
                  {keys.map(({ key }) => {
                    const v = rk === 'admin' ? 2 : r.perms?.[key] ?? DEFAULT_ROLES[rk]?.perms[key] ?? 0
                    return (
                      <td key={key}>
                        {w && !r.locked
                          ? (
                            <select aria-label={`${r.label} ${key}`} value={v} onChange={e => void setPerm(rk, key, Number(e.target.value) as PermLevel)}>
                              {LEVELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
                            </select>
                          )
                          : <span className={`lv${v}`}>{LEVELS[v]}</span>}
                      </td>
                    )
                  })}
                  <td>
                    {w && !r.locked
                      ? <input type="checkbox" checked={r.contacts} aria-label={`${r.label} sees contacts`} onChange={e => void setContacts(rk, e.target.checked)} />
                      : r.contacts || rk === 'admin' ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="row" style={{ marginTop: '1rem' }}>
        <label className="row small">
          Preview the app as{' '}
          <select
            className="inline-sel"
            value={pv}
            onChange={e => {
              const v = e.target.value
              if (!v) setPreview(null)
              else if (v.startsWith('role:')) setPreview({ type: 'role', role: v.slice(5) })
              else { const [, level, sid] = v.split(':'); setPreview({ type: 'stage', level: level as 'manager' | 'crew', sid }) }
              navigate('/hq')
            }}
          >
            <option value="">—</option>
            <optgroup label="Festival roles">{Object.entries(a.roles).map(([k, r]) => <option key={k} value={`role:${k}`}>{r.label}</option>)}</optgroup>
            {a.stagesSorted().map(s => (
              <optgroup key={s.id} label={s.name}>
                <option value={`stage:manager:${s.id}`}>Stage manager</option>
                <option value={`stage:crew:${s.id}`}>Stage crew</option>
              </optgroup>
            ))}
          </select>
        </label>
      </div>
    </>
  )
}

/** Switch optional sections on or off for this event. */
function ModulesTab({ w }: { w: boolean }) {
  const store = useStore()
  const cfg = useConfig('event')!
  const t = useTerms()
  const toggle = (id: ModuleId, on: boolean) => store.setConfig('event', { ...cfg, modules: { ...cfg.modules, [id]: on } })
  return (
    <>
      <p className="muted" style={{ marginBottom: '1rem', maxWidth: '70ch' }}>
        Switch on only what this event needs. A module that’s off disappears for everyone, including its pages and its columns under Roles. Its data is kept and comes back when you switch it on again.
      </p>
      <div className="grid g2">
        {Object.values(MODULES).map(m => {
          const on = moduleOn(cfg, m.id)
          return (
            <section key={m.id} className={`panel module${on ? ' on' : ''}`}>
              <label className="pb row" style={{ alignItems: 'flex-start', cursor: w ? 'pointer' : 'default' }}>
                <input type="checkbox" role="switch" checked={on} disabled={!w} aria-label={m.label} onChange={e => void toggle(m.id, e.target.checked)} />
                <span className="stack">
                  <b>{m.label}</b>
                  <span className="small muted">{m.description}</span>
                </span>
                <span className={`chip ${on ? 'go' : ''}`} style={{ marginLeft: 'auto' }}>{on ? 'On' : 'Off'}</span>
              </label>
            </section>
          )
        })}
      </div>
      <p className="small muted" style={{ marginTop: '1rem' }}>
        Always on: Overview, Running order and run sheets, {t.performers}, Stage setup and Admin.
      </p>
    </>
  )
}

function EventTab({ w, open }: TabProps) {
  const store = useStore()
  const cfg = useConfig('event')!
  const t = useTerms()
  const days = eventDays(cfg)
  return (
    <div className="grid g2">
      <section className="panel">
        <div className="ph"><h3>{cfg.name}</h3>{w && <div className="actions"><button type="button" className="btn sm" onClick={() => open({ type: 'event' })}>Edit</button></div>}</div>
        <div className="pb">
          <dl className="kv">
            <dt>Type</dt><dd>{EVENT_TYPES[cfg.type]?.label}</dd>
            <dt>Dates</dt><dd>{days.length ? `${dayLabel(days[0], true)} – ${dayLabel(days[days.length - 1], true)}` : '—'}</dd>
            <dt>Time zone</dt><dd>{cfg.tz}</dd>
            <dt>Expected visitors</dt><dd>{cfg.visitors ? Number(cfg.visitors).toLocaleString('en-GB') : '—'}</dd>
            <dt>Vocabulary</dt><dd>{t.performer} / {t.stage}</dd>
          </dl>
        </div>
      </section>
      {store instanceof LocalStore && w && (
        <section className="panel">
          <div className="ph"><h3>Demo data</h3></div>
          <div className="pb stack">
            <p className="muted">Demo mode keeps a sample festival in this browser until the shared backend is connected.</p>
            <div className="row">
              <button type="button" className="btn" onClick={() => { if (confirm('Replace the demo data with a fresh sample festival?')) store.reset(buildSample()) }}>Reload sample festival</button>
              <button type="button" className="btn danger" onClick={() => { if (confirm('Start a blank event? All demo data is removed.')) store.reset(blankEvent()) }}>Start blank</button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function DeptsTab({ w, open }: TabProps) {
  const cfg = useConfig('event')!
  return (
    <section className="panel" style={{ maxWidth: 640 }}>
      <div className="ph"><h3>Departments</h3>{w && <div className="actions"><button type="button" className="btn sm" onClick={() => open({ type: 'dept', dept: null })}>+ Add</button></div>}</div>
      <ul className="list">
        {cfg.depts.map(d => (
          <li key={d.id}>
            <span className="tape" style={{ ['--c' as string]: TAPE[d.tape], marginTop: '.45rem' }} />
            <span>{d.name}</span>
            {w && <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} aria-label={`Edit ${d.name}`} onClick={() => open({ type: 'dept', dept: d })}>Edit</button>}
          </li>
        ))}
        {!cfg.depts.length && <li className="muted">No departments yet.</li>}
      </ul>
    </section>
  )
}

/**
 * The event's accreditation levels, highest first. Renaming one renames it on everyone who has
 * it; removing one leaves people who have it as they are, so nothing is lost by accident.
 */
function AccredTab({ w }: { w: boolean }) {
  const store = useStore()
  const cfg = useConfig('event')!
  const people = useCollection('people')
  const toast = useToast()
  const levels = accredLevels(cfg)
  const [add, setAdd] = useState('')
  const count = (l: string) => Object.values(people).filter(p => p.accred === l).length
  const save = (next: string[]) => store.setConfig('event', { ...cfg, accred: next })

  const rename = async (from: string, raw: string) => {
    const to = raw.trim()
    if (!to || to === from) return
    if (levels.includes(to)) { toast(`There is already a level called ${to}.`); return }
    await save(levels.map(l => (l === from ? to : l)))
    const holders = Object.values(people).filter(p => p.accred === from)
    if (holders.length) await store.setMany('people', holders.map(p => ({ ...p, accred: to })))
  }
  const move = (i: number, by: number) => {
    const next = [...levels]
    const [l] = next.splice(i, 1)
    next.splice(i + by, 0, l)
    void save(next)
  }

  return (
    <section className="panel" style={{ maxWidth: 640 }}>
      <div className="ph"><h3>Accreditation levels</h3></div>
      <p className="pb small muted" style={{ paddingBottom: 0 }}>Highest first. Used for personnel. Renaming a level renames it for everyone who has it.</p>
      <ul className="list accred-list">
        {levels.map((l, i) => (
          <li key={l}>
            {w
              ? <input className="inline-sel" aria-label={`Rename ${l}`} defaultValue={l} onBlur={e => void rename(l, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
              : <b>{l}</b>}
            <span className="small muted">{count(l) === 1 ? '1 person' : `${count(l)} people`}</span>
            {w && (
              <span className="row" style={{ marginLeft: 'auto', gap: '.35rem' }}>
                <button type="button" className="btn sm" aria-label={`Move ${l} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="btn sm" aria-label={`Move ${l} down`} disabled={i === levels.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="btn sm danger" disabled={levels.length < 2} title={count(l) ? 'People who have it keep it until you change their entry' : undefined}
                  onClick={() => void save(levels.filter(x => x !== l))}>Remove</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {w && (
        <form className="pb row" style={{ gap: '.5rem' }} onSubmit={e => {
          e.preventDefault()
          const v = add.trim()
          if (!v) return
          if (levels.includes(v)) { toast(`There is already a level called ${v}.`); return }
          void save([...levels, v]).then(() => setAdd(''))
        }}>
          <input className="inline-sel" aria-label="New accreditation level" placeholder="e.g. Crew catering" value={add} onChange={e => setAdd(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn sm primary" disabled={!add.trim()}>+ Add level</button>
        </form>
      )}
    </section>
  )
}
