import { useEffect, useMemo, useState } from 'react'
import { locale, tr } from '../i18n'
import type { Analytics } from '../shared/analytics'
import { MODULES, moduleOfCollection, moduleOfView } from '../shared/modules'
import { EVENT_TYPES } from '../types/constants'
import type { CollectionName } from '../types/model'
import type { HqView, StageView } from '../shared/views'
import { getAnalytics } from './backend'
import { HQ_NAV, STAGE_NAV } from './nav'

const TERMS = EVENT_TYPES.festival.terms
const PERIODS = [7, 30, 90, 365]

/** Core pages and records, which belong to no module. */
const CORE_COLS: Partial<Record<CollectionName, string>> = {
  stages: 'Stages', artists: 'Artists', ros: 'Run sheets', people: 'People', members: 'Access', stageteam: 'Access', requests: 'Access',
}

/** "hq/schedule" → its module's label, or the page's own name for core pages. */
function viewGroup(v: string): string {
  const [where, view] = v.split('/') as ['hq' | 'stage', string]
  const m = moduleOfView(view as HqView & StageView, where)
  if (m) return tr(MODULES[m].label)
  const nav = where === 'hq' ? HQ_NAV[view as HqView] : STAGE_NAV[view as StageView]
  return nav ? nav.label(TERMS) : view
}
function colGroup(c: string): string | null {
  if (c === 'prefs') return null // read markers, not work
  const m = moduleOfCollection(c as CollectionName)
  if (m) return tr(MODULES[m].label)
  return tr(CORE_COLS[c as CollectionName] ?? c)
}

