/*
 * The dark "prompt desk" strip: event, master clock and who you are.
 * Always visible, so every department reads the same corrected time.
 */
import { useNavigate } from 'react-router-dom'
import { createAccess } from '../access/access'
import { useClockStatus, useNow } from '../clock/clock'
import { STAGE_ROLES } from '../domain/constants'
import { DEFAULT_TZ, dayLabel, eventDays, festDay, fmtTime, tzCity } from '../domain/time'
import { useSnapshot } from '../data/hooks'
import { useAccess, useSession } from '../session/hooks'
import { homePath } from './nav'
import { initials, personColor, personName, personTag } from './people'
import { colourVar } from './style'

function MasterClock({ tz }: { tz: string }) {
  const t = useNow(250)
  const { state, offset } = useClockStatus()
  const city = tzCity(tz)
  const label = state === 'ok' ? `Synced · ${city}` : state === 'corrected' ? `Corrected ${Math.round(offset / 1000)}s · ${city}` : `Device time · ${city}`
  const dot = state === 'ok' ? '#45C982' : state === 'corrected' ? '#F1B734' : '#8E9AB1'
  return (
    <div className="master">
      <span className="t" aria-label="Show time">{fmtTime(t, true, tz)}</span>
      <span className="sync" style={colourVar(dot)}>{label}</span>
    </div>
  )
}

/** "Day 2 of 3 · Friday 3 Jul" during the event, otherwise its date range. */
function EventName() {
  const snap = useSnapshot()
  const t = useNow(60_000)
  const cfg = snap.cfg
  if (!cfg) return <div className="ev"><b>No event yet</b></div>
  const days = eventDays(cfg.start, cfg.end)
  const today = festDay(t, cfg.tz)
  const di = days.indexOf(today)
  const sub = di >= 0 ? `Day ${di + 1} of ${days.length} · ${dayLabel(today, true)}`
    : days.length ? `${dayLabel(days[0])} – ${dayLabel(days[days.length - 1])}` : ''
  return <div className="ev"><b>{cfg.name || 'Untitled event'}</b><span>{sub}</span></div>
}

function Avatar({ uid, name }: { uid: string; name: string }) {
  return <span className="av" style={colourVar(personColor(uid))} aria-hidden="true">{initials(name)}</span>
}

/** Demo mode: pick which sample person to be. Live mode: your name and role. */
function Who() {
  const snap = useSnapshot()
  const session = useSession()
  const access = useAccess()
  const navigate = useNavigate()
  const uid = session.viewer.uid
  if (!uid) return null
  const name = personName(snap, uid, uid)

  if (session.mode === 'demo') {
    const people = Object.keys(snap.col.members)
      .map(id => ({ id, name: personName(snap, id), tag: personTag(snap, id) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    const pick = (id: string) => {
      session.setDemoUser(id)
      // Land where that person would, as in the prototype.
      navigate(homePath(createAccess(snap, { uid: id })))
    }
    return (
      <div className="who">
        <label>
          <span className="role">Demo · view as</span>
          <select value={uid} onChange={e => pick(e.target.value)} aria-label="View as demo person">
            {people.map(p => <option key={p.id} value={p.id}>{p.name} — {p.tag}</option>)}
          </select>
        </label>
        <Avatar uid={uid} name={name} />
      </div>
    )
  }

  // Live: festival role if they have one, else their first stage role.
  const stageLabel = access.myStages().map(s => `${STAGE_ROLES[access.stageRole(s.id)!]}, ${s.name}`)[0]
  const roleText = access.role !== 'none' ? access.roleDef.label : stageLabel ?? access.roleDef.label
  return (
    <div className="who">
      <span>{name} <span className="role">· {roleText}</span></span>
      <Avatar uid={uid} name={name} />
    </div>
  )
}

/** Shown while previewing someone else's access, with a way out. */
function PreviewBar() {
  const snap = useSnapshot()
  const { viewer, setPreview } = useSession()
  const p = viewer.preview
  if (!p) return null
  const label = p.type === 'role'
    ? (snap.roles[p.role]?.label ?? p.role)
    : `${STAGE_ROLES[p.level]}, ${snap.col.stages[p.sid]?.name ?? ''}`
  return (
    <div className="preview" role="status">
      Previewing as <b>{label}</b> — this is what they see.
      <button type="button" onClick={() => setPreview(null)}>Stop preview</button>
    </div>
  )
}

export function TopStrip() {
  const snap = useSnapshot()
  return (
    <>
      <header className="strip">
        <div className="brand"><i />showctrl</div>
        <EventName />
        <MasterClock tz={snap.cfg?.tz ?? DEFAULT_TZ} />
        <Who />
      </header>
      <PreviewBar />
    </>
  )
}
