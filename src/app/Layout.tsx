import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { Link, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { useCollection, useConfig, useStore } from '../data/hooks'
import { nowNext } from '../lib/runsheet'
import { dayLabel, eventDays, festDay, fmtTime, tzCity } from '../lib/time'
import { initials, personColor, personName, personTag } from '../shared/people'
import { homePath, hqViews, stageViews } from '../shared/views'
import { STAGE_ROLES, TAPE } from '../types/constants'
import type { Id, TapeColor } from '../types/model'
import { Icon } from './Icon'
import { HQ_NAV, NAV_GROUPS, STAGE_NAV, hqPath, stagePath } from './nav'
import { useAccess, useNow, useSession, useTerms, useTz } from './session'
import { useSyncState } from './time'
import { logout } from './backend'
import { FontPicker } from './FontPicker'
import { useLive } from './live'
import { CloudflareStore, type ConnectionStatus } from '../data/cloudflareStore'
import { useUnreadCount } from './messages/hooks'
import { UrgentBanner } from './messages/UrgentBanner'

const HQ_COLOR = '#3E63FF'
const tapeHex = (t: TapeColor | undefined) => TAPE[t ?? 'grey'] ?? TAPE.grey

/** Festival HQ, or the stage id from `/s/:stageId/...`. */
function useCtx(): 'hq' | Id {
  return useMatch('/s/:stageId/*')?.params.stageId ?? 'hq'
}

export function Layout() {
  return (
    <>
      <header className="strip">
        <div className="brand"><img src="/logo.png" alt="showctrl" /></div>
        <EventName />
        <MasterClock />
        <Who />
      </header>
      <ContextBar />
      <UrgentBanner />
      <PreviewBar />
      <div className="shell">
        <SideNav />
        <main><Outlet /></main>
      </div>
    </>
  )
}

function EventName() {
  const cfg = useConfig('event')
  const tz = useTz()
  const now = useNow(60_000)
  const days = eventDays(cfg)
  const today = festDay(now, tz)
  const di = days.indexOf(today)
  return (
    <div className="ev">
      <b>{cfg?.name || 'Untitled event'}</b>
      <span>
        {di >= 0 ? `Day ${di + 1} of ${days.length} · ${dayLabel(today, true)}` : days.length ? `${dayLabel(days[0])} – ${dayLabel(days[days.length - 1])}` : ''}
      </span>
    </div>
  )
}

function MasterClock() {
  const tz = useTz()
  const now = useNow()
  const { state, offset, error, source, at } = useSyncState()
  const conn = useConnection()
  const city = tzCity(tz)
  const offline = conn === 'offline'
  const within = error != null && error < 1000 ? ` ±${error} ms` : ''
  const label = offline ? 'Offline · reconnecting' : state === 'ok' ? `Synced${within} · ${city}` : state === 'corrected' ? `Corrected ${Math.round(offset / 1000)}s · ${city}` : `Device time · ${city}`
  const detail = state === 'device'
    ? 'Could not reach the server clock, so this is the device’s own time.'
    : `Server time${source ? ` from Cloudflare ${source}` : ''}. This device was ${Math.abs(offset)} ms ${offset >= 0 ? 'behind' : 'ahead'}${error != null ? `, now within ±${error} ms` : ''}.${at ? ` Checked ${fmtTime(at, tz, true)}.` : ''}`
  const color = offline ? '#FF6764' : state === 'device' ? '#8E9AB1' : state === 'corrected' ? '#F1B734' : '#45C982'
  return (
    <div className="master">
      <span className="t" aria-label="Current time">{fmtTime(now, tz, true)}</span>
      <span className="sync" style={{ ['--c' as string]: color }} role="status" title={detail}>{label}</span>
    </div>
  )
}

/** Live mode: whether the connection to the event is up. Demo mode is always 'online'. */
function useConnection(): ConnectionStatus {
  const store = useStore()
  const sub = useCallback((l: () => void) => (store instanceof CloudflareStore ? store.onStatus(l) : () => {}), [store])
  const get = () => (store instanceof CloudflareStore ? store.status : 'online')
  return useSyncExternalStore(sub, get, get)
}

function Avatar({ id, name }: { id: Id; name: string }) {
  return <span className="av" style={{ ['--c' as string]: personColor(id) }}>{initials(name)}</span>
}

function Who() {
  const store = useStore()
  const { me, setMe } = useSession()
  const a = useAccess()
  const members = useCollection('members')
  const people = useCollection('people')
  const stageteam = useCollection('stageteam')
  const stages = useCollection('stages')
  const navigate = useNavigate()
  const live = useLive()
  const name = personName(me, members, people, {}, me)

  const personas = useMemo(
    () => Object.keys(members)
      .map(id => ({ id, name: personName(id, members, people), tag: personTag(id, members, stageteam, stages, a.roles) }))
      .sort((x, y) => x.name.localeCompare(y.name)),
    [members, people, stageteam, stages, a.roles],
  )

  if (store.mode !== 'local') {
    const label = a.role() !== 'none' ? a.roleDef().label : a.myStages().map(s => `${STAGE_ROLES[a.stageRole(s.id)!]}, ${s.name}`)[0] ?? a.roleDef().label
    return (
      <div className="who">
        <span>{name} <span className="role">· {label}</span></span>
        {me && <Avatar id={me} name={name} />}
        <FontPicker className="who-btn" />
        {live && <button type="button" className="who-btn" onClick={live.switchEvent}>Events</button>}
        {live && <button type="button" className="who-btn" onClick={() => void logout()}>Log out</button>}
      </div>
    )
  }

  return (
    <div className="who">
      {me && <Avatar id={me} name={name} />}
      <label>
        <span className="role">Demo · view as</span>
        <select
          aria-label="View as demo person"
          value={me ?? ''}
          onChange={e => {
            setMe(e.target.value)
            navigate('/hq') // redirects to the new persona's start page
          }}
        >
          {personas.map(p => <option key={p.id} value={p.id}>{p.name} — {p.tag}</option>)}
        </select>
      </label>
      <FontPicker className="who-btn" />
    </div>
  )
}

function ContextBar() {
  const a = useAccess()
  const ctx = useCtx()
  const ros = useCollection('ros')
  const tz = useTz()
  const now = useNow(10_000)
  return (
    <nav className="ctxbar" aria-label="Festival HQ and stages">
      {a.hqVisible() && (
        <Link to={hqPath('overview')} aria-current={ctx === 'hq'} style={{ ['--c' as string]: HQ_COLOR }}>Festival HQ</Link>
      )}
      {a.visibleStages().map(s => {
        const { cur } = nowNext(ros, s.id, now, tz)
        return (
          <Link key={s.id} to={stagePath(s.id, 'today')} aria-current={ctx === s.id} style={{ ['--c' as string]: tapeHex(s.tape) }}>
            <span className="tape" style={{ ['--c' as string]: tapeHex(s.tape) }} />
            {s.name}
            {cur?.kind === 'show' && <span className="live" title="Show running" />}
            {a.stageRole(s.id) === 'manager' && <span className="role">SM</span>}
          </Link>
        )
      })}
    </nav>
  )
}

function PreviewBar() {
  const { preview, setPreview } = useSession()
  const a = useAccess()
  const stages = useCollection('stages')
  const navigate = useNavigate()
  if (!preview) return null
  const label = preview.type === 'role' ? a.roleDef(preview.role).label : `${STAGE_ROLES[preview.level]}, ${stages[preview.sid]?.name ?? ''}`
  return (
    <div className="preview" role="status">
      <span>Previewing as <b>{label}</b>. Changes you make are still saved as you.</span>
      <button type="button" onClick={() => { setPreview(null); navigate('/hq') }}>End preview</button>
    </div>
  )
}

function SideNav() {
  const a = useAccess()
  const cfg = useConfig('event')
  const ctx = useCtx()
  const terms = useTerms()
  const stages = useCollection('stages')
  const { pathname } = useLocation()
  const unread = useUnreadCount()
  const current = pathname.split('/')[ctx === 'hq' ? 2 : 3]
  const st = ctx === 'hq' ? null : stages[ctx]

  const items = ctx === 'hq'
    ? hqViews(a, cfg).map(v => ({ v, meta: HQ_NAV[v], to: hqPath(v) }))
    : st ? stageViews(a, cfg, ctx).map(v => ({ v, meta: STAGE_NAV[v], to: stagePath(ctx, v) })) : []

  return (
    <nav className="side" aria-label="Sections">
      {ctx === 'hq'
        ? <div className="ctxhead"><span className="tape" style={{ ['--c' as string]: HQ_COLOR }} />Festival HQ</div>
        : st && <div className="ctxhead"><span className="tape" style={{ ['--c' as string]: tapeHex(st.tape) }} />{st.name}</div>}
      {items.map(({ v, meta, to }, i) => (
        <div key={v} className="navitem">
          {i > 0 && items[i - 1].meta.group !== meta.group && (
            NAV_GROUPS[meta.group] ? <div className="navgroup">{NAV_GROUPS[meta.group]}</div> : <div className="sep" />
          )}
          <Link to={to} aria-current={current === v ? 'page' : undefined}>
            <Icon name={meta.icon} />
            <span>{meta.label(terms)}</span>
            {v === 'messages' && unread > 0 && current !== 'messages' && <span className="badge" aria-label={`${unread} unread`}>{unread}</span>}
          </Link>
        </div>
      ))}
      {!items.length && <Link to={homePath(a)} className="muted small">Go to my start page</Link>}
    </nav>
  )
}
