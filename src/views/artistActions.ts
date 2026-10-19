/*
 * Adding and editing artists and their contacts. Callers decide who sees
 * the buttons: canW('artists', stage), and contact details only for
 * viewers who may see them (canSeeContacts).
 */
import { useNavigate } from 'react-router-dom'
import { sortStages } from '../access/access'
import { removeContact, upsertContact } from '../domain/artists'
import { ARTIST_STATUS, CONTACT_ROLES, MIN, TIME_ZONES } from '../domain/constants'
import { buildDaySheet, itemsForArtist, rid } from '../domain/runsheet'
import { useSnapshot, useStore } from '../data/hooks'
import { useAccess } from '../session/hooks'
import { ctxPath, type Ctx } from '../shell/nav'
import type { Artist, ArtistContact, ArtistStatus } from '../types/model'
import { useForm, useToast } from '../ui/hooks'
import { useEvent } from './hooks'

export function useArtistActions(ctx: Ctx) {
  const store = useStore()
  const snap = useSnapshot()
  const access = useAccess()
  const openForm = useForm()
  const toast = useToast()
  const navigate = useNavigate()
  const { T } = useEvent()
  const performer = T.performer.toLowerCase()

  /**
   * Add (no artist) or edit. A new artist can also get a tour manager and a
   * full day sheet in the same step, as in the prototype.
   */
  function editArtist(a?: Artist) {
    const isNew = !a
    // You can move an artist only between stages you can edit (or keep its current one).
    const stages = sortStages(Object.values(snap.col.stages)).filter(s => access.canW('artists', s.id) || s.id === a?.stage)
    const defaultStage = ctx !== 'hq' ? ctx : stages.find(s => access.canW('artists', s.id))?.id
    openForm({
      title: isNew ? `Add ${performer}` : `Edit ${a.name}`,
      fields: [
        { k: 'name', label: 'Name', full: true },
        { k: 'stage', label: T.stage, type: 'select', options: stages.map(s => [s.id, s.name]) },
        { k: 'status', label: 'Status', type: 'select', options: ARTIST_STATUS.map(s => [s, s]) },
        { k: 'genre', label: 'Genre / description' },
        { k: 'party', label: 'Travelling party (people)', type: 'number' },
        { k: 'home', label: 'Home time zone', type: 'select', options: [['', '—'], ...TIME_ZONES.map(z => [z, z] as [string, string])] },
        { k: 'vehicles', label: 'Vehicles at dock', placeholder: 'e.g. 1 truck, 1 sleeper bus' },
        ...(isNew ? [
          { k: 'cname', label: 'Tour manager name' },
          { k: 'cphone', label: 'Tour manager phone' },
          { k: 'cemail', label: 'Tour manager email', full: true },
          { k: 'start', label: 'On stage (creates a day sheet)', type: 'datetime' as const },
          { k: 'len', label: 'Show length (minutes)', type: 'number' as const },
          { k: 'sc', label: 'Soundcheck (optional)', type: 'datetime' as const },
        ] : []),
        { k: 'notes', label: 'Production notes', type: 'textarea', full: true },
      ],
      values: {
        name: a?.name ?? '', stage: a?.stage ?? defaultStage ?? '', status: a?.status ?? 'confirmed',
        genre: a?.genre ?? '', party: a?.party == null ? '' : String(a.party), home: a?.home ?? '',
        vehicles: a?.vehicles ?? '', notes: a?.notes ?? '',
        cname: '', cphone: '', cemail: '', start: null, len: '60', sc: null,
      },
      onSave: async v => {
        const name = (v.name as string).trim()
        if (!name) return 'Enter a name.'
        const id = a?.id ?? rid()
        const doc: Omit<Artist, 'id'> = {
          ...a,
          name,
          stage: (v.stage as string) || undefined,
          status: v.status as ArtistStatus,
          genre: v.genre as string,
          party: v.party === '' ? undefined : Number(v.party),
          home: (v.home as string) || undefined,
          vehicles: v.vehicles as string,
          notes: v.notes as string,
          contacts: a?.contacts ?? [],
        }
        if (isNew && (v.cname || v.cphone || v.cemail)) {
          doc.contacts = [{ id: rid(), role: 'Tour manager', name: (v.cname as string) || 'Tour manager', phone: v.cphone as string, email: v.cemail as string }]
        }
        await store.set('artists', id, doc)
        const stage = doc.stage ? snap.col.stages[doc.stage] : undefined
        if (isNew && v.start && stage) {
          const start = v.start as number
          await store.setMany('ros', buildDaySheet(stage, { id, ...doc }, start, start + (Number(v.len) || 60) * MIN, (v.sc as number | null) || null))
        }
        if (isNew) navigate(ctxPath(ctx, 'artist', id))
      },
      // Deleting an artist also removes their run sheet items. Leave their
      // page first: once they're gone it unmounts, and a navigate() from an
      // unmounted page is ignored.
      onDelete: a ? async () => {
        navigate(ctxPath(ctx, 'artists'))
        for (const x of itemsForArtist(snap.col.ros, a.id)) await store.delete('ros', x.id)
        await store.delete('artists', a.id)
        toast(`${a.name} and their day sheet were deleted.`)
      } : undefined,
    })
  }

  function editContact(a: Artist, c?: ArtistContact) {
    openForm({
      title: c ? 'Edit contact' : `Add contact · ${a.name}`,
      fields: [
        { k: 'role', label: 'Role', type: 'select', options: CONTACT_ROLES.map(r => [r, r]) },
        { k: 'name', label: 'Name' },
        { k: 'phone', label: 'Phone' },
        { k: 'email', label: 'Email' },
        { k: 'note', label: 'Note', full: true },
      ],
      values: { role: c?.role ?? 'Tour manager', name: c?.name ?? '', phone: c?.phone ?? '', email: c?.email ?? '', note: c?.note ?? '' },
      onSave: async v => {
        if (!(v.name as string).trim() && !(v.phone as string).trim()) return 'Enter at least a name or phone number.'
        const contact: ArtistContact = { id: c?.id ?? rid(), role: v.role as string, name: (v.name as string).trim(), phone: v.phone as string, email: v.email as string, note: v.note as string }
        // Read the latest list, so an edit doesn't undo a contact someone else just added.
        const latest = store.get('artists', a.id)?.contacts ?? []
        await store.update('artists', a.id, { contacts: upsertContact(latest, contact) })
      },
      onDelete: c ? async () => {
        await store.update('artists', a.id, { contacts: removeContact(store.get('artists', a.id)?.contacts ?? [], c.id) })
      } : undefined,
    })
  }

  const setStatus = (a: Artist, status: ArtistStatus) => store.update('artists', a.id, { status })

  return { editArtist, editContact, setStatus }
}
