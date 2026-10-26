// The act list on the left of per-act pages (input lists, stage plots). The chosen act is in
// the URL (?act=), so a link opens straight to it.

import type { ReactNode } from 'react'
import { useCollection } from '../../data/hooks'
import { fmtTime } from '../../lib/time'
import { TAPE } from '../../types/constants'
import type { Artist, Id } from '../../types/model'
import { useTerms, useTz } from '../session'
import type { ActRow } from './acts'
import { tr } from '../../i18n'

export function ActPicker({ acts, selected, onSelect, badge }: {
  acts: ActRow[]
  selected: Id | null
  onSelect: (id: Id) => void
  /** Shown on the right of each act, e.g. "24 ch". */
  badge?: (a: Artist) => ReactNode
}) {
  const t = useTerms()
  const tz = useTz()
  const stages = useCollection('stages')
  const today = acts.filter(x => x.show != null)
  const other = acts.filter(x => x.show == null)
  const item = ({ artist, show }: ActRow) => (
    <button key={artist.id} type="button" aria-pressed={artist.id === selected} onClick={() => onSelect(artist.id)}>
      <span className="tape" style={{ ['--c' as string]: TAPE[stages[artist.stage]?.tape ?? 'grey'] }} />
      <span className="ap-name">{artist.name}<small>{show != null ? fmtTime(show, tz) : stages[artist.stage]?.name}</small></span>
      {badge && <span className="ap-badge">{badge(artist)}</span>}
    </button>
  )
  return (
    <nav className="panel actpicker" aria-label={t.performers}>
      {today.map(item)}
      {other.length > 0 && <><div className="ap-sep">{tr('Other days')}</div>{other.map(item)}</>}
      {!acts.length && <p className="empty">{tr('No {performers} yet.', { performers: t.performers.toLowerCase() })}</p>}
    </nav>
  )
}
