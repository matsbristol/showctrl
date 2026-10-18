import { Link } from 'react-router-dom'
import { homePath } from '../../shared/views'
import { useAccess } from '../session'

export function NoAccess({ message }: { message?: string }) {
  const a = useAccess()
  const nothing = a.hasNoAccess()
  return (
    <div className="setup">
      <div className="panel">
        <h2>{message ?? (nothing ? "You don't have access yet" : 'Your access does not include this page')}</h2>
        <p className="muted" style={{ margin: '.5rem 0 1rem' }}>
          {nothing ? 'Ask the festival admin or your stage manager to add you.' : 'Ask the festival admin if you need it.'}
        </p>
        {/* Asking for access needs live sign-in (step 2b). */}
        {!nothing && <Link className="btn primary" to={homePath(a)}>Go to my start page</Link>}
      </div>
    </div>
  )
}
