// Trucks & docks: truck movements from the run sheet, and where loads clash at a location.

import { MIN } from '../types/constants'
import type { Id, Location, Ms, RosItem } from '../types/model'
import { eff } from './runsheet'

/** "2 trucks, 2 sleeper buses" → 2. "1 truck" → 1. Anything else → 0. */
export function parseTrucks(vehicles: string | undefined): number {
  const m = /(\d+)\s*(?:×\s*)?trucks?\b/i.exec(vehicles ?? '')
  return m ? Number(m[1]) : 0
}

/** Run sheet items with trucks, in time order (effective times, delays included). */
export function truckMoves(ros: Readonly<Record<Id, RosItem>>, opts: { stage?: Id | null; from?: Ms; to?: Ms } = {}): RosItem[] {
  return Object.values(ros)
    .filter(i => (i.trucks ?? 0) > 0 && (!opts.stage || i.stage === opts.stage))
    .filter(i => (opts.from == null || eff(i).e >= opts.from) && (opts.to == null || eff(i).s <= opts.to))
    .sort((a, b) => eff(a).s - eff(b).s)
}

/** How many trucks a location takes at once: its own capacity, else 1 for bays and docks, unlimited for staging and parks. */
export function locationCapacity(l: Pick<Location, 'capacity' | 'kind'>): number {
  if (l.capacity != null && l.capacity > 0) return l.capacity
  return l.kind === 'loadbay' || l.kind === 'dock' ? 1 : Infinity
}

export interface Clash {
  location: Id
  /** When the overload starts and ends. */
  from: Ms
  to: Ms
  trucks: number
  capacity: number
  items: Id[]
}

/**
 * Times when more trucks are booked into a location than it takes. A point-in-time item
 * (arrival with no length) counts as 15 minutes on site.
 */
export function clashes(items: RosItem[], locations: Readonly<Record<Id, Location>>): Clash[] {
  const out: Clash[] = []
  const byLoc = new Map<Id, RosItem[]>()
  for (const i of items) if (i.dest && locations[i.dest]) byLoc.set(i.dest, [...(byLoc.get(i.dest) ?? []), i])
  for (const [loc, list] of byLoc) {
    const cap = locationCapacity(locations[loc])
    if (!Number.isFinite(cap)) continue
    const span = (i: RosItem) => { const { s, e } = eff(i); return { s, e: Math.max(e, s + 15 * MIN) } }
    const points = [...new Set(list.flatMap(i => [span(i).s, span(i).e]))].sort((a, b) => a - b)
    let open: Clash | null = null
    for (let k = 0; k < points.length - 1; k++) {
      const t = points[k]
      const here = list.filter(i => span(i).s <= t && span(i).e > t)
      const n = here.reduce((sum, i) => sum + (i.trucks ?? 0), 0)
      if (n > cap) {
        if (open && open.to === t) { open.to = points[k + 1]; open.trucks = Math.max(open.trucks, n); for (const i of here) if (!open.items.includes(i.id)) open.items.push(i.id) }
        else { open = { location: loc, from: t, to: points[k + 1], trucks: n, capacity: cap, items: here.map(i => i.id) }; out.push(open) }
      } else open = null
    }
  }
  return out.sort((a, b) => a.from - b.from)
}
