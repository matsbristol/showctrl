import { useCollection } from '../../data/hooks'
import { nowNext } from '../../lib/runsheet'
import { KINDS, LEGACY_KINDS } from '../../types/constants'
import type { Id } from '../../types/model'
import { useNow, useTz } from '../session'

const ALL_KINDS: Record<string, { label: string }> = { ...KINDS, ...LEGACY_KINDS }

export const kindLabel = (k: string) => ALL_KINDS[k]?.label ?? k

/** A stage's now and next, refreshed every few seconds. */
export function useNowNext(sid: Id) {
  const ros = useCollection('ros')
  const tz = useTz()
  const now = useNow(5_000)
  return nowNext(ros, sid, now, tz)
}
