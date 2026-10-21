import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useStore } from '../../data/hooks'
import { deckText, peak, planRisers, SIZES } from '../../lib/risers'
import { eff, itemsFor } from '../../lib/runsheet'
import { fmtTime } from '../../lib/time'
import type { Id } from '../../types/model'
import { DaySelector } from '../DaySelector'
import { useDay } from '../day'
import { useAccess, useTerms, useTz } from '../session'

/** Riser stock per stage against what each act's plot needs, in running order. */
export function RisersPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
  const store = useStore()
  const [day] = useDay()
  const ros = useCollection('ros')
  const artists = useCollection('artists')
  const plots = useCollection('plots')
  const risers = useCollection('risers')
  const stages = a.visibleStages()
  const [pick, setPick] = useState('')
  const stageId = sid ?? (pick || stages[0]?.id)
  const st = stageId ? stages.find(s => s.id === stageId) : undefined
  const stock = stageId ? risers[stageId] : undefined
  const w = !!stageId && a.canW('technical', stageId)

  const shows = stageId ? itemsFor(ros, stageId, tz, day).filter(i => i.kind === 'show' && i.artist && artists[i.artist]).sort((x, y) => eff(x).s - eff(y).s) : []
  const rows = planRisers(shows.map(s => ({ act: s, plot: plots[s.artist!] })), stock)
  const top = peak(rows)
  const short = rows.filter(r => Object.keys(r.short).length || r.missingHeights.length).length

  const setStock = async (patch: { decks?: Partial<Record<string, number>>; heights?: number[] }) => {
    if (!stageId) return
    if (!stock) await store.set('risers', stageId, { stage: stageId, decks: {}, heights: [20, 40, 60], notes: '', ...patch })
    else await store.update('risers', stageId, patch)
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Risers{st ? ` · ${st.name}` : ''}</h1>
          <p>What each {t.performer.toLowerCase()}’s stage plot needs against this {t.stage.toLowerCase()}’s stock. Rolling risers count twice while the act before them plays, because they’re built off stage.</p>
        </div>
        <div className="actions">
          {!sid && (
            <select className="inline-sel" aria-label={t.stage} value={stageId ?? ''} onChange={e => setPick(e.target.value)}>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <DaySelector />
        </div>
      </div>

      <div className="grid g2" style={{ marginBottom: '1rem' }}>
        <section className="panel">
          <div className="ph"><h3>Stock</h3>{stock ? null : <span className="small muted">Not set yet</span>}</div>
          <div className="pb row riser-stock">
            {SIZES.map(s => (
              <label key={s} className="fld">
                <span>{s} ft decks</span>
                {w
                  ? <input type="number" min={0} defaultValue={stock?.decks[s] ?? 0} key={`${stageId}-${s}-${stock?.decks[s] ?? 0}`} onBlur={e => void setStock({ decks: { [s]: Math.max(0, Number(e.target.value) || 0) } })} />
                  : <b className="num">{stock?.decks[s] ?? 0}</b>}
              </label>
            ))}
            <label className="fld" style={{ minWidth: '12rem' }}>
              <span>Leg heights (cm)</span>
              {w
                ? <input defaultValue={(stock?.heights ?? [20, 40, 60]).join(', ')} key={`${stageId}-h-${stock?.heights.join()}`} onBlur={e => void setStock({ heights: e.target.value.split(/[,\s]+/).map(Number).filter(n => n > 0).sort((x, y) => x - y) })} />
                : <b>{stock?.heights.join(', ') || '—'}</b>}
            </label>
          </div>
        </section>
        <section className="panel">
          <div className="ph"><h3>This day</h3></div>
          <div className="pb stack small">
            <span>Most in use at once: <b>{deckText(top) || 'none'}</b></span>
            <span className={short ? 'over' : 'muted'}>{short ? `${short} ${short === 1 ? 'show is' : 'shows are'} short of decks or legs` : 'Enough decks and legs for every show.'}</span>
          </div>
        </section>
      </div>

      <section className="panel tbl-wrap">
        <table>
          <thead><tr><th>On stage</th><th>{t.performer}</th><th>Needs</th><th>Rolling</th><th>Changeover in</th><th>Stock check</th></tr></thead>
          <tbody>
            {rows.map(r => {
              const art = artists[r.act.artist!]
              const bad = Object.keys(r.short).length > 0 || r.missingHeights.length > 0
              return (
                <tr key={r.act.id} className={bad ? 'clash' : undefined}>
                  <td className="num"><b>{fmtTime(eff(r.act).s, tz)}</b></td>
                  <td><Link to={`/s/${stageId}/plots?act=${art.id}`} style={{ color: 'inherit' }}><b>{art.name}</b></Link></td>
                  <td>{deckText(r.need) || <span className="muted">No risers</span>}{r.heights.length > 0 && <div className="small muted">{r.heights.join(' / ')} cm</div>}</td>
                  <td>{deckText(r.rolling) || '—'}</td>
                  <td className="num">{deckText(r.change, true).replace(/-/g, '−') || '—'}</td>
                  <td>
                    {bad
                      ? <span className="chip st">{[deckText(r.short) && `short ${deckText(r.short)}`, r.missingHeights.length && `no ${r.missingHeights.join('/')} cm legs`].filter(Boolean).join('; ')}</span>
                      : <span className="chip go">OK</span>}
                  </td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={6} className="empty">No shows on this {t.stage.toLowerCase()} this day.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  )
}
