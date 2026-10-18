import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useStore } from '../../data/hooks'
import { homePath } from '../../shared/views'
import { useAccess, useTerms } from '../session'
import { useServerTime } from '../time'
import { Field, FormDialog } from '../ui/Dialog'

export function NoAccess({ message }: { message?: string }) {
  const a = useAccess()
  const store = useStore()
  const requests = useCollection('requests')
  const [asking, setAsking] = useState(false)
  const nothing = a.hasNoAccess()
  const requested = !!(a.me && requests[a.me])
  return (
    <div className="setup">
      <div className="panel">
        <h2>{message ?? (nothing ? "You don't have access yet" : 'Your access does not include this page')}</h2>
        <p className="muted" style={{ margin: '.5rem 0 1rem' }}>
          {nothing ? 'Ask the festival admin or your stage manager to add you.' : 'Ask the festival admin if you need it.'}
        </p>
        {nothing && requested && <p className="chip sb">Request sent</p>}
        {nothing && !requested && store.mode === 'live' && <button type="button" className="btn primary" onClick={() => setAsking(true)}>Ask for access</button>}
        {!nothing && <Link className="btn primary" to={homePath(a)}>Go to my start page</Link>}
      </div>
      {asking && <RequestForm onClose={() => setAsking(false)} />}
    </div>
  )
}

/** Someone without access asks to join; stage managers and admins see the request. */
function RequestForm({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const a = useAccess()
  const t = useTerms()
  const now = useServerTime()
  const [note, setNote] = useState('')
  const [stage, setStage] = useState('')
  return (
    <FormDialog
      title="Ask for access"
      saveLabel="Send request"
      onClose={onClose}
      onSave={async () => {
        if (!a.me) return 'You need to be signed in.'
        await store.set('requests', a.me, { at: now(), note: note.trim(), stage: stage || null })
      }}
    >
      <Field label="Your job title" full><input value={note} placeholder="e.g. Backline tech" onChange={e => setNote(e.target.value)} /></Field>
      <Field label={`Which ${t.stage.toLowerCase()} do you work on?`} full>
        <select value={stage} onChange={e => setStage(e.target.value)}>
          <option value="">Festival-wide / not sure</option>
          {a.stagesSorted().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
    </FormDialog>
  )
}
