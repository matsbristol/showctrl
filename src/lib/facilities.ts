// Facilities: who has which room when, and double bookings.

import type { Allocation, Facility, Id, Ms, RosItem } from '../types/model'
import { eff } from './runsheet'

/** Bookings that overlap more than the facility holds (capacity, default 1). */
export function allocationClashes(allocs: Allocation[], facilities: Readonly<Record<Id, Facility>>): Set<Id> {
  const out = new Set<Id>()
  const byFac = new Map<Id, Allocation[]>()
  for (const x of allocs) byFac.set(x.facility, [...(byFac.get(x.facility) ?? []), x])
  for (const [fid, list] of byFac) {
    const cap = Math.max(1, facilities[fid]?.capacity ?? 1)
    for (const x of list) {
      // Count bookings overlapping the moment each booking starts.
      const at = list.filter(y => y.from <= x.from && y.to > x.from)
      if (at.length > cap) for (const y of at) out.add(y.id)
    }
  }
  return out
}

/** When an act needs a dressing room: from get in (or arrival) to departure, on that show day. */
export function dressingWindow(items: RosItem[]): { from: Ms; to: Ms } | null {
  const first = items.find(i => i.kind === 'getin') ?? items.find(i => i.kind === 'arrival')
  const last = [...items].reverse().find(i => i.kind === 'departure') ?? [...items].reverse().find(i => i.kind === 'loadout')
  if (!first || !last) return null
  return { from: eff(first).s, to: eff(last).e }
}
