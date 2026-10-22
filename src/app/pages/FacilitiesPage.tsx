import { useState } from 'react'
import { useCollection } from '../../data/hooks'
import { allocationClashes, dressingWindow } from '../../lib/facilities'
import { eff } from '../../lib/runsheet'
import { festDay, fmtTime } from '../../lib/time'
import { FACILITY_KINDS, TAPE } from '../../types/constants'
import type { Allocation, Facility, Id } from '../../types/model'
import { DaySelector } from '../DaySelector'
import { useDay } from '../day'
import { AllocationForm, FacilityForm } from '../facilities/forms'
import { useAccess, useTerms, useTz } from '../session'

type Dialog = { type: 'facility'; facility: Facility | null } | { type: 'alloc'; alloc: Allocation | null; draft?: Partial<Allocation> } | null

export function FacilitiesPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
  const [day] = useDay()
  const facilities = useCollection('facilities')
  const allocations = useCollection('allocations')
  const artists = useCollection('artists')
  const stages = useCollection('stages')
  const ros = useCollection('ros')
  const [dialog, setDialog] = useState<Dialog>(null)

  const facs = Object.values(facilities)
    .filter(f => !f.stage || (sid ? f.stage === sid : a.canSeeStage(f.stage)))
    .sort((x, y) => (x.stage ? 1 : 0) - (y.stage ? 1 : 0) || x.kind.localeCompare(y.kind) || x.name.localeCompare(y.name))
  const ids = new Set(facs.map(f => f.id))
  const dayAllocs = Object.values(allocations).filter(x => ids.has(x.facility) && (festDay(x.from, tz) === day || festDay(x.to, tz) === day)).sort((x, y) => x.from - y.from)
  const clash = allocationClashes(Object.values(allocations), facilities)
  const canAdd = a.canW('facilities') || (sid ? a.canW('facilities', sid) : a.stagesSorted().some(s => a.canW('facilities', s.id)))

  // Acts playing this day without a dressing room booked.
  const roomed = new Set(Object.values(allocations).filter(x => facilities[x.facility]?.kind === 'dressing' && x.artist && festDay(x.from, tz) === day).map(x => x.artist))
  const playing = Object.values(ros).filter(i => i.kind === 'show' && i.artist && festDay(i.start, tz) === day && (sid ? i.stage === sid : a.canSeeStage(i.stage)))
  const needs = playing.filter(i => !roomed.has(i.artist!)).sort((x, y) => eff(x).s - eff(y).s)
  const who = (x: Allocation) => (x.artist ? artists[x.artist]?.name ?? 'Removed' : x.label || '—')

  return (
    <>
      <div className="head">
        <div><h1>Facilities</h1><p>Dressing rooms, offices and other spaces, and who has them when. Double bookings are flagged.</p></div>
        <div className="actions">
          <DaySelector />
          {canAdd && <button type="button" className="btn" onClick={() => setDialog({ type: 'facility', facility: null })}>+ Add facility</button>}
          {canAdd && facs.length > 0 && <button type="button" className="btn primary" onClick={() => setDialog({ type: 'alloc', alloc: null })}>+ Book</button>}
        </div>
      </div>
      <div className="grid g2" style={{ marginBottom: '1rem' }}>
        {facs.map(f => {
          const mine = dayAllocs.filter(x => x.facility === f.id)
          const st = f.stage ? stages[f.stage] : undefined
          const w = a.canW('facilities', f.stage ?? null)
          return (
            <section key={f.id} className="panel">
              <div className="ph">
                {st && <span className="tape" style={{ ['--c' as string]: TAPE[st.tape] }} />}
                <h3>{f.name}</h3>
                <span className="chip">{FACILITY_KINDS[f.kind]}</span>
                {w && <div className="actions"><button type="button" className="btn sm" aria-label={`Edit ${f.name}`} onClick={() => setDialog({ type: 'facility', facility: f })}>Edit</button></div>}
              </div>
              {mine.length ? (
                <ul className="list">
                  {mine.map(x => (
                    <li key={x.id} className={clash.has(x.id) ? 'clash' : undefined}>
                      <span className="num" style={{ minWidth: '6.5rem' }}><b>{fmtTime(x.from, tz)}–{fmtTime(x.to, tz)}</b></span>
                      <span>{who(x)}{x.notes && <span className="small muted"> · {x.notes}</span>}</span>
                      {clash.has(x.id) && <span className="chip st">Double booked</span>}
                      {w && <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setDialog({ type: 'alloc', alloc: x })}>Edit</button>}
                    </li>
                  ))}
                </ul>
              ) : <p className="empty">Free all day.</p>}
              {f.notes && <p className="small muted" style={{ padding: '0 1rem .75rem' }}>{f.notes}</p>}
            </section>
          )
        })}
        {!facs.length && <div className="panel"><p className="empty">No facilities yet.</p></div>}
      </div>
      {needs.length > 0 && (
        <section className="panel">
          <div className="ph"><h3>No dressing room yet</h3><span className="small muted">{needs.length} {needs.length === 1 ? t.performer.toLowerCase() : t.performers.toLowerCase()}</span></div>
          <ul className="list">
            {needs.map(i => {
              const win = dressingWindow(Object.values(ros).filter(r => r.artist === i.artist && festDay(r.start, tz) === day).sort((x, y) => eff(x).s - eff(y).s))
              return (
                <li key={i.id}>
                  <span className="num" style={{ minWidth: '3.2rem' }}><b>{fmtTime(eff(i).s, tz)}</b></span>
                  <span>{artists[i.artist!]?.name} <span className="small muted">· {stages[i.stage]?.name}{win ? ` · needs it ${fmtTime(win.from, tz)}–${fmtTime(win.to, tz)}` : ''}</span></span>
                  {canAdd && (
                    <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setDialog({
                      type: 'alloc', alloc: null,
                      draft: { artist: i.artist, from: win?.from, to: win?.to, facility: facs.find(f => f.kind === 'dressing' && (!f.stage || f.stage === i.stage))?.id },
                    })}>Book room</button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {dialog?.type === 'facility' && <FacilityForm facility={dialog.facility} sid={sid} onClose={() => setDialog(null)} />}
      {dialog?.type === 'alloc' && <AllocationForm alloc={dialog.alloc} draft={dialog.draft} onClose={() => setDialog(null)} />}
    </>
  )
}
