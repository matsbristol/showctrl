import { Link } from 'react-router-dom'
import { useCollection } from '../../data/hooks'
import { itemsFor } from '../../lib/runsheet'
import { TAPE } from '../../types/constants'
import { DaySelector } from '../DaySelector'
import { useDay } from '../day'
import { DelayChip, Lanes, SheetRow } from '../runsheet/parts'
import { useAccess, useTerms, useTz } from '../session'

/** HQ running order: on-stage activity across every visible stage. */
export function SchedulePage() {
  const a = useAccess()
  const t = useTerms()
  const tz = useTz()
  const ros = useCollection('ros')
  const [day] = useDay()
  const stages = a.visibleStages()
  const lanes = stages.map(s => ({
    label: s.name, color: TAPE[s.tape], short: true,
    items: itemsFor(ros, s.id, tz, day, 'stage').filter(i => i.kind !== 'access'),
  }))
  return (
    <>
      <div className="head">
        <div>
          <h1>Running order</h1>
          <p>All {t.stages.toLowerCase()}, on-stage activity only. Open a {t.stage.toLowerCase()}’s run sheet for get in, load in and load out.</p>
        </div>
        <div className="actions"><DaySelector /></div>
      </div>
      {stages.length > 0 && <Lanes lanes={lanes} day={day} />}
      <div className="grid g3">
        {stages.map(s => {
          const shows = itemsFor(ros, s.id, tz, day).filter(i => i.kind === 'show')
          return (
            <section key={s.id} className="panel tapeL" style={{ ['--c' as string]: TAPE[s.tape] }}>
              <div className="ph">
                <h3>{s.name}</h3>
                <DelayChip sid={s.id} />
                <div className="actions"><Link className="btn sm" to={`/s/${s.id}/runsheet?day=${day}`}>Run sheet</Link></div>
              </div>
              {shows.length ? <ul className="sheet">{shows.map(i => <SheetRow key={i.id} item={i} showArtist />)}</ul> : <p className="empty">No shows this day.</p>}
            </section>
          )
        })}
      </div>
    </>
  )
}
