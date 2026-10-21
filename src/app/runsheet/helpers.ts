import { useCollection } from '../../data/hooks'
import { nowNext } from '../../lib/runsheet'
import { KINDS, LEGACY_KINDS } from '../../types/constants'
import type { Id } from '../../types/model'
import type { IconName } from '../Icon'
import { useNow, useTz } from '../session'

const ALL_KINDS: Record<string, { label: string }> = { ...KINDS, ...LEGACY_KINDS }

export const kindLabel = (k: string) => ALL_KINDS[k]?.label ?? k

const KIND_ICONS: Record<string, IconName> = {
  arrival: 'arrival', getin: 'getin', loadin: 'loadin', access: 'access', soundcheck: 'soundcheck', linecheck: 'linecheck',
  changeover: 'changeover', show: 'show', loadout: 'loadout', departure: 'departure', doors: 'doors', curfew: 'curfew',
  meeting: 'meeting', other: 'other', set: 'show', break: 'other',
}

/** Each kind's icon; legacy kinds borrow the closest one. */
export const kindIcon = (k: string): IconName => KIND_ICONS[k] ?? 'other'

/** The CSS class that gives a kind its colour (legacy kinds borrow the closest). */
export const kindClass = (k: string) => `k-${k === 'set' ? 'show' : k === 'break' ? 'other' : k}`

/** A stage's now and next, refreshed every few seconds. */
export function useNowNext(sid: Id) {
  const ros = useCollection('ros')
  const tz = useTz()
  const now = useNow(5_000)
  return nowNext(ros, sid, now, tz)
}
