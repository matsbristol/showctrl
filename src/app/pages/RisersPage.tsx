import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useStore } from '../../data/hooks'
import { deckText, peak, planRisers, sizeLabel, sizesOf, stockOf, SYSTEMS } from '../../lib/risers'
import { eff, itemsFor } from '../../lib/runsheet'
import { fmtTime } from '../../lib/time'
import { RISER_LEGS, RISER_SYSTEMS } from '../../types/constants'
import type { Id, Plot, RiserStock, RiserSystem, RosItem } from '../../types/model'
import { DaySelector } from '../DaySelector'
import { useDay } from '../day'
import { useAccess, useTerms, useTz } from '../session'

/** Riser stock per stage against what each act's plot needs, in running order. */
export function RisersPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
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
  const acts = shows.map(s => ({ act: s, plot: plots[s.artist!] }))

  return (
    <>
      <div className="head">
        <div>
          <h1>Risers{st ? ` · ${st.name}` : ''}</h1>
          <p>What each {t.performer.toLowerCase()}’s stage plot needs against this {t.stage.toLowerCase()}’s stock, for each riser system. Rolling risers count twice while the act before them plays, because they’re built off stage.</p>
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
      {stageId && SYSTEMS.map(sys => <SystemSection key={`${stageId}-${sys}`} sys={sys} stageId={stageId} stock={stock} acts={acts} w={w} />)}
    </>
  )
}

/** One riser system on one stage: its stock, the day's peak, and the check per act. */
function SystemSection({ sys, stageId, stock, acts, w }: {
  sys: RiserSystem
  stageId: Id
  stock: RiserStock | undefined
  acts: { act: RosItem; plot: Plot | undefined }[]
  w: boolean
}) {
  const t = useTerms()
  const tz = useTz()
  const store = useStore()
  const artists = useCollection('artists')
  const name = RISER_SYSTEMS[sys].label
  const have = stockOf(stock, sys)
  const rows = planRisers(acts, stock, sys)
  const used = rows.filter(r => Object.keys(r.need).length || Object.keys(r.change).length)
  const top = peak(rows)
  const lacks = (r: (typeof rows)[number]) => Object.keys(r.short).length > 0 || r.missingHeights.length > 0 || r.missingTelescopic
  const short = rows.filter(lacks).length
  const hasStock = Object.values(have.decks).some(n => n > 0)

  // A system's first stock starts with every leg, so a deck count alone doesn't flag missing legs.
  const setStock = async (patch: { decks?: Record<string, number>; heights?: number[]; telescopic?: boolean }) => {
    const first = { decks: { ...have.decks, ...patch.decks }, heights: patch.heights ?? (have.heights.length ? have.heights : [...RISER_LEGS]), telescopic: patch.telescopic ?? (have.heights.length ? have.telescopic : true) }
    if (!stock) await store.set('risers', stageId, { stage: stageId, systems: { [sys]: first }, notes: '' })
    else if (!stock.systems?.[sys]) await store.update('risers', stageId, { systems: { [sys]: first } })
    else await store.update('risers', stageId, { systems: { [sys]: patch } })
  }
  const legs = [...new Set([...RISER_LEGS, ...have.heights])].sort((x, y) => x - y)

  return (
    <section className="riser-system" aria-label={name}>
      <h2>{name}</h2>
      <div className="grid g2" style={{ marginBottom: '1rem' }}>
        <section className="panel">
          <div className="ph"><h3>Stock</h3>{hasStock ? null : <span className="small muted">None on this {t.stage.toLowerCase()}</span>}</div>
          <div className="pb row riser-stock">
            {sizesOf(sys).map(s => (
              <label key={s} className="fld">
                <span>{sizeLabel(s)}</span>
                {w
                  ? <input type="number" min={0} aria-label={`${name} ${sizeLabel(s)} decks`} defaultValue={have.decks[s] ?? 0} key={`${s}-${have.decks[s] ?? 0}`} onBlur={e => void setStock({ decks: { [s]: Math.max(0, Number(e.target.value) || 0) } })} />
                  : <b className="num">{have.decks[s] ?? 0}</b>}
              </label>
            ))}
            <fieldset className="riser-legs">
              <legend>Legs</legend>
              {legs.map(h => (
                <label key={h} className="row small">
                  <input type="checkbox" aria-label={`${name} ${h} cm legs`} disabled={!w} checked={have.heights.includes(h)}
                    onChange={e => void setStock({ heights: (e.target.checked ? [...have.heights, h] : have.heights.filter(x => x !== h)).sort((x, y) => x - y) })} /> {h} cm
                </label>
              ))}
              <label className="row small">
                <input type="checkbox" aria-label={`${name} telescopic legs`} disabled={!w} checked={!!have.telescopic} onChange={e => void setStock({ telescopic: e.target.checked })} /> Telescopic
              </label>
            </fieldset>
          </div>
        </section>
        <section className="panel">
          <div className="ph"><h3>This day</h3></div>
          <div className="pb stack small">
            <span>Most in use at once: <b>{deckText(top, sys) || 'none'}</b></span>
            <span className={short ? 'over' : 'muted'}>{short ? `${short} ${short === 1 ? 'show is' : 'shows are'} short of ${name} decks or legs` : `Enough ${name} decks and legs for every show.`}</span>
          </div>
        </section>
      </div>

      <section className="panel tbl-wrap" style={{ marginBottom: '1.5rem' }}>
        <table>
          <thead><tr><th>On stage</th><th>{t.performer}</th><th>Needs</th><th>Rolling</th><th>Changeover in</th><th>Stock check</th></tr></thead>
          <tbody>
            {used.map(r => {
              const art = artists[r.act.artist!]
              const bad = lacks(r)
              return (
                <tr key={r.act.id} className={bad ? 'clash' : undefined}>
                  <td className="num"><b>{fmtTime(eff(r.act).s, tz)}</b></td>
                  <td><Link to={`/s/${stageId}/plots?act=${art.id}`} style={{ color: 'inherit' }}><b>{art.name}</b></Link></td>
                  <td>{deckText(r.need, sys) || <span className="muted">None</span>}{(r.heights.length > 0 || r.telescopic) && <div className="small muted">{[r.heights.length ? `${r.heights.join(' / ')} cm` : '', r.telescopic ? 'telescopic' : ''].filter(Boolean).join(' + ')}</div>}</td>
                  <td>{deckText(r.rolling, sys) || '—'}</td>
                  <td className="num">{deckText(r.change, sys, true).replace(/-/g, '−') || '—'}</td>
                  <td>
                    {bad
                      ? <span className="chip st">{[deckText(r.short, sys) && `short ${deckText(r.short, sys)}`, r.missingHeights.length && `no ${r.missingHeights.join('/')} cm legs`, r.missingTelescopic && 'no telescopic legs'].filter(Boolean).join('; ')}</span>
                      : <span className="chip go">OK</span>}
                  </td>
                </tr>
              )
            })}
            {!used.length && <tr><td colSpan={6} className="empty">No act uses {name} risers on this {t.stage.toLowerCase()} this day.</td></tr>}
          </tbody>
        </table>
      </section>
    </section>
  )
}
