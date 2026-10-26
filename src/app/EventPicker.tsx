import { useEffect, useState, type FormEvent } from 'react'
import {
  addEventAdmin, backupUrl, createEvent, listNightly, nightlyUrl, runBackupNow, createOrg, deleteEvent, deleteOrg, getEventAdmins, logout, removeEventAdmin, renameOrg,
  type EventAdmins, type EventSummary, type Me, type NamedPerson, type NightlyBackups, type OrgSummary,
} from './backend'
import { MODULES } from '../shared/modules'
import { MODULE_IDS } from '../types/constants'
import type { ModuleId } from '../types/model'
import { FontPicker } from './FontPicker'

/** Ticked when a new event is created: what nearly every event uses on show days. */
const STARTER_MODULES: ModuleId[] = ['messages', 'clocks', 'display', 'personnel']

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

/**
 * Live mode, before an event is open.
 * - Everyone sees the events they belong to (event admins run theirs inside the event).
 * - Superadmins run the whole portfolio: customers, every event, and who admins each one.
 */
export function EventPicker({ me, orgs, events, org, onOrg, onOpen, onCreated, onDeleted, onOrgCreated, onOrgRenamed, onOrgDeleted }: {
  me: Me
  orgs: OrgSummary[]
  events: EventSummary[]
  org: string | null
  onOrg: (id: string | null) => void
  onOpen: (id: string) => void
  onCreated: (e: EventSummary) => void
  onDeleted: (id: string) => void
  onOrgCreated: (o: OrgSummary) => void
  onOrgRenamed: (id: string, name: string) => void
  onOrgDeleted: (id: string) => void
}) {
  const [err, setErr] = useState('')
  const signedIn = <p className="muted" style={{ margin: '.5rem 0 1rem' }}>Signed in as <b>{me.email}</b>. <button type="button" className="linkish" onClick={() => void logout()}>Log out</button> <FontPicker className="btn sm" /></p>

  if (!me.superadmin) {
    // Grouped by customer only when someone works for more than one.
    const groups = orgs.length > 1
      ? orgs.map(o => ({ o: o as OrgSummary | null, list: events.filter(e => e.org === o.id) })).filter(g => g.list.length)
      : [{ o: null as OrgSummary | null, list: events }]
    return (
      <div className="setup">
        <img className="setup-logo" src="/logo.png" alt="showctrl" />
        <div className="panel">
          <h1>Your events</h1>
          {signedIn}
          {events.length ? groups.map(g => (
            <div key={g.o?.id ?? 'all'}>
              {g.o && <h3 className="small muted" style={{ margin: '.5rem 0 .25rem' }}>{g.o.name}</h3>}
              <EventRows events={g.list} me={me} onOpen={onOpen} />
            </div>
          )) : (
            <p className="muted" style={{ marginBottom: '1rem' }}>You haven’t been added to an event yet. Ask the event’s admin to add <b>{me.email}</b>.</p>
          )}
        </div>
      </div>
    )
  }

  const current = org ? orgs.find(o => o.id === org) : undefined
  if (!current) {
    const loose = events.filter(e => !e.org || !orgs.some(o => o.id === e.org))
    return (
      <div className="setup">
        <img className="setup-logo" src="/logo.png" alt="showctrl" />
        <div className="panel">
          <h1>Customers</h1>
          {signedIn}
          <p style={{ margin: '-.25rem 0 1rem' }}><a className="btn" href={backupUrl()} download>Download a full backup</a> <span className="small muted">Every customer and event, as one JSON file.</span></p>
          {orgs.length ? (
            <ul className="list" style={{ margin: '0 -1.5rem 1rem' }}>
              {orgs.map(o => {
                const n = events.filter(e => e.org === o.id).length
                return (
                  <li key={o.id}>
                    <div className="stack"><b>{o.name}</b><span className="small muted">{n === 1 ? '1 event' : `${n} events`}</span></div>
                    <button type="button" className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => onOrg(o.id)}>Open</button>
                  </li>
                )
              })}
            </ul>
          ) : <p className="muted" style={{ marginBottom: '1rem' }}>No customers yet. Add the first one below.</p>}
        </div>
        {loose.length > 0 && (
          <div className="panel">
            <h2 style={{ marginBottom: '.75rem' }}>Events without a customer</h2>
            <EventRows events={loose} me={me} onOpen={onOpen} onDeleted={onDeleted} manage />
          </div>
        )}
        <NewOrg onCreated={onOrgCreated} />
        <Nightly />
      </div>
    )
  }

  const mine = events.filter(e => e.org === current.id)
  return (
    <div className="setup">
      <img className="setup-logo" src="/logo.png" alt="showctrl" />
      <div className="panel">
        <button type="button" className="btn sm" style={{ marginBottom: '.75rem' }} onClick={() => onOrg(null)}>← All customers</button>
        <h1>{current.name}</h1>
        {signedIn}
        {mine.length ? <EventRows events={mine} me={me} onOpen={onOpen} onDeleted={onDeleted} manage /> : <p className="muted" style={{ marginBottom: '1rem' }}>No events yet. Create the first one below.</p>}
      </div>
      <NewEvent org={current.id} onCreated={onCreated} />
      <div className="panel">
        <h2>Customer</h2>
        <label className="fld" style={{ marginTop: '1rem' }}><span>Name</span>
          <input defaultValue={current.name} key={current.name} onBlur={e => {
            const n = e.target.value.trim()
            if (n && n !== current.name) void renameOrg(current.id, n).then(() => onOrgRenamed(current.id, n))
          }} />
        </label>
        <div className="row" style={{ marginTop: '1rem', gap: '.75rem' }}>
          <button type="button" className="btn danger" disabled={mine.length > 0} onClick={() => {
            if (!confirm(`Delete the customer ${current.name}?`)) return
            setErr('')
            deleteOrg(current.id).then(() => onOrgDeleted(current.id), e => setErr(errText(e, 'Could not delete it.')))
          }}>Delete customer</button>
          {mine.length > 0 && <span className="small muted">Delete its events first.</span>}
        </div>
        {err && <p className="small" style={{ color: 'var(--stop)', marginTop: '.5rem' }} role="alert">{err}</p>}
      </div>
    </div>
  )
}

