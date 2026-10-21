import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useConfig } from '../../data/hooks'
import { buildSummary, summaryCsv } from '../../lib/summary'
import { dayLabel, fmtTime } from '../../lib/time'
import { moduleOn } from '../../shared/modules'
import { MIN, TAPE } from '../../types/constants'
import type { Id } from '../../types/model'
import { DaySelector } from '../DaySelector'
import { useDay } from '../day'
import { RiskBadge } from '../risk/RiskChip'
import { KindTag, Tel } from '../runsheet/parts'
import { useAccess, useTerms, useTz } from '../session'

/** Every act for a day on one page, with CSV and print. */
export function SummaryPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
  const cfg = useConfig('event')
  const [day] = useDay()
  const [q, setQ] = useState('')
  const [fs, setFs] = useState('')
  const data = {
    ros: useCollection('ros'), artists: useCollection('artists'), stages: useCollection('stages'),
    lines: useCollection('lines'), plots: useCollection('plots'), risks: useCollection('risks'), locations: useCollection('locations'),
  }
  const stage = sid ?? (fs || null)
  const rows = buildSummary({ ...data, tz, contacts: x => a.artistContacts(x) }, { day, stage, q })
    .filter(r => sid || a.canSeeStage(r.show.stage))
  const base = sid ? `/s/${sid}` : '/hq'
  const tech = moduleOn(cfg, 'lines') || moduleOn(cfg, 'plots')
  const risk = moduleOn(cfg, 'risk')

  const download = () => {
    const blob = new Blob(['﻿' + summaryCsv(rows, tz)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `technical-summary-${sid ? data.stages[sid]?.name.toLowerCase().replace(/\W+/g, '-') + '-' : ''}${day}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Technical summary{sid ? ` · ${data.stages[sid]?.name}` : ''}</h1>
          <p>{dayLabel(day, true)}: every {t.performer.toLowerCase()} with key times, party, loads, contact{tech ? ', inputs and risers' : ''}.</p>
        </div>
        <div className="actions no-print">
          <DaySelector />
          <button type="button" className="btn" onClick={download} disabled={!rows.length}>Export CSV</button>
          <button type="button" className="btn" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      <div className="filters no-print">
        <input type="search" placeholder={`Search ${t.performers.toLowerCase()}`} aria-label="Search" value={q} onChange={e => setQ(e.target.value)} />
        {!sid && (
          <select aria-label={t.stage} value={fs} onChange={e => setFs(e.target.value)}>
            <option value="">All {t.stages.toLowerCase()}</option>
            {a.stagesSorted().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <span className="small muted">{rows.length} {rows.length === 1 ? 'show' : 'shows'}</span>
      </div>
      <section className="panel tbl-wrap summary">
        <table>
          <thead>
            <tr>
              <th>{t.performer}</th>
              <th>Schedule</th>
              <th>Party &amp; vehicles</th>
              <th>Load in / out</th>
              <th>Main contact</th>
              {tech && <th>Inputs &amp; risers</th>}
              {risk && <th>Risk</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.show.id}>
                <td className="sum-act">
                  <Link to={`${base}/artists/${r.artist.id}`}><b>{r.artist.name}</b></Link>
                  {r.stage && <span className="row small"><span className="tape" style={{ ['--c' as string]: TAPE[r.stage.tape] }} />{r.stage.name}</span>}
                  <span className="small muted">Show {fmtTime(r.times.find(x => x.kind === 'show')?.start ?? r.show.start, tz)}</span>
                </td>
                <td>
                  <dl className="sum-times">
                    {r.times.map((x, i) => (
                      <div key={i}>
                        <dt><KindTag kind={x.kind} /></dt>
                        <dd className="num">{fmtTime(x.start, tz)}{x.end - x.start >= 5 * MIN ? `–${fmtTime(x.end, tz)}` : ''}{x.delayed ? ' *' : ''}</dd>
                      </div>
                    ))}
                  </dl>
                </td>
                <td className="small">{r.party ? `${r.party} people` : '—'}{r.vehicles && <div className="muted">{r.vehicles}</div>}</td>
                <td className="small">
                  {r.loadIn ? <div>In: <b>{r.loadIn.trucks}</b> → {r.loadIn.dest || 'not set'}</div> : null}
                  {r.loadOut ? <div>Out: <b>{r.loadOut.trucks}</b> → {r.loadOut.dest || 'not set'}</div> : null}
                  {!r.loadIn && !r.loadOut && '—'}
                </td>
                <td className="small">{r.contact ? <><b>{r.contact.name}</b><div className="muted">{r.contact.role}</div><Tel phone={r.contact.phone} /></> : '—'}</td>
                {tech && <td className="small">{r.inputs ? `${r.inputs} in / ${r.outputs} out` : <span className="muted">No input list</span>}{r.risers && <div className="muted">{r.risers}</div>}</td>}
                {risk && <td><RiskBadge level={r.risk} /></td>}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="empty">No shows this day.</td></tr>}
          </tbody>
        </table>
        <p className="small muted" style={{ padding: '.5rem 1rem' }}>* Running late: times include the delay.</p>
      </section>
    </>
  )
}
