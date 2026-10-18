import { useState } from 'react'
import { createEvent, type EventSummary, type Me } from './backend'

/** Live mode: the user's events, and creating a new one if they're allowed to. */
export function EventPicker({ me, events, onOpen, onCreated }: {
  me: Me
  events: EventSummary[]
  onOpen: (id: string) => void
  onCreated: (id: string, name: string) => void
}) {
  const [name, setName] = useState('')
  const [sample, setSample] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const create = async () => {
    setBusy(true)
    setErr('')
    try {
      const n = name.trim() || 'New festival'
      onCreated(await createEvent(n, sample), sample ? 'Nordlys Open Air 2026' : n)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the event.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="setup">
      <div className="panel">
        <h1>Your events</h1>
        <p className="muted" style={{ margin: '.5rem 0 1rem' }}>Signed in as <b>{me.email}</b>.</p>
        {events.length ? (
          <ul className="list" style={{ margin: '0 -1.5rem 1rem' }}>
            {events.map(e => (
              <li key={e.id}>
                <div className="stack"><b>{e.name}</b><span className="small muted">{e.owner === me.email ? 'You own this event' : `Owner: ${e.owner}`}</span></div>
                <button type="button" className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => onOpen(e.id)}>Open</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ marginBottom: '1rem' }}>You’re not part of any event yet. Ask the festival admin to add your email address{me.canCreate ? ', or create a new event below' : ''}.</p>
        )}
      </div>
      {me.canCreate && (
        <div className="panel">
          <h2>Create an event</h2>
          <form className="stack" style={{ marginTop: '1rem', gap: '.75rem' }} onSubmit={e => { e.preventDefault(); void create() }}>
            <label className="fld"><span>Event name</span><input value={name} placeholder="e.g. Nordlys Open Air 2027" onChange={e => setName(e.target.value)} /></label>
            <label className="row small"><input type="checkbox" checked={sample} onChange={e => setSample(e.target.checked)} /> Fill it with the sample festival (to try things out)</label>
            {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
            <div className="row"><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
