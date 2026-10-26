// Run sheet actions, ported from ACT.itemLive / itemDone / delay / resetDelay.

import { useCallback, useMemo } from 'react'
import { useStore } from '../../data/hooks'
import { eff, itemsFor, shiftTargets, track } from '../../lib/runsheet'
import { festDay, fmtTime } from '../../lib/time'
import { MIN } from '../../types/constants'
import type { DayKey, Id, RosItem } from '../../types/model'
import { useTz } from '../session'
import { useServerTime } from '../time'
import { useToast } from '../ui/toast'
import { tr } from '../../i18n'

const mins = (ms: number) => Math.round(Math.abs(ms) / MIN)

export function useRunSheetActions() {
  const store = useStore()
  const tz = useTz()
  const toast = useToast()
  const serverNow = useServerTime()
  const ros = useCallback(() => store.peek('ros') ?? {}, [store])
  const stageName = useCallback((sid: Id) => store.peek('stages')?.[sid]?.name ?? '', [store])

  /** Adds `deltaMs` to an item and everything after it on that stage and day. */
  const shiftFrom = useCallback(async (item: RosItem, deltaMs: number, note?: string, dockToo = true) => {
    await Promise.all(shiftTargets(ros(), item, tz, dockToo).map(x =>
      store.update('ros', x.id, { delay: (x.delay || 0) + deltaMs, ...(x.id === item.id && note ? { delayNote: note } : {}) })))
  }, [store, ros, tz])

  /** "On stage" / "Start": marks live, records the actual time, offers to shift the rest if a show started off time. */
  const goLive = useCallback(async (it: RosItem) => {
    const t = serverNow()
    if (track(it) === 'stage') {
      const others = itemsFor(ros(), it.stage, tz, null, 'stage').filter(x => x.status === 'live' && x.id !== it.id)
      await Promise.all(others.map(x => store.update('ros', x.id, { status: 'done' })))
    }
    await store.update('ros', it.id, { status: 'live', actual: t })
    if (it.kind === 'show' && it.artist) await store.update('artists', it.artist, { status: 'on stage' })
    const diff = t - eff(it).s
    if (it.kind === 'show' && Math.abs(diff) >= 2 * MIN) {
      const late = diff > 0
      toast(late ? tr('{title} went on {n} min late.', { title: it.title, n: mins(diff) }) : tr('{title} went on {n} min early.', { title: it.title, n: mins(diff) }), {
        label: late ? tr('Shift the rest +{n} min', { n: mins(diff) }) : tr('Shift the rest −{n} min', { n: mins(diff) }),
        run: () => { const cur = ros()[it.id]; if (cur) void shiftFrom(cur, Math.round(diff / MIN) * MIN, late ? 'Started late' : 'Started early') },
      })
    }
  }, [store, ros, tz, toast, serverNow, shiftFrom])

  /** "Done": records the actual end, offers to shift the rest if a show overran. */
  const markDone = useCallback(async (it: RosItem) => {
    const t = serverNow()
    await store.update('ros', it.id, { status: 'done', actualEnd: t })
    if (it.kind === 'show' && it.artist) await store.update('artists', it.artist, { status: 'done' })
    const diff = t - eff(it).e
    if (it.kind === 'show' && diff >= 2 * MIN) {
      toast(tr('{title} overran by {n} min.', { title: it.title, n: mins(diff) }), {
        label: tr('Shift the rest +{n} min', { n: mins(diff) }),
        run: () => {
          const nx = itemsFor(ros(), it.stage, tz, festDay(it.start, tz)).find(x => x.start > it.start && x.status !== 'done')
          if (nx) void shiftFrom(nx, Math.round(diff / MIN) * MIN, `${it.title} overran`)
        },
      })
    }
  }, [store, ros, tz, toast, serverNow, shiftFrom])

  const delay = useCallback(async (it: RosItem, minutes: number, note: string, dockToo: boolean) => {
    await shiftFrom(it, minutes * MIN, note, dockToo)
    toast(tr('Everything on {stage} from {time} moved {n} min.', { stage: stageName(it.stage), time: fmtTime(eff(it).s, tz), n: `${minutes > 0 ? '+' : ''}${minutes}` }))
  }, [shiftFrom, toast, stageName, tz])

  /** Puts a stage's day back on the planned times. */
  const resetDelays = useCallback(async (sid: Id, day: DayKey) => {
    await Promise.all(itemsFor(ros(), sid, tz, day).filter(x => x.delay).map(x => store.update('ros', x.id, { delay: 0, delayNote: '' })))
  }, [store, ros, tz])

  return useMemo(() => ({ goLive, markDone, delay, resetDelays, shiftFrom }), [goLive, markDone, delay, resetDelays, shiftFrom])
}
