import { useState } from 'react'
import { useCollection, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { aOrAn } from '../../lib/text'
import { TRANSFER_STATUS } from '../../types/constants'
import type { Transfer, TransferStatus } from '../../types/model'
import { useTerms } from '../session'
import { DateTimeInput, Field, FormDialog } from '../ui/Dialog'
import { tr } from '../../i18n'

export function TransferForm({ transfer, draft, onClose }: { transfer: Transfer | null; draft?: Partial<Transfer>; onClose: () => void }) {
  const store = useStore()
  const t = useTerms()
  const artists = useCollection('artists')
  const x = { ...draft, ...transfer }
  const [v, setV] = useState({
    artist: x.artist ?? '', guest: x.guest ?? '', pax: String(x.pax ?? 1), from: x.from ?? '', to: x.to ?? '',
    at: x.at ?? null as number | null, vehicle: x.vehicle ?? '', driver: x.driver ?? '', phone: x.phone ?? '',
    status: (x.status ?? 'planned') as TransferStatus, notes: x.notes ?? '',
  })
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV(o => ({ ...o, [k]: val }))
  return (
    <FormDialog
      title={transfer ? tr('Edit transfer') : tr('Add transfer')}
      onClose={onClose}
      onDelete={transfer ? () => store.delete('transfers', transfer.id) : undefined}
      onSave={async () => {
        if (!v.artist && !v.guest.trim()) return tr('Choose {aPerformer} or name who it’s for.', { aPerformer: aOrAn(t.performer.toLowerCase()), performer: t.performer.toLowerCase() })
        if (!v.at) return tr('Set the pickup time.')
        if (!v.from.trim() || !v.to.trim()) return tr('Fill in from and to.')
        await store.set('transfers', transfer?.id ?? rid(), {
          artist: v.artist || null, ...(v.artist ? {} : { guest: v.guest.trim() }), pax: Math.max(1, Number(v.pax) || 1),
          from: v.from.trim(), to: v.to.trim(), at: v.at, vehicle: v.vehicle, driver: v.driver, phone: v.phone, status: v.status,
          item: x.item ?? null, notes: v.notes,
        })
      }}
    >
      <Field label={t.performer}>
        <select value={v.artist} onChange={e => set('artist', e.target.value)}>
          <option value="">{tr('Not {aPerformer}', { aPerformer: aOrAn(t.performer.toLowerCase()), performer: t.performer.toLowerCase() })}</option>
          {Object.values(artists).sort((p, q) => p.name.localeCompare(q.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label={tr('Who')} hidden={!!v.artist}><input value={v.guest} placeholder={tr('e.g. Press, Catering crew')} onChange={e => set('guest', e.target.value)} /></Field>
      <Field label={tr('People')}><input type="number" min={1} value={v.pax} onChange={e => set('pax', e.target.value)} /></Field>
      <Field label={tr('Pickup')}><DateTimeInput value={v.at} onChange={val => set('at', val)} /></Field>
      <Field label={tr('From')}><input value={v.from} placeholder={tr('e.g. Airport arrivals, Fjordhotellet')} onChange={e => set('from', e.target.value)} /></Field>
      <Field label={tr('To')}><input value={v.to} placeholder={tr('e.g. Artist gate')} onChange={e => set('to', e.target.value)} /></Field>
      <Field label={tr('Vehicle')}><input value={v.vehicle} placeholder={tr('e.g. Van 2, Sprinter')} onChange={e => set('vehicle', e.target.value)} /></Field>
      <Field label={tr('Driver')}><input value={v.driver} onChange={e => set('driver', e.target.value)} /></Field>
      <Field label={tr('Driver phone')}><input value={v.phone} onChange={e => set('phone', e.target.value)} /></Field>
      <Field label={tr('Status')}>
        <select value={v.status} onChange={e => set('status', e.target.value as TransferStatus)}>
          {TRANSFER_STATUS.map(s => <option key={s} value={s}>{tr(s)}</option>)}
        </select>
      </Field>
      <Field label={tr('Notes')} full><textarea value={v.notes} placeholder={tr('Flight number, luggage, meeting point…')} onChange={e => set('notes', e.target.value)} /></Field>
    </FormDialog>
  )
}