const when = (ms: number) => new Date(ms).toLocaleString(locale(), { timeZone: 'Europe/Oslo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dayOf = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Superadmins: who signed in when, and which pages and modules people use. */
export function AnalyticsPage({ onBack }: { onBack: () => void }) {
  const [days, setDays] = useState(30)
  const [event, setEvent] = useState('')
  const [withSupers, setWithSupers] = useState(false)
  const [data, setData] = useState<Analytics | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    getAnalytics(days).then(d => { if (alive) { setData(d); setErr('') } }, e => { if (alive) setErr(e instanceof Error ? e.message : tr('Could not load the numbers.')) })
    return () => { alive = false }
  }, [days])

  const view = useMemo(() => {
    if (!data) return null
    const keep = (email: string) => withSupers || !data.superadmins.includes(email)
    const usage = data.usage.filter(u => keep(u.email) && (!event || u.event === event))
    const edits = data.edits.filter(e => keep(e.actor) && (!event || e.event === event) && colGroup(e.col))
    const signins = data.signins.filter(s => keep(s.email) && (!event || usage.some(u => u.email === s.email)))
    const evName = (id: string) => data.events.find(e => e.id === id)?.name ?? id

    // People: what each person opened and changed.
    const people = new Map<string, { email: string; events: Set<string>; views: number; days: number; last: number; groups: Map<string, number>; edits: number }>()
    const person = (email: string) => {
      let p = people.get(email)
      if (!p) people.set(email, p = { email, events: new Set(), views: 0, days: 0, last: 0, groups: new Map(), edits: 0 })
      return p
    }
    for (const u of usage) {
      const p = person(u.email)
      p.events.add(evName(u.event))
      p.views += u.n
      p.days = Math.max(p.days, u.days)
      p.last = Math.max(p.last, u.last)
      const g = viewGroup(u.view)
      p.groups.set(g, (p.groups.get(g) ?? 0) + u.n)
    }
    for (const e of edits) { const p = person(e.actor); p.edits += e.n; p.last = Math.max(p.last, e.last); p.events.add(evName(e.event)) }

    // Modules and pages: how many people use each, how often, and how much they change in it.
    const groups = new Map<string, { label: string; people: Set<string>; views: number; edits: number; editors: Set<string> }>()
    const group = (label: string) => {
      let g = groups.get(label)
      if (!g) groups.set(label, g = { label, people: new Set(), views: 0, edits: 0, editors: new Set() })
      return g
    }
    for (const u of usage) { const g = group(viewGroup(u.view)); g.people.add(u.email); g.views += u.n }
    for (const e of edits) { const g = group(colGroup(e.col)!); g.edits += e.n; g.editors.add(e.actor) }

    const daily = withSupers && !event ? data.daily : null
    return {
      people: [...people.values()].sort((x, y) => y.last - x.last),
      groups: [...groups.values()].sort((x, y) => y.views - x.views || y.edits - x.edits),
      signins,
      daily,
      totals: { people: people.size, signins: signins.length, views: usage.reduce((n, u) => n + u.n, 0), edits: edits.reduce((n, e) => n + e.n, 0) },
    }
  }, [data, event, withSupers])

  const name = (email: string) => data?.names[email] ?? email

  return (
    <div className="setup wide analytics">
      <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '.75rem' }}>
        <button type="button" className="btn sm" onClick={onBack}>← {tr('Customers')}</button>
        <h1 style={{ margin: 0 }}>{tr('Analytics')}</h1>
        <div className="row" style={{ marginLeft: 'auto', flexWrap: 'wrap', gap: '.5rem' }}>
          <select aria-label={tr('Period')} value={days} onChange={e => setDays(Number(e.target.value))}>
            {PERIODS.map(d => <option key={d} value={d}>{tr('Last {n} days', { n: d })}</option>)}
          </select>
          <select aria-label={tr('Event')} value={event} onChange={e => setEvent(e.target.value)}>
            <option value="">{tr('All events')}</option>
            {data?.events.map(e => <option key={e.id} value={e.id}>{e.org ? `${e.org} · ${e.name}` : e.name}</option>)}
          </select>
          <label className="row small"><input type="checkbox" checked={withSupers} onChange={e => setWithSupers(e.target.checked)} />{tr('Include superadmins')}</label>
        </div>
      </div>
      {err && <p className="small" style={{ color: 'var(--stop)' }} role="alert">{err}</p>}
      {!view ? !err && <p className="muted">{tr('Loading…')}</p> : (
        <>
          <div className="grid g4 an-tiles">
            {([[tr('Active people'), view.totals.people], [tr('Sign-ins'), view.totals.signins], [tr('Pages opened'), view.totals.views], [tr('Changes made'), view.totals.edits]] as const).map(([l, n]) => (
              <section key={l} className="panel"><div className="pb"><span className="small muted">{l}</span><b className="num an-n">{n.toLocaleString(locale())}</b></div></section>
            ))}
          </div>

          <section className="panel">
            <div className="ph"><h3>{tr('People')}</h3></div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>{tr('Person')}</th><th>{tr('Events')}</th><th>{tr('Days active')}</th><th>{tr('Last active')}</th><th>{tr('Uses most')}</th><th>{tr('Changes')}</th></tr></thead>
                <tbody>
                  {view.people.map(p => (
                    <tr key={p.email}>
                      <td><b>{name(p.email)}</b><div className="small muted">{p.email}</div></td>
                      <td className="small">{[...p.events].join(', ')}</td>
                      <td className="num">{p.days || '—'}</td>
                      <td className="small num">{p.last ? when(p.last) : '—'}</td>
                      <td className="small">{[...p.groups.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([g]) => g).join(', ') || '—'}</td>
                      <td className="num">{p.edits || '—'}</td>
                    </tr>
                  ))}
                  {!view.people.length && <tr><td colSpan={6} className="empty">{tr('Nobody has used showctrl in this period yet.')}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="ph"><h3>{tr('Modules and pages')}</h3></div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>{tr('Module or page')}</th><th>{tr('People')}</th><th>{tr('Times opened')}</th><th>{tr('Changes')}</th><th>{tr('Changed by')}</th></tr></thead>
                <tbody>
                  {view.groups.map(g => (
                    <tr key={g.label}>
                      <td><b>{g.label}</b></td>
                      <td className="num">{g.people.size || '—'}</td>
                      <td className="num">{g.views || '—'}</td>
                      <td className="num">{g.edits || '—'}</td>
                      <td className="small">{[...g.editors].map(name).join(', ') || '—'}</td>
                    </tr>
                  ))}
                  {!view.groups.length && <tr><td colSpan={5} className="empty">{tr('Nothing opened in this period yet.')}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="ph"><h3>{tr('Sign-ins')}</h3>{view.signins.length > 100 && <span className="small muted">{tr('Latest 100')}</span>}</div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>{tr('When')}</th><th>{tr('Person')}</th><th>{tr('How')}</th><th>{tr('Device')}</th><th>{tr('Country')}</th></tr></thead>
                <tbody>
                  {view.signins.slice(0, 100).map((s, i) => (
                    <tr key={i}>
                      <td className="small num">{when(s.at)}</td>
                      <td><b>{name(s.email)}</b><div className="small muted">{s.email}</div></td>
                      <td className="small">{s.method === 'link' ? tr('Sign-in link') : tr('Email code')}</td>
                      <td className="small">{s.device ?? '—'}</td>
                      <td className="small">{s.country ?? '—'}</td>
                    </tr>
                  ))}
                  {!view.signins.length && <tr><td colSpan={5} className="empty">{tr('No sign-ins in this period.')}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {view.daily && view.daily.length > 0 && (
            <section className="panel">
              <div className="ph"><h3>{tr('Day by day')}</h3></div>
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>{tr('Day')}</th><th>{tr('People')}</th><th>{tr('Pages opened')}</th></tr></thead>
                  <tbody>{[...view.daily].reverse().map(d => <tr key={d.day}><td>{dayOf(d.day)}</td><td className="num">{d.users}</td><td className="num">{d.views}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}
          <p className="small muted">{tr('Pages opened are counted at most once every 2 minutes per page. Changes come from each event’s change log. Sign-ins are for showctrl as a whole, not one event. Everything older than 13 months is deleted.')}</p>
        </>
      )}
    </div>
  )
}