/** The events; superadmins can also open each one's admin list. */
function EventRows({ events, me, onOpen, onDeleted, manage }: { events: EventSummary[]; me: Me; onOpen: (id: string) => void; onDeleted?: (id: string) => void; manage?: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const remove = async (e: EventSummary) => {
    const typed = prompt(`This deletes ${e.name} and everything in it: run sheets, people, messages and files. It can’t be undone.\n\nType the event’s name to delete it:`)
    if (typed == null) return
    if (typed.trim() !== e.name.trim()) { setErr('The name didn’t match, so nothing was deleted.'); return }
    setBusy(e.id)
    setErr('')
    try { await deleteEvent(e.id); onDeleted?.(e.id) } catch (x) { setErr(errText(x, 'Could not delete it.')) } finally { setBusy(null) }
  }
  return (
    <ul className="list" style={{ margin: '0 -1.5rem 1rem' }}>
      {events.map(e => (
        <li key={e.id} data-id={e.id} style={{ flexWrap: 'wrap' }}>
          <div className="stack"><b>{e.name}</b><span className="small muted">{e.owner === me.email ? 'You created this event' : `Created by ${e.owner}`}</span></div>
          <div className="row" style={{ marginLeft: 'auto', gap: '.5rem' }}>
            {manage && <button type="button" className="btn" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>Admins</button>}
            {manage && <a className="btn" href={backupUrl(e.id)} download title="Download everything in this event as a JSON file">Backup</a>}
            {manage && <button type="button" className="btn danger" disabled={busy === e.id} onClick={() => void remove(e)}>{busy === e.id ? 'Deleting…' : 'Delete'}</button>}
            <button type="button" className="btn primary" onClick={() => onOpen(e.id)}>Open</button>
          </div>
          {manage && open === e.id && <AdminList event={e.id} me={me} />}
        </li>
      ))}
      {err && <li className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</li>}
    </ul>
  )
}

/** Superadmins: who runs one event. They are Festival admin there and nowhere else. */
function AdminList({ event, me }: { event: string; me: Me }) {
  const [data, setData] = useState<EventAdmins | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    getEventAdmins(event).then(d => { if (alive) setData(d) }, e => { if (alive) setErr(errText(e, 'Could not load the admins.')) })
    return () => { alive = false }
  }, [event])
  const run = async (f: () => Promise<EventAdmins>) => {
    setBusy(true)
    setErr('')
    try { setData(await f()); return true } catch (e) { setErr(errText(e, 'That didn’t work. Try again.')); return false } finally { setBusy(false) }
  }
  return (
    <div className="event-admins">
      <p className="small muted">Event admins run this event; they add everyone else under Admin → People with access. Superadmins are admin everywhere anyway.</p>
      {data ? (
        <ul>
          {data.admins.map(a => (
            <li key={a.email} className="row">
              <span className="stack"><b>{a.name}{a.email === me.email ? ' (you)' : ''}</b><span className="small muted">{a.email}{a.email === data.owner ? ' · created it' : ''}</span></span>
              {a.email !== data.owner && <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => void run(() => removeEventAdmin(event, a.email))}>Remove</button>}
            </li>
          ))}
        </ul>
      ) : !err && <p className="small muted">Loading…</p>}
      <form className="admin-add" onSubmit={e => { e.preventDefault(); void run(() => addEventAdmin(event, { name: name.trim(), email: email.trim() })).then(ok => { if (ok) { setEmail(''); setName('') } }) }}>
        <label className="fld"><span>Name</span><input value={name} placeholder="Kari Nordmann" onChange={e => setName(e.target.value)} /></label>
        <label className="fld"><span>Email</span><input type="email" value={email} placeholder="kari@festival.no" onChange={e => setEmail(e.target.value)} /></label>
        <button type="submit" className="btn" disabled={busy || !email.trim() || !name.trim()}>Add admin</button>
      </form>
      {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
    </div>
  )
}

