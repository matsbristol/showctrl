import { Link, useLocation } from 'react-router-dom'

export default function Sidebar() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path ? 'active' : ''

  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <Link to="/" className={`sidebar-link ${isActive('/')}`}>
            <span className="sidebar-icon">∷</span>
            Events
          </Link>
          <Link to="/stage-manager" className={`sidebar-link ${isActive('/stage-manager')}`}>
            <span className="sidebar-icon">▶</span>
            Stage Manager
          </Link>
          <Link to="/clocks" className={`sidebar-link ${isActive('/clocks')}`}>
            <span className="sidebar-icon">◐</span>
            Master Clock
          </Link>
          <Link to="/runofshow" className="sidebar-link">
            <span className="sidebar-icon">≡</span>
            Run-of-Show
          </Link>
          <Link to="/stages" className="sidebar-link">
            <span className="sidebar-icon">⊡</span>
            Stages
          </Link>
          <Link to="/performers" className="sidebar-link">
            <span className="sidebar-icon">♫</span>
            Performers
          </Link>
          <Link to="/cues" className="sidebar-link">
            <span className="sidebar-icon">✦</span>
            Cues
          </Link>
        </div>
        <div className="sidebar-section sidebar-section-admin">
          <Link to="/admin/settings" className={`sidebar-link ${isActive('/admin/settings')}`}>
            <span className="sidebar-icon">⚙️</span>
            Settings
          </Link>
        </div>
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">U</div>
          <div className="sidebar-userinfo">
            <div className="sidebar-username">User</div>
            <div className="sidebar-org">Organization</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
