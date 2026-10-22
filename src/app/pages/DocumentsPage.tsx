import { useState } from 'react'
import { useCollection } from '../../data/hooks'
import { relTime } from '../../lib/time'
import { personName } from '../../shared/people'
import { FILE_CATEGORIES, TAPE } from '../../types/constants'
import type { FileDoc, Id } from '../../types/model'
import { fileUrl } from '../backend'
import { DocumentForm } from '../documents/DocumentForm'
import { Icon } from '../Icon'
import { useAccess, useNow } from '../session'

const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

/** Documents for the event (HQ), or for one stage and its acts. */
export function DocumentsPage({ sid }: { sid: Id | null }) {
  const a = useAccess()
  const files = useCollection('files')
  const artists = useCollection('artists')
  const stages = useCollection('stages')
  const members = useCollection('members')
  const people = useCollection('people')
  const now = useNow(60_000)
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<FileDoc | 'new' | null>(null)

  const stageOf = (f: FileDoc) => f.stage ?? (f.artist ? artists[f.artist]?.stage : null) ?? null
  const list = Object.values(files)
    .filter(f => (sid ? !stageOf(f) || stageOf(f) === sid : true))
    .filter(f => (!cat || f.category === cat) && (!q || `${f.name} ${f.notes ?? ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((x, y) => (y.at ?? 0) - (x.at ?? 0))
  const canAdd = a.canW('documents', sid) || a.stagesSorted().some(s => a.canW('documents', s.id))
  const scopeLabel = (f: FileDoc) => {
    if (f.artist) return artists[f.artist]?.name ?? 'Removed'
    const st = f.stage ? stages[f.stage] : null
    return st ? st.name : 'Whole event'
  }

  return (
    <>
      <div className="head">
        <div><h1>Documents</h1><p>Site plans, safety documents, contracts and technical files{sid ? ' for this stage, its acts and the whole event' : ''}. People see the ones for the stages they work on.</p></div>
        {canAdd && <div className="actions"><button type="button" className="btn primary" onClick={() => setEditing('new')}>+ Add document</button></div>}
      </div>
      <div className="filters">
        <input type="search" placeholder="Search" aria-label="Search documents" value={q} onChange={e => setQ(e.target.value)} />
        <select aria-label="Category" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">All categories</option>
          {FILE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="small muted">{list.length} {list.length === 1 ? 'document' : 'documents'}</span>
      </div>
      <section className="panel">
        <ul className="list docs">
          {list.map(f => {
            const st = stageOf(f) ? stages[stageOf(f)!] : null
            const href = f.url || (f.blob ? fileUrl(f.blob.key) : undefined)
            return (
              <li key={f.id}>
                <span className="doc-icon"><Icon name={f.url ? 'link' : 'file'} /></span>
                <div className="stack" style={{ minWidth: 0 }}>
                  <a href={href} target="_blank" rel="noopener noreferrer" download={f.blob && !f.url ? f.name : undefined}><b>{f.name}</b></a>
                  <span className="small muted">
                    <span className="chip">{f.category}</span>{' '}
                    {st && <span className="tape" style={{ ['--c' as string]: TAPE[st.tape], width: 10 }} />} {scopeLabel(f)}
                    {f.blob ? ` · ${fmtSize(f.blob.size)}` : ' · link'}
                    {f.at ? ` · ${personName(f.by, members, people)}, ${relTime(f.at, now)}` : ''}
                  </span>
                  {f.notes && <span className="small">{f.notes}</span>}
                </div>
                {a.canW('documents', stageOf(f)) && <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing(f)}>Edit</button>}
              </li>
            )
          })}
          {!list.length && <li className="muted">No documents{cat || q ? ' match' : ' yet'}.</li>}
        </ul>
      </section>
      {editing && <DocumentForm doc={editing === 'new' ? null : editing} sid={sid} onClose={() => setEditing(null)} />}
    </>
  )
}
