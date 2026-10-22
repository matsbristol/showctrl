import { useState } from 'react'
import { useCollection, useStore } from '../../data/hooks'
import { rid } from '../../lib/id'
import { FILE_CATEGORIES } from '../../types/constants'
import type { FileDoc, Id } from '../../types/model'
import { uploadFile } from '../backend'
import { useAccess, useTerms } from '../session'
import { useServerTime } from '../time'
import { Field, FormDialog } from '../ui/Dialog'

/** Demo mode keeps files in the browser, so they have to stay small. */
const DEMO_MAX = 1_000_000

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read the file.'))
    r.readAsDataURL(file)
  })
}

/** Add a document (upload or link) to the event, a stage or one act. Editing changes name, category and notes. */
export function DocumentForm({ doc, sid, onClose }: { doc: FileDoc | null; sid: Id | null; onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const t = useTerms()
  const now = useServerTime()
  const artists = useCollection('artists')
  const d = doc
  const scopes: [string, string][] = [
    ...(a.canW('documents') ? [['event', 'Whole event'] as [string, string]] : []),
    ...a.stagesSorted().filter(s => a.canW('documents', s.id)).map(s => [`stage:${s.id}`, s.name] as [string, string]),
    ...Object.values(artists).filter(x => a.canW('documents', x.stage) && (!sid || x.stage === sid)).sort((p, q) => p.name.localeCompare(q.name)).map(x => [`artist:${x.id}`, x.name] as [string, string]),
  ]
  const initialScope = d ? (d.artist ? `artist:${d.artist}` : d.stage ? `stage:${d.stage}` : 'event') : sid ? `stage:${sid}` : scopes[0]?.[0] ?? 'event'
  const [v, setV] = useState({ name: d?.name ?? '', category: d?.category ?? 'Other', scope: initialScope, url: d?.url ?? '', notes: d?.notes ?? '' })
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'upload' | 'link'>(d?.url ? 'link' : 'upload')
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV(o => ({ ...o, [k]: x }))
  const [kind, id] = v.scope.split(':')
  const scope = { stage: kind === 'stage' ? id : null, artist: kind === 'artist' ? id : null }

  return (
    <FormDialog
      title={d ? `Edit ${d.name}` : 'Add document'}
      saveLabel={d ? 'Save' : mode === 'upload' ? 'Upload' : 'Add link'}
      onClose={onClose}
      onDelete={d ? () => store.delete('files', d.id) : undefined}
      onSave={async () => {
        const name = v.name.trim() || file?.name || ''
        if (!name) return 'Give it a name.'
        let blob = d?.blob
        let url = mode === 'link' ? v.url.trim() : undefined
        if (!d && mode === 'upload') {
          if (!file) return 'Choose a file.'
          if (store.mode === 'live') blob = await uploadFile(file, scope)
          else {
            if (file.size > DEMO_MAX) return 'In demo mode files can be up to 1 MB. Use a link, or the live version.'
            blob = { key: await readAsDataUrl(file), size: file.size, type: file.type || 'application/octet-stream' }
          }
        }
        if (mode === 'link' && !/^https?:\/\//i.test(url ?? '')) return 'Links must start with https:// or http://.'
        if (mode === 'upload') url = undefined
        await store.set('files', d?.id ?? rid(), {
          name, category: v.category, ...scope, ...(url ? { url } : {}), ...(blob ? { blob } : {}),
          by: d?.by ?? a.me, at: d?.at ?? now(), notes: v.notes,
        })
      }}
    >
      {!d && (
        <div className="fld full">
          <div className="seg" role="group" aria-label="Kind">
            <button type="button" aria-pressed={mode === 'upload'} onClick={() => setMode('upload')}>Upload a file</button>
            <button type="button" aria-pressed={mode === 'link'} onClick={() => setMode('link')}>Add a link</button>
          </div>
        </div>
      )}
      {!d && mode === 'upload' && <Field label="File" full><input type="file" onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !v.name) set('name', f.name.replace(/\.[^.]+$/, '')) }} /></Field>}
      {mode === 'link' && <Field label="Link" full><input type="url" value={v.url} placeholder="https://" onChange={e => set('url', e.target.value)} /></Field>}
      <Field label="Name" full><input value={v.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label="Category">
        <select value={v.category} onChange={e => set('category', e.target.value)}>
          {FILE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label={`For (event, ${t.stage.toLowerCase()} or ${t.performer.toLowerCase()})`}>
        <select value={v.scope} onChange={e => set('scope', e.target.value)} disabled={!!d?.blob}>
          {scopes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Notes" full><input value={v.notes} onChange={e => set('notes', e.target.value)} /></Field>
    </FormDialog>
  )
}
