import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection } from '../../data/hooks'
import { eff } from '../../lib/runsheet'
import { festDay, fmtTime } from '../../lib/time'
import { RISK_LEVELS, TAPE } from '../../types/constants'
import type { Artist, Id, RiskLevel } from '../../types/model'
import { DaySelector } from '../DaySelector'
import { useDay } from '../day'
import { RiskBadge } from '../risk/RiskChip'
import { RiskForm } from '../risk/RiskForm'
import { useAccess, useTerms, useTz } from '../session'

type Filter = RiskLevel | 'none' | 'all'

/** Every show on the selected day with its rating, highest risk first within each hour. */
export function RiskPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
  const [day] = useDay()
  const ros = useCollection('ros')
  const artists = useCollection('artists')
  const risks = useCollection('risks')
  const stages = useCollection('stages')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Artist | null>(null)
  const base = sid ? `/s/${sid}` : '/hq'

  const shows = Object.values(ros)
    .filter(i => i.kind === 'show' && i.artist && artists[i.artist] && (sid ? i.stage === sid : a.canSeeStage(i.stage)) && festDay(i.start, tz) === day)
    .sort((x, y) => eff(x).s - eff(y).s)
  const levelOf = (aid: Id): RiskLevel | 'none' => risks[aid]?.level ?? 'none'
  const counts = { red: 0, orange: 0, green: 0, none: 0 } as Record<RiskLevel | 'none', number>
  for (const s of shows) counts[levelOf(s.artist!)]++
  const list = shows.filter(s => filter === 'all' || levelOf(s.artist!) === filter)

  return (
    <>
      <div className="head">
        <div>
          <h1>{sid ? `Risk · ${stages[sid]?.name}` : 'Risk assessment'}</h1>
          <p>Each {t.performer.toLowerCase()}’s rating with its factors and measures. Ratings show on run sheets and now/next cards too.</p>
        </div>
        <div className="actions"><DaySelector /></div>
      </div>

      <div className="risk-summary" role="group" aria-label="Filter by rating">
        {(['red', 'orange', 'green', 'none'] as const).map(l => (
          <button key={l} type="button" className={`risk-${l}`} aria-pressed={filter === l} onClick={() => setFilter(f => (f === l ? 'all' : l))}>
            <b className="num">{counts[l]}</b>
            <span>{l === 'none' ? 'Not assessed' : RISK_LEVELS[l].label}</span>
          </button>
        ))}
      </div>

      <section className="panel tbl-wrap">
        <table>
          <thead>
            <tr><th>On stage</th>{!sid && <th>{t.stage}</th>}<th>{t.performer}</th><th>Rating</th><th>Factors</th><th>Measures and notes</th><th /></tr>
          </thead>
          <tbody>
            {list.map(s => {
              const art = artists[s.artist!]
              const r = risks[art.id]
              const st = stages[s.stage]
              return (
                <tr key={s.id} className={r ? `risk-row-${r.level}` : undefined}>
                  <td className="num"><b>{fmtTime(eff(s).s, tz)}</b></td>
                  {!sid && <td>{st && <span className="row"><span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} />{st.name}</span>}</td>}
                  <td><Link to={`${base}/artists/${art.id}`} style={{ color: 'inherit' }}><b>{art.name}</b></Link></td>
                  <td><RiskBadge level={r?.level ?? null} /></td>
                  <td className="small">{r?.factors.join(', ') || '—'}</td>
                  <td className="small" style={{ maxWidth: '32ch' }}>{r?.notes || '—'}</td>
                  <td>{a.canW('risk', art.stage) && <button type="button" className="btn sm" onClick={() => setEditing(art)}>{r ? 'Edit' : 'Assess'}</button>}</td>
                </tr>
              )
            })}
            {!list.length && <tr><td colSpan={7} className="empty">No shows {filter === 'all' ? 'this day' : 'with this rating'}.</td></tr>}
          </tbody>
        </table>
      </section>
      {editing && <RiskForm artist={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
