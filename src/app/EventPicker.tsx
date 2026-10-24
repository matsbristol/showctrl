import { useEffect, useState, type FormEvent } from 'react'
import { addOrgAdmin, createEvent, createOrg, getOrg, removeOrgAdmin, renameOrg, type EventSummary, type Me, type OrgSummary } from './backend'

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

/**
 * Live mode, before an event is open: the user's organisations, then that organisation's
 * events. People only ever see their own organisation's events; its admins create events
 * and manage who else is admin. Superadmins (who run showctrl) add organisations.
 */
export function EventPicker({ me, orgs, events, org, onOrg, onOpen, onCreated, onOrgCreated, onOrgRenamed }: {
  me: Me
  orgs: OrgSummary[]
  events: EventSummary[]
  org: string | null
  onOrg: (id: string | null) => void
  onOpen: (id: string) => void
  onCreated: (e: EventSummary) => void
  onOrgCreated: (o: OrgSummary) => void
  onOrgRenamed: (id: string, name: string) => void
}) {
  const current = org ? orgs.find(o => o.id === org) : undefined
  // Events from before organisations existed, if any.
  const loose = events.filter(e => !e.org)
  if (!current) {
    return (
      <div className="setup">
        <img className="setup-logo" src="/logo.png" alt="showctrl" />
        <div className="panel">
          <h1>{orgs.length ? 'Choose an organisation' : 'Welcome to showctrl'}</h1>
          <p className="muted" style={{ margin: '.5rem 0 1rem' }}>Signed in as <b>{me.email}</b>.</p>
          {orgs.length ? (
            <ul className="list" style={{ margin: '0 -1.5rem 1rem' }}>
              {orgs.map(o => {
                const n = events.filter(e => e.org === o.id).length
                return (
                  <li key={o.id}>
                    <div className="stack"><b>{o.name}</b><span className="small muted">{n === 1 ? '1 event' : `${n} events`}{o.admin ? ' · you’re an admin' : ''}</span></div>
                    <button type="button" className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => onOrg(o.id)}>Open</button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="muted" style={{ marginBottom: '1rem' }}>You’re not part of an organisation yet. Ask your organisation’s showctrl admin to add <b>{me.email}</b>.</p>
          )}
        </div>
        {loose.length > 0 && <EventList title="Events without an organisation" events={loose} me={me} onOpen={onOpen} />}
        {me.superadmin && <NewOrg onCreated={onOrgCreated} />}
      </div>
    )
  }
  const mine = events.filter(e => e.org === current.id)
  return (
    <div className="setup">
      <img className="setup-logo" src="/logo.png" alt="showctrl" />
      <div className="panel">
        {(orgs.length > 1 || me.superadmin) && <button type="button" className="btn sm" style={{ marginBottom: '.75rem' }} onClick={() => onOrg(null)}>← All organisations</button>}
        <h1>{current.name}</h1>
        <p className="muted" style={{ margin: '.5rem 0 1rem' }}>Signed in as <b>{me.email}</b>.</p>
        {mine.length ? (
          <EventRows events={mine} me={me} onOpen={onOpen} />
        ) : (
          <p className="muted" style={{ marginBottom: '1rem' }}>
            {current.admin ? 'No events yet. Create the first one below.' : 'You’re not part of any of its events yet. Ask the event’s admin to add you.'}
          </p>
        )}
      </div>
      {current.admin && <NewEvent org={current.id} onCreated={onCreated} />}
      {current.admin && <OrgAdmins key={current.id} org={current} me={me} onRenamed={onOrgRenamed} />}
    </div>
  )
}

function EventRows({ events, me, onOpen }: { events: EventSummary[]; me: Me; onOpen: (id: string) => void }) {
  return (
    <ul className="list" style={{ margin: '0 -1.5rem 1rem' }}>
      {events.map(e => (
        <li key={e.id}>
          <div className="stack"><b>{e.name}</b><span className="small muted">{e.owner === me.email ? 'You created this event' : `Created by ${e.owner}`}</span></div>
          <button type="button" className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => onOpen(e.id)}>Open</button>
        </li>
      ))}
    </ul>
  )
}

function EventList({ title, events, me, onOpen }: { title: string; events: EventSummary[]; me: Me; onOpen: (id: string) => void }) {
  return (
    <div className="panel">
      <h2 style={{ marginBottom: '.75rem' }}>{title}</h2>
      <EventRows events={events} me={me} onOpen={onOpen} />
    </div>
  )
}

function NewEvent({ org, onCreated }: { org: string; onCreated: (e: EventSummary) => void }) {
  const [name, setName] = useState('')
  const [sample, setSample] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const n = name.trim() || 'New festival'
      const id = await createEvent(n, sample, org)
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
        <label className="row small"><input type="checkbox" checked={sample} onChange={e => setSample(e.target.checked)} /> Fill it with the sample festival (to try things out)</label>
        {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
        <div className="row"><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button></div>
      </form>
    </div>
  )
}

/** The organisation's admins: they create its events and are Festival admin in every one. */
function OrgAdmins({ org, me, onRenamed }: { org: OrgSummary; me: Me; onRenamed: (id: string, name: string) => void }) {
  const [admins, setAdmins] = useState<string[] | null>(null)
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    getOrg(org.id).then(o => { if (alive) setAdmins(o.admins) }, e => { if (alive) setErr(errText(e, 'Could not load the admins.')) })
    return () => { alive = false }
  }, [org.id])
  const run = async (f: () => Promise<string[]>) => {
    setBusy(true)
    setErr('')
    try { setAdmins(await f()) } catch (e) { setErr(errText(e, 'That didn’t work. Try again.')) } finally { setBusy(false) }
  }
  const rename = (name: string) => {
    const n = name.trim()
    if (!n || n === org.name) return
    renameOrg(org.id, n).then(() => onRenamed(org.id, n), e => setErr(errText(e, 'Could not rename it.')))
  }
  return (
    <div className="panel">
      <h2>Organisation</h2>
      <p className="small muted" style={{ margin: '.35rem 0 1rem' }}>Admins create events and are Festival admin in every event here. Add everyone else inside each event, under Admin → People with access.</p>
      <label className="fld" style={{ marginBottom: '1rem' }}><span>Name</span><input defaultValue={org.name} key={org.name} onBlur={e => rename(e.target.value)} /></label>
      <h3 className="small" style={{ marginBottom: '.25rem' }}>Admins</h3>
      {admins ? (
        <ul className="list" style={{ margin: '0 -1.5rem .75rem' }}>
          {admins.map(a => (
            <li key={a} data-id={a}>
              <span>{a}{a === me.email ? ' (you)' : ''}</span>
              <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} disabled={busy || admins.length < 2} title={admins.length < 2 ? 'An organisation needs at least one admin' : undefined}
                onClick={() => { if (a !== me.email || confirm('Remove yourself as admin? You’ll lose admin access to every event here.')) void run(() => removeOrgAdmin(org.id, a)) }}>Remove</button>
            </li>
          ))}
        </ul>
      ) : !err && <p className="small muted">Loading…</p>}
      <form className="row" style={{ gap: '.5rem', alignItems: 'flex-end' }} onSubmit={e => { e.preventDefault(); const v = email.trim(); if (v) void run(() => addOrgAdmin(org.id, v)).then(() => setEmail('')) }}>
        <label className="fld" style={{ flex: 1 }}><span>Add an admin</span><input type="email" value={email} placeholder="name@company.no" onChange={e => setEmail(e.target.value)} /></label>
        <button type="submit" className="btn" disabled={busy || !email.trim()}>Add</button>
      </form>
      {err && <p className="small" style={{ color: 'var(--stop)', marginTop: '.5rem' }} role="alert">{err}</p>}
    </div>
  )
}

