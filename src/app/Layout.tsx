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
import { NamePrompt, YourNameButton } from './YourName'
import { useLive } from './live'
import { CloudflareStore, type ConnectionStatus } from '../data/cloudflareStore'
import { useUnreadCount } from './messages/hooks'
import { UrgentBanner } from './messages/UrgentBanner'
import { tr } from '../i18n'

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
        <div className="brand"><img src="/logo.svg" alt="showctrl" /></div>
        <EventName />
        <MasterClock />
        <Who />
      </header>
      <ContextBar />
      <UrgentBanner />
      <NamePrompt />
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
      <b>{cfg?.name || tr('Untitled event')}</b>
      <span>
        {di >= 0 ? `${tr('Day {n} of {total}', { n: di + 1, total: days.length })} · ${dayLabel(today, true)}` : days.length ? `${dayLabel(days[0])} – ${dayLabel(days[days.length - 1])}` : ''}
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
  const label = offline ? tr('Offline · reconnecting') : state === 'ok' ? `${tr('Synced')}${within} · ${city}` : state === 'corrected' ? `${tr('Corrected {s}s', { s: Math.round(offset / 1000) })} · ${city}` : `${tr('Device time')} · ${city}`
  const detail = state === 'device'
    ? tr('Could not reach the server clock, so this is the device’s own time.')
    : `${tr('Server time')}${source ? ` ${tr('from Cloudflare {source}', { source })}` : ''}. ${tr(offset >= 0 ? 'This device was {ms} ms behind' : 'This device was {ms} ms ahead', { ms: Math.abs(offset) })}${error != null ? tr(', now within ±{ms} ms', { ms: error }) : ''}.${at ? ` ${tr('Checked {time}.', { time: fmtTime(at, tz, true) })}` : ''}`
  const color = offline ? '#FF6764' : state === 'device' ? '#8E9AB1' : state === 'corrected' ? '#F1B734' : '#45C982'
  return (
    <div className="master">
      <span className="t" aria-label={tr('Current time')}>{fmtTime(now, tz, true)}</span>
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
    const label = a.role() !== 'none' ? tr(a.roleDef().label) : a.myStages().map(s => `${tr(STAGE_ROLES[a.stageRole(s.id)!])}, ${s.name}`)[0] ?? tr(a.roleDef().label)
    return (
      <div className="who">
        <YourNameButton title={`${name} · ${label}`} label={<>{name} <span className="role">· {label}</span></>} />
        {me && <Avatar id={me} name={name} />}
        <FontPicker className="who-btn" />
        {live && <button type="button" className="who-btn" onClick={live.switchEvent}>{tr('Events')}</button>}
        {live && <button type="button" className="who-btn" onClick={() => void logout()}>{tr('Log out')}</button>}
      </div>
    )
  }

  return (
    <div className="who">
      {me && <Avatar id={me} name={name} />}
      <label>
        <span className="role">{tr('Demo · view as')}</span>
        <select
          aria-label={tr('View as demo person')}
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
    <nav className="ctxbar" aria-label={tr('Festival HQ and stages')}>
      {a.hqVisible() && (
        <Link to={hqPath('overview')} aria-current={ctx === 'hq'} style={{ ['--c' as string]: HQ_COLOR }}>Festival HQ</Link>
      )}
      {a.visibleStages().map(s => {
        const { cur } = nowNext(ros, s.id, now, tz)
        return (
          <Link key={s.id} to={stagePath(s.id, 'today')} aria-current={ctx === s.id} style={{ ['--c' as string]: tapeHex(s.tape) }}>
            <span className="tape" style={{ ['--c' as string]: tapeHex(s.tape) }} />
            {s.name}
            {cur?.kind === 'show' && <span className="live" title={tr('Show running')} />}
            {a.stageRole(s.id) === 'manager' && <span className="role">{tr('Stage manager')}</span>}
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
  const label = preview.type === 'role' ? tr(a.roleDef(preview.role).label) : `${tr(STAGE_ROLES[preview.level])}, ${stages[preview.sid]?.name ?? ''}`
  return (
    <div className="preview" role="status">
      <span>{tr('Previewing as')} <b>{label}</b>. {tr('Changes you make are still saved as you.')}</span>
      <button type="button" onClick={() => { setPreview(null); navigate('/hq') }}>{tr('End preview')}</button>
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
    <nav className="side" aria-label={tr('Sections')}>
      {ctx === 'hq'
        ? <div className="ctxhead"><span className="tape" style={{ ['--c' as string]: HQ_COLOR }} />Festival HQ</div>
        : st && <div className="ctxhead"><span className="tape" style={{ ['--c' as string]: tapeHex(st.tape) }} />{st.name}</div>}
      {items.map(({ v, meta, to }, i) => (
        <div key={v} className="navitem">
          {i > 0 && items[i - 1].meta.group !== meta.group && (
            NAV_GROUPS[meta.group] ? <div className="navgroup">{tr(NAV_GROUPS[meta.group])}</div> : <div className="sep" />
          )}
          <Link to={to} aria-current={current === v ? 'page' : undefined}>
            <Icon name={meta.icon} />
            <span>{meta.label(terms)}</span>
            {v === 'messages' && unread > 0 && current !== 'messages' && <span className="badge" aria-label={tr('{n} unread', { n: unread })}>{unread}</span>}
          </Link>
        </div>
      ))}
      {!items.length && <Link to={homePath(a)} className="muted small">{tr('Go to my start page')}</Link>}
    </nav>
  )
}
