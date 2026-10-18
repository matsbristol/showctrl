import { useNavigate } from 'react-router-dom'
import { useStore } from '../../data/hooks'
import { LocalStore } from '../../data/localStore'
import { buildSample } from '../../data/sample'
import { HQ_NAV } from '../nav'
import { useAccess, useSession } from '../session'
import { Placeholder } from './Placeholder'

/** Admin, for now: preview the app as another role, and reset the demo. */
export function AdminPage() {
  const a = useAccess()
  const store = useStore()
  const { preview, setPreview } = useSession()
  const navigate = useNavigate()
  const value = !preview ? '' : preview.type === 'role' ? `role:${preview.role}` : `stage:${preview.level}:${preview.sid}`

  return (
    <Placeholder meta={HQ_NAV.admin}>
      <section className="panel" style={{ marginBottom: '1rem' }}>
        <div className="ph"><h3>Preview</h3></div>
        <div className="pb">
          <label className="row small">
            Preview the app as{' '}
            <select
              className="inline-sel"
              value={value}
              onChange={e => {
                const v = e.target.value
                if (!v) setPreview(null)
                else if (v.startsWith('role:')) setPreview({ type: 'role', role: v.slice(5) })
                else { const [, level, sid] = v.split(':'); setPreview({ type: 'stage', level: level as 'manager' | 'crew', sid }) }
                navigate('/hq')
              }}
            >
              <option value="">—</option>
              <optgroup label="Festival roles">
                {Object.entries(a.roles).map(([k, r]) => <option key={k} value={`role:${k}`}>{r.label}</option>)}
              </optgroup>
              {a.stagesSorted().map(s => (
                <optgroup key={s.id} label={s.name}>
                  <option value={`stage:manager:${s.id}`}>Stage manager</option>
                  <option value={`stage:crew:${s.id}`}>Stage crew</option>
                </optgroup>
              ))}
            </select>
          </label>
        </div>
      </section>
      {store instanceof LocalStore && a.canW('admin') && (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="ph"><h3>Demo data</h3></div>
          <div className="pb row">
            <p className="muted small">The demo festival is saved in this browser only.</p>
            <button
              type="button"
              className="btn danger"
              style={{ marginLeft: 'auto' }}
              onClick={() => { if (confirm('Reset the demo festival? Your changes in this browser are lost.')) store.reset(buildSample()) }}
            >
              Reset demo
            </button>
          </div>
        </section>
      )}
    </Placeholder>
  )
}
