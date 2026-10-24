import { useEffect, useState, type FormEvent } from 'react'
import {
  addEventAdmin, backupUrl, createEvent, createOrg, deleteEvent, deleteOrg, getEventAdmins, logout, removeEventAdmin, renameOrg,
  type EventAdmins, type EventSummary, type Me, type OrgSummary,
} from './backend'

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)
const emails = (s: string) => s.split(/[\s,;]+/).map(a => a.trim()).filter(Boolean)

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
  const signedIn = <p className="muted" style={{ margin: '.5rem 0 1rem' }}>Signed in as <b>{me.email}</b>. <button type="button" className="linkish" onClick={() => void logout()}>Log out</button></p>

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
            <li key={a} className="row">
              <span>{a}{a === me.email ? ' (you)' : ''}{a === data.owner ? <span className="small muted"> · created it</span> : null}</span>
              {a !== data.owner && <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => void run(() => removeEventAdmin(event, a))}>Remove</button>}
            </li>
          ))}
        </ul>
      ) : !err && <p className="small muted">Loading…</p>}
      <form className="row" style={{ gap: '.5rem', alignItems: 'flex-end' }} onSubmit={e => { e.preventDefault(); void run(() => addEventAdmin(event, email.trim())).then(ok => { if (ok) setEmail('') }) }}>
        <label className="fld" style={{ flex: 1 }}><span>Add an admin</span><input type="email" value={email} placeholder="name@company.no" onChange={e => setEmail(e.target.value)} /></label>
        <button type="submit" className="btn" disabled={busy || !email.trim()}>Add</button>
      </form>
      {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
    </div>
  )
}

function NewEvent({ org, onCreated }: { org: string; onCreated: (e: EventSummary) => void }) {
  const [name, setName] = useState('')
  const [admins, setAdmins] = useState('')
  const [sample, setSample] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const n = name.trim() || 'New festival'
      const id = await createEvent(n, sample, org, emails(admins))
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
        <label className="fld"><span>Event admins (emails, comma-separated)</span><input value={admins} placeholder="kari@festival.no, ola@festival.no" onChange={e => setAdmins(e.target.value)} /></label>
        <label className="row small"><input type="checkbox" checked={sample} onChange={e => setSample(e.target.checked)} /> Fill it with the sample festival (to try things out)</label>
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
