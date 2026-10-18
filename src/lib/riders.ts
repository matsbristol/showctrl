// Rider helpers, ported from riderPanel / riderAddForm in the prototype.

import type { Id, Rider, RiderItem, RiderKind } from '../types/model'
import { rid } from './id'

export const riderId = (artistId: Id, kind: RiderKind) => `${artistId}_${kind}`

/** A rider's items in list order. */
export function riderItems(r: Pick<Rider, 'items'> | null | undefined): RiderItem[] {
  return Object.values(r?.items ?? {}).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

/**
 * Pasted rider text → new items, one per line. Bullets ("- ", "• ") and list numbers ("1.", "2)")
 * are stripped; quantities like "12 × water" are kept.
 * Items are numbered after the existing ones.
 */
export function parseRiderLines(text: string, dept: Id | null, startOrder = 0): Record<Id, RiderItem> {
  const lines = text.split('\n').map(s => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean)
  return Object.fromEntries(lines.map((t, i) => {
    const id = rid()
    return [id, { id, text: t, dept, status: 'requested' as const, order: startOrder + i }]
  }))
}

/** Next free position after the existing items. */
export function nextOrder(r: Pick<Rider, 'items'> | null | undefined): number {
  return riderItems(r).reduce((m, i) => Math.max(m, i.order + 1), 0)
}

/** Items settled (sourced or declined) out of the total. */
export function riderProgress(r: Pick<Rider, 'items'> | null | undefined): { done: number; total: number } {
  const items = riderItems(r)
  return { done: items.filter(i => i.status === 'sourced' || i.status === 'declined').length, total: items.length }
}

/** Items still being worked on (requested or agreed). */
export function openItems(r: Pick<Rider, 'items'> | null | undefined): number {
  return riderItems(r).filter(i => i.status === 'requested' || i.status === 'agreed').length
}
