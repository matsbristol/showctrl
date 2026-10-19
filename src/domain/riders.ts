/*
 * Technical and hospitality riders. One doc per artist and kind
 * (id `${artistId}_${kind}`), holding the items as a list. Each item is
 * assigned to the department that sources it and moves through
 * requested → agreed → sourced (or declined).
 *
 * The items are one array per rider, so two people editing the same rider
 * at the same moment is last-write-wins (see CLAUDE.md). Callers should
 * apply changes to the latest stored rider to keep that window small.
 */
import type { Id, Ms, PermKey, Rider, RiderItem, RiderItemStatus, RiderKind } from '../types/model'
import { rid } from './runsheet'

export const riderId = (artist: Id, kind: RiderKind) => `${artist}_${kind}`
export const riderPerm = (kind: RiderKind): PermKey => (kind === 'tech' ? 'riders_tech' : 'riders_hosp')
export const RIDER_LABEL: Record<RiderKind, string> = { tech: 'Technical', hosp: 'Hospitality' }

/**
 * One item per line; leading bullets and numbering ("- ", "• ", "3. ", "2) ")
 * are dropped. A bare leading number is a quantity and stays: "6 wedges".
 * (The prototype stripped any leading digits, turning "24 × water" into "× water".)
 */
export function parseRiderLines(text: string): string[] {
  return text.split('\n')
    .map(s => s.trim().replace(/^(?:[-*•]+|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
}

/** The rider with new items appended (created if the artist has none yet). */
export function addRiderItems(existing: Rider | undefined, artist: Id, kind: RiderKind, lines: string[], dept: Id | undefined, t: Ms): Rider {
  const items: RiderItem[] = lines.map(text => ({ id: rid(), text, status: 'requested', dept }))
  return {
    id: riderId(artist, kind),
    artist,
    kind,
    items: [...(existing?.items ?? []), ...items],
    updated: t,
  }
}

/** Changes one item's department or status. */
export function changeRiderItem(r: Rider, itemId: Id, patch: Partial<Pick<RiderItem, 'dept' | 'status' | 'text'>>, t: Ms): Pick<Rider, 'items' | 'updated'> {
  return { items: r.items.map(i => (i.id === itemId ? { ...i, ...patch } : i)), updated: t }
}

export function removeRiderItem(r: Rider, itemId: Id, t: Ms): Pick<Rider, 'items' | 'updated'> {
  return { items: r.items.filter(i => i.id !== itemId), updated: t }
}

/** Settled = sourced or declined; open = still requested or agreed. */
export const isSettled = (s: RiderItemStatus) => s === 'sourced' || s === 'declined'

export function riderProgress(items: RiderItem[]): { settled: number; total: number; open: number } {
  const settled = items.filter(i => isSettled(i.status)).length
  return { settled, total: items.length, open: items.length - settled }
}

export const riderTone = (s: RiderItemStatus) => (s === 'sourced' ? 'go' : s === 'declined' ? 'st' : s === 'agreed' ? 'ac' : 'sb')
