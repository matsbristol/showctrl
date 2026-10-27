// Comm channels: which ones a stage uses, in the order people look for them.

import type { CommChannel, Id } from '../types/model'

/** Festival-wide channels first, then by the order set on the page, then by name. */
export const byOrder = (x: CommChannel, y: CommChannel) =>
  (x.stage ? 1 : 0) - (y.stage ? 1 : 0) || x.order - y.order || x.name.localeCompare(y.name)

/** What a stage's crew needs: its own channels and the festival-wide ones. */
export function commsFor(comms: Readonly<Record<Id, CommChannel>>, sid: Id): CommChannel[] {
  return Object.values(comms).filter(c => !c.stage || c.stage === sid).sort(byOrder)
}
