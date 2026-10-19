/*
 * Rider edits. Each change is applied to the latest stored rider, not the
 * one the screen rendered, so an edit doesn't undo an item someone else
 * added a moment ago. (Truly simultaneous edits are still last-write-wins;
 * see the note in domain/riders.ts.)
 */
import { now } from '../clock/clock'
import { addRiderItems, changeRiderItem, parseRiderLines, removeRiderItem, riderId, RIDER_LABEL } from '../domain/riders'
import { useSnapshot, useStore } from '../data/hooks'
import type { Id, RiderItem, RiderKind } from '../types/model'
import { useForm } from '../ui/hooks'

export function useRiderActions() {
  const store = useStore()
  const snap = useSnapshot()
  const openForm = useForm()

  /** Paste a rider in, one item per line. Hospitality items default to the hospitality department. */
  function addItems(artist: Id, kind: RiderKind) {
    const name = snap.col.artists[artist]?.name ?? ''
    const depts = snap.cfg?.depts ?? []
    openForm({
      title: `Add ${RIDER_LABEL[kind].toLowerCase()} items · ${name}`,
      fields: [
        { k: 'lines', label: 'One item per line', type: 'textarea', full: true, placeholder: kind === 'tech' ? 'Drum riser 8×8 ft, 60 cm high\n4 × wedge monitors on separate mixes' : 'Hot meal for 8 (1 vegan)\n12 × still water' },
        { k: 'dept', label: 'Department', type: 'select', options: [['', 'Unassigned'], ...depts.map(d => [d.id, d.name] as [string, string])] },
      ],
      values: { lines: '', dept: kind === 'hosp' && depts.some(d => d.id === 'hosp') ? 'hosp' : '' },
      saveLabel: 'Add items',
      onSave: async v => {
        const lines = parseRiderLines(v.lines as string)
        if (!lines.length) return 'Add at least one line.'
        const latest = store.get('riders', riderId(artist, kind))
        await store.set('riders', riderId(artist, kind), addRiderItems(latest, artist, kind, lines, (v.dept as string) || undefined, now()))
      },
    })
  }

  async function changeItem(artist: Id, kind: RiderKind, itemId: Id, patch: Partial<Pick<RiderItem, 'dept' | 'status'>>) {
    const latest = store.get('riders', riderId(artist, kind))
    if (latest) await store.update('riders', latest.id, changeRiderItem(latest, itemId, patch, now()))
  }

  async function removeItem(artist: Id, kind: RiderKind, itemId: Id) {
    const latest = store.get('riders', riderId(artist, kind))
    if (latest) await store.update('riders', latest.id, removeRiderItem(latest, itemId, now()))
  }

  return { addItems, changeItem, removeItem }
}
