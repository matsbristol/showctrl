import { Link } from 'react-router-dom'
import { useCollection, useConfig } from '../../data/hooks'
import { eff } from '../../lib/runsheet'
import { fmtTime } from '../../lib/time'
import { truckMoves } from '../../lib/trucks'
import { moduleOn } from '../../shared/modules'
import { HOUR, MIN } from '../../types/constants'
import type { Id, RosItem } from '../../types/model'
import { Icon } from '../Icon'
import { KindTag } from '../runsheet/parts'
import { useNow, useTz } from '../session'

/** "2 trucks → Staging area North" under a run sheet item, when the Trucks module is on. */
export function TruckLine({ item, clash }: { item: RosItem; clash?: boolean }) {
  const cfg = useConfig('event')
  const locations = useCollection('locations')
  if (!moduleOn(cfg, 'trucks') || !item.trucks) return null
  const dest = item.dest ? locations[item.dest]?.name : null
  return (
    <div className={`truckline${clash ? ' clash' : ''}`}>
      <Icon name="truck" />{item.trucks} {item.trucks === 1 ? 'truck' : 'trucks'}{dest ? ` → ${dest}` : ' · no location set'}
      {clash && <b> · clash</b>}
    </div>
  )
}

/** "Trucks, next 4 hours" for a stage's Today page: time, act, count and where to send them. */
export function TrucksSoon({ sid }: { sid: Id }) {
  const cfg = useConfig('event')
  const ros = useCollection('ros')
  const artists = useCollection('artists')
  const locations = useCollection('locations')
  const tz = useTz()
  const now = useNow(30_000)
  if (!moduleOn(cfg, 'trucks')) return null
  const soon = truckMoves(ros, { stage: sid, from: now - 15 * MIN, to: now + 4 * HOUR }).filter(i => i.status !== 'done')
  return (
    <section className="panel">
      <div className="ph"><h3>Trucks, next 4 hours</h3><div className="actions"><Link className="btn sm" to={`/s/${sid}/trucks`}>All trucks</Link></div></div>
      {soon.length ? (
        <ul className="list">
          {soon.map(i => (
            <li key={i.id}>
              <span className="num" style={{ minWidth: '3.2rem' }}><b>{fmtTime(eff(i).s, tz)}</b></span>
              <KindTag kind={i.kind} />
              <span>
                {(i.artist && artists[i.artist]?.name) || i.title} · <b>{i.trucks}</b> {i.trucks === 1 ? 'truck' : 'trucks'}
                <span className="muted small"> → {i.dest ? locations[i.dest]?.name : 'no location set'}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="empty">No trucks due in the next four hours.</p>}
    </section>
  )
}
