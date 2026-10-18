import { useState } from 'react'
import { useCollection, useStore } from '../../data/hooks'
import { buildDaySheet } from '../../lib/daySheet'
import { rid } from '../../lib/id'
import { ARTIST_STATUS, CONTACT_ROLES, MIN, TZS } from '../../types/constants'
import type { Artist, ArtistContact, ArtistStatus, Id } from '../../types/model'
import { useAccess, useTerms } from '../session'
import { DateTimeInput, Field, FormDialog } from '../ui/Dialog'

/** Add or edit a performer. A new one can get a tour manager contact and a day sheet straight away. */
export function ArtistForm({ artist, sid, onClose, onCreated, onDeleted }: {
  artist: Artist | null
  sid: Id | null
  onClose: () => void
  onCreated?: (id: Id) => void
  onDeleted?: () => void
}) {
  const store = useStore()
  const a = useAccess()
  const t = useTerms()
  const stages = useCollection('stages')
  const isNew = !artist
  const stageOpts = a.stagesSorted().filter(s => a.canW('artists', s.id) || s.id === artist?.stage)
  const [v, setV] = useState({
    name: artist?.name ?? '',
    stage: artist?.stage ?? sid ?? stageOpts[0]?.id ?? '',
    status: (artist?.status ?? 'confirmed') as ArtistStatus,
    genre: artist?.genre ?? '',
    party: artist?.party == null ? '' : String(artist.party),
    home: artist?.home ?? '',
    vehicles: artist?.vehicles ?? '',
    notes: artist?.notes ?? '',
    cname: '', cphone: '', cemail: '',
    start: null as number | null, len: '60', sc: null as number | null,
  })
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))

  return (
    <FormDialog
      title={isNew ? `Add ${t.performer.toLowerCase()}` : `Edit ${artist.name}`}
      onClose={onClose}
      onDelete={artist ? async () => {
        const items = Object.values(store.peek('ros') ?? {}).filter(i => i.artist === artist.id)
        await Promise.all(items.map(i => store.delete('ros', i.id)))
        await store.delete('artists', artist.id)
        onDeleted?.()
      } : undefined}
      onSave={async () => {
        if (!v.name.trim()) return 'Enter a name.'
        if (!v.stage) return `Choose a ${t.stage.toLowerCase()}.`
        const id = artist?.id ?? rid()
        const contacts: ArtistContact[] = artist?.contacts
          ?? (v.cname || v.cphone || v.cemail ? [{ id: rid(), role: 'Tour manager', name: v.cname || 'Tour manager', phone: v.cphone, email: v.cemail }] : [])
        await store.set('artists', id, {
          ...artist, name: v.name.trim(), stage: v.stage, status: v.status, genre: v.genre,
          party: v.party === '' ? null : Number(v.party), home: v.home, vehicles: v.vehicles, notes: v.notes, contacts,
        })
        if (isNew && v.start) {
          await store.setMany('ros', buildDaySheet(stages[v.stage], { id, name: v.name.trim() }, v.start, v.start + (Number(v.len) || 60) * MIN, v.sc))
        }
        if (isNew) onCreated?.(id)
      }}
    >
      <Field label="Name" full><input value={v.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label={t.stage}>
        <select value={v.stage} onChange={e => set('stage', e.target.value)}>
          {stageOpts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select value={v.status} onChange={e => set('status', e.target.value as ArtistStatus)}>
          {ARTIST_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Genre / description"><input value={v.genre} onChange={e => set('genre', e.target.value)} /></Field>
      <Field label="Travelling party (people)"><input type="number" value={v.party} onChange={e => set('party', e.target.value)} /></Field>
      <Field label="Home time zone">
        <select value={v.home} onChange={e => set('home', e.target.value)}>
          <option value="">—</option>
          {TZS.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
      </Field>
      <Field label="Vehicles at dock"><input value={v.vehicles} placeholder="e.g. 1 truck, 1 sleeper bus" onChange={e => set('vehicles', e.target.value)} /></Field>
      {isNew && <>
        <Field label="Tour manager name"><input value={v.cname} onChange={e => set('cname', e.target.value)} /></Field>
        <Field label="Tour manager phone"><input value={v.cphone} onChange={e => set('cphone', e.target.value)} /></Field>
        <Field label="Tour manager email" full><input value={v.cemail} onChange={e => set('cemail', e.target.value)} /></Field>
        <Field label="On stage (creates a day sheet)"><DateTimeInput value={v.start} onChange={x => set('start', x)} /></Field>
        <Field label="Show length (minutes)"><input type="number" value={v.len} onChange={e => set('len', e.target.value)} /></Field>
        <Field label="Soundcheck (optional)"><DateTimeInput value={v.sc} onChange={x => set('sc', x)} /></Field>
      </>}
      <Field label="Production notes" full><textarea value={v.notes} onChange={e => set('notes', e.target.value)} /></Field>
    </FormDialog>
  )
}

/** Add or edit one of a performer's contacts. */
export function ContactForm({ artist, contact, onClose }: { artist: Artist; contact: ArtistContact | null; onClose: () => void }) {
  const store = useStore()
  const [v, setV] = useState({
    role: contact?.role ?? 'Tour manager', name: contact?.name ?? '', phone: contact?.phone ?? '', email: contact?.email ?? '', note: contact?.note ?? '',
  })
  const set = <K extends keyof typeof v>(k: K, x: string) => setV(o => ({ ...o, [k]: x }))
  const roles: string[] = CONTACT_ROLES.includes(v.role as (typeof CONTACT_ROLES)[number]) ? [...CONTACT_ROLES] : [v.role, ...CONTACT_ROLES]
  return (
    <FormDialog
      title={contact ? 'Edit contact' : `Add contact · ${artist.name}`}
      onClose={onClose}
      onDelete={contact ? () => store.update('artists', artist.id, { contacts: artist.contacts.filter(c => c.id !== contact.id) }) : undefined}
      onSave={async () => {
        if (!v.name.trim() && !v.phone.trim()) return 'Enter at least a name or phone number.'
        const o: ArtistContact = { id: contact?.id ?? rid(), ...v, name: v.name.trim() }
        const list = contact ? artist.contacts.map(c => (c.id === contact.id ? o : c)) : [...artist.contacts, o]
        await store.update('artists', artist.id, { contacts: list })
      }}
    >
      <Field label="Role">
        <select value={v.role} onChange={e => set('role', e.target.value)}>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select>
      </Field>
      <Field label="Name"><input value={v.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="Phone"><input value={v.phone} onChange={e => set('phone', e.target.value)} /></Field>
      <Field label="Email"><input value={v.email} onChange={e => set('email', e.target.value)} /></Field>
      <Field label="Note" full><input value={v.note} onChange={e => set('note', e.target.value)} /></Field>
    </FormDialog>
  )
}