function NewEvent({ org, onCreated }: { org: string; onCreated: (e: EventSummary) => void }) {
  const [name, setName] = useState('')
  const [admins, setAdmins] = useState<NamedPerson[]>([{ name: '', email: '' }])
  const [sample, setSample] = useState(false)
  const [modules, setModules] = useState<ModuleId[]>([...STARTER_MODULES])
  const setAdmin = (i: number, k: keyof NamedPerson, v: string) => setAdmins(list => list.map((a, j) => (j === i ? { ...a, [k]: v } : a)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const n = name.trim() || 'New festival'
      const named = admins.map(a => ({ name: a.name.trim(), email: a.email.trim() })).filter(a => a.email || a.name)
      if (named.some(a => !a.email || !a.name)) { setErr('Give each admin both a name and an email.'); return }
      const id = await createEvent(n, sample, org, named, sample ? undefined : modules)
      onCreated({ id, name: sample ? 'Nordlys Open Air 2026' : n, owner: '', org })
    } catch (e) {
      setErr(errText(e, 'Could not create the event.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="panel">
      <h2>Create an event</h2>
      <form className="stack" style={{ marginTop: '1rem', gap: '.75rem' }} onSubmit={e => void submit(e)}>
        <label className="fld"><span>Event name</span><input value={name} placeholder="e.g. Nordlys Open Air 2027" onChange={e => setName(e.target.value)} /></label>
        <fieldset className="admin-rows">
          <legend>Event admins</legend>
          {admins.map((a, i) => (
            <div key={i} className="admin-add">
              <label className="fld"><span>Name</span><input value={a.name} placeholder="Kari Nordmann" onChange={e => setAdmin(i, 'name', e.target.value)} /></label>
              <label className="fld"><span>Email</span><input type="email" value={a.email} placeholder="kari@festival.no" onChange={e => setAdmin(i, 'email', e.target.value)} /></label>
              {admins.length > 1 && <button type="button" className="btn sm" aria-label={`Remove admin ${i + 1}`} onClick={() => setAdmins(list => list.filter((_, j) => j !== i))}>×</button>}
            </div>
          ))}
          <div><button type="button" className="btn sm" onClick={() => setAdmins(list => [...list, { name: '', email: '' }])}>+ Add another admin</button></div>
        </fieldset>
        {!sample && (
          <fieldset className="module-pick">
            <legend>What does this event need?</legend>
            <p className="small muted">Run sheets, artists, stages and people are always there. Tick what else to show; you can change this later under Admin → Modules.</p>
            {MODULE_IDS.map(id => (
              <label key={id} className="row small" title={MODULES[id].description}>
                <input type="checkbox" checked={modules.includes(id)} onChange={e => setModules(m => (e.target.checked ? [...m, id] : m.filter(x => x !== id)))} />
                <span><b>{MODULES[id].label}</b> <span className="muted">{MODULES[id].description}</span></span>
              </label>
            ))}
          </fieldset>
        )}
        <label className="row small"><input type="checkbox" checked={sample} onChange={e => setSample(e.target.checked)} /> Fill it with the sample festival instead (every module on, to try things out)</label>
        {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
        <div className="row"><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button></div>
      </form>
    </div>
  )
}

function NewOrg({ onCreated }: { onCreated: (o: OrgSummary) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const n = name.trim()
      onCreated({ id: await createOrg(n), name: n, admin: true })
      setName('')
    } catch (e) {
      setErr(errText(e, 'Could not add the customer.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="panel">
      <h2>Add a customer</h2>
      <p className="small muted" style={{ margin: '.35rem 0 0' }}>A folder for one customer’s events. Their people only ever see the events they’re added to.</p>
      <form className="row" style={{ marginTop: '1rem', gap: '.5rem', alignItems: 'flex-end' }} onSubmit={e => void submit(e)}>
        <label className="fld" style={{ flex: 1 }}><span>Name</span><input value={name} placeholder="e.g. Larkolluka" onChange={e => setName(e.target.value)} required /></label>
        <button type="submit" className="btn primary" disabled={busy || !name.trim()}>{busy ? 'Adding…' : 'Add'}</button>
      </form>
      {err && <p className="small" style={{ color: 'var(--stop)', marginTop: '.5rem' }} role="alert">{err}</p>}
    </div>
  )
}

/** Superadmins: the automatic nightly backups (every customer and event), last 30 nights. */
function Nightly() {
  const [data, setData] = useState<NightlyBackups | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    listNightly().then(d => { if (alive) setData(d) }, e => { if (alive) setErr(errText(e, 'Could not load the backups.')) })
    return () => { alive = false }
  }, [])
  const now = async () => {
    setBusy(true)
    setErr('')
    try { await runBackupNow(); setData(await listNightly()) } catch (e) { setErr(errText(e, 'The backup failed. Try again.')) } finally { setBusy(false) }
  }
  const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} kB`)
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
        <h2>Nightly backups</h2>
        {data?.enabled && <button type="button" className="btn sm" disabled={busy} onClick={() => void now()}>{busy ? 'Backing up…' : 'Back up now'}</button>}
      </div>
      <p className="small muted" style={{ margin: '.35rem 0 .75rem' }}>Every night at 02:00 UTC, a full backup of every customer and event, kept for 30 nights, stored in the EU.</p>
      {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
      {data && !data.enabled && <p className="small muted">Not running yet: they start once file storage (R2) is switched on for showctrl.</p>}
      {data?.enabled && !data.backups.length && <p className="small muted">The first one is made tonight.</p>}
      {data?.enabled && data.backups.length > 0 && (
        <ul className="list" style={{ margin: '0 -1.5rem' }}>
          {data.backups.map(b => (
            <li key={b.date}>
              <span className="num"><b>{b.date}</b> <span className="small muted">{size(b.bytes)}</span></span>
              <a className="btn sm" style={{ marginLeft: 'auto' }} href={nightlyUrl(b.date)} download>Download</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
