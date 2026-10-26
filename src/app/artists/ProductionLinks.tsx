import { Link } from 'react-router-dom'
import { useCollection, useConfig } from '../../data/hooks'
import { riserText } from '../../lib/summary'
import { fmtTime, dayLabel, dayKey } from '../../lib/time'
import { moduleOn } from '../../shared/modules'
import type { Artist } from '../../types/model'
import { fileUrl } from '../backend'
import { useAccess, useTz } from '../session'
import { tr } from '../../i18n'

/**
 * On the artist page: this act's input list, stage plot, dressing rooms, rides and documents,
 * each linking to its page. Only what the module and the user's rights allow.
 */
export function ProductionLinks({ artist }: { artist: Artist }) {
  const a = useAccess()
  const cfg = useConfig('event')
  const tz = useTz()
  const lines = useCollection('lines')[artist.id]
  const plot = useCollection('plots')[artist.id]
  const allocations = useCollection('allocations')
  const facilities = useCollection('facilities')
  const transfers = useCollection('transfers')
  const files = useCollection('files')
  const base = `/s/${artist.stage}`
  const on = (m: Parameters<typeof moduleOn>[1]) => moduleOn(cfg, m)
  const tech = a.lv('technical', artist.stage) >= 1
  const rooms = Object.values(allocations).filter(x => x.artist === artist.id).sort((x, y) => x.from - y.from)
  const rides = Object.values(transfers).filter(x => x.artist === artist.id && x.status !== 'cancelled').sort((x, y) => x.at - y.at)
  const docs = Object.values(files).filter(f => f.artist === artist.id)
  const when = (ms: number) => `${dayLabel(dayKey(ms, tz))} ${fmtTime(ms, tz)}`

  const rows = [
    on('lines') && tech && (
      <li key="lines"><span className="pl-k">{tr('Input list')}</span>
        <Link to={`${base}/lines?act=${artist.id}`}>{lines && Object.keys(lines.inputs).length ? tr('{inputs} inputs, {mixes} mixes', { inputs: Object.keys(lines.inputs).length, mixes: Object.keys(lines.outputs).length }) : tr('Not added yet')}</Link></li>
    ),
    on('plots') && tech && (
      <li key="plot"><span className="pl-k">{tr('Stage plot')}</span>
        <Link to={`${base}/plots?act=${artist.id}`}>{plot && Object.keys(plot.items).length ? `${tr('{n} items', { n: Object.keys(plot.items).length })}${riserText(plot) ? ` · ${riserText(plot)}` : ''}` : tr('Not drawn yet')}</Link></li>
    ),
    on('facilities') && a.lv('facilities', artist.stage) >= 1 && (
      <li key="rooms"><span className="pl-k">{tr('Rooms')}</span>
        <span>{rooms.length ? rooms.map(r => <span key={r.id} className="pl-line">{facilities[r.facility]?.name}: {when(r.from)}–{fmtTime(r.to, tz)}</span>) : <Link to={`${base}/facilities`}>{tr('None booked')}</Link>}</span></li>
    ),
    on('transport') && a.lv('transport', artist.stage) >= 1 && (
      <li key="rides"><span className="pl-k">{tr('Rides')}</span>
        <span>{rides.length ? rides.map(r => <span key={r.id} className="pl-line">{when(r.at)} {r.from} → {r.to} · {tr(r.status)}</span>) : <Link to={`${base}/transport`}>{tr('None booked')}</Link>}</span></li>
    ),
    on('documents') && a.lv('documents', artist.stage) >= 1 && docs.length > 0 && (
      <li key="docs"><span className="pl-k">{tr('Documents')}</span>
        <span>{docs.map(d => <a key={d.id} className="pl-line" href={d.url || (d.blob ? fileUrl(d.blob.key) : undefined)} target="_blank" rel="noopener noreferrer">{d.name}</a>)}</span></li>
    ),
  ].filter(Boolean)

  if (!rows.length) return null
  return (
    <section className="panel">
      <div className="ph"><h3>{tr('At a glance')}</h3></div>
      <ul className="list prodlinks">{rows}</ul>
    </section>
  )
}