/** Superadmins: add a customer organisation and its first admins. */
function NewOrg({ onCreated }: { onCreated: (o: OrgSummary) => void }) {
  const [name, setName] = useState('')
  const [admins, setAdmins] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const n = name.trim()
      const list = admins.split(/[\s,;]+/).map(a => a.trim()).filter(Boolean)
      onCreated({ id: await createOrg(n, list), name: n, admin: true })
      setName('')
      setAdmins('')
    } catch (e) {
      setErr(errText(e, 'Could not add the organisation.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="panel">
      <h2>Add an organisation</h2>
      <p className="small muted" style={{ margin: '.35rem 0 0' }}>A customer. Its people see only its own events.</p>
      <form className="stack" style={{ marginTop: '1rem', gap: '.75rem' }} onSubmit={e => void submit(e)}>
        <label className="fld"><span>Name</span><input value={name} placeholder="e.g. Larkolluka" onChange={e => setName(e.target.value)} required /></label>
        <label className="fld"><span>Admins (emails, comma-separated)</span><input value={admins} placeholder="kari@festival.no, ola@festival.no" onChange={e => setAdmins(e.target.value)} /></label>
        {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
        <div className="row"><button type="submit" className="btn primary" disabled={busy || !name.trim()}>{busy ? 'Adding…' : 'Add organisation'}</button></div>
      </form>
    </div>
  )
}
