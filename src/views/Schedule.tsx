/* HQ running order: every visible stage side by side, on-stage activity only. */
import { Link } from 'react-router-dom'
import { tapeHex } from '../domain/constants'
import { itemsFor } from '../domain/runsheet'
import { useSnapshot } from '../data/hooks'
import { useAccess } from '../session/hooks'
import { stagePath } from '../shell/nav'
import { colourVar } from '../shell/style'
import { DaySeg, DelayChip, Head, SheetRow } from './common'
import { useDay, useEvent } from './hooks'
import { Lanes } from './Lanes'

export function Schedule() {
  const snap = useSnapshot()
  const access = useAccess()
  const { tz, T } = useEvent()
  const { day } = useDay()
  const stages = access.visibleStages()
  const lanes = stages.map(s => ({
    label: s.name,
    tape: tapeHex(s.tape),
    short: true,
    items: itemsFor(snap.col.ros, s.id, { day, track: 'stage', tz }).filter(i => i.kind !== 'access'),
  }))

  return (
    <>
      <Head
        title="Running order"
        sub={`All ${T.stages.toLowerCase()}, on-stage activity only. Open a ${T.stage.toLowerCase()}'s run sheet for get in, load in and load out.`}
        actions={<DaySeg />}
      />
      {stages.length > 0 && <Lanes lanes={lanes} day={day} />}
      <div className="grid g3">
        {stages.map(s => {
          const shows = itemsFor(snap.col.ros, s.id, { day, tz }).filter(i => i.kind === 'show')
          return (
            <section key={s.id} className="panel tapeL" style={colourVar(tapeHex(s.tape))}>
              <div className="ph">
                <h3>{s.name}</h3>
                <DelayChip sid={s.id} />
                <div className="actions"><Link className="btn sm" to={`${stagePath(s.id, 'runsheet')}?day=${day}`}>Run sheet</Link></div>
              </div>
              {shows.length ? <ul className="sheet">{shows.map(i => <SheetRow key={i.id} item={i} showArtist />)}</ul> : <p className="empty">No shows this day.</p>}
            </section>
          )
        })}
      </div>
    </>
  )
}
