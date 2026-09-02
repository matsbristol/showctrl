import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-logo">SHOWCTRL</div>
        <nav className="landing-nav">
          <a href="#features">Features</a>
          <a href="#impact">Impact</a>
          <a href="#users">For Teams</a>
          <Link to="/events" className="landing-cta-nav">Launch App</Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1>Keep the show on time. Keep the team aligned.</h1>
          <p className="landing-subtitle">The stage execution platform for live events</p>
          <p className="landing-description">Master clock. Run-of-show planning. Cue control. Performer timing. Delay management. Department coordination.</p>
          <div className="landing-cta-group">
            <Link to="/events" className="cta cta-primary">Launch App</Link>
            <button className="cta cta-secondary">Learn More</button>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="metric-card">
            <div className="metric-label">Status</div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="status-indicator status-live"></span>
              <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>Live</span>
            </div>
            <div className="metric-desc">Show execution active.</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Master Clock</div>
            <div className="metric-value">14:32</div>
            <div className="metric-desc">Single source of truth.</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Cues Pending</div>
            <div className="metric-value">3</div>
            <div className="metric-desc">Next cues queued.</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Time Shift</div>
            <div className="metric-value">+2m</div>
            <div className="metric-desc">Show running behind.</div>
          </div>
        </div>
      </section>

      <section id="features" className="landing-section">
        <h2>Built for stage operations</h2>
        <p className="landing-section-desc">Everything you need to coordinate a live show.</p>
        <div className="landing-features-grid">
          <div className="feature-card">
            <div className="feature-icon">⏱️</div>
            <h3>Master Show Clock</h3>
            <p>Single source of truth. All departments synchronized to the second.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">◷</div>
            <h3>Run-of-Show</h3>
            <p>Timeline-based planning with clear cues, transitions, and ownership.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">◆</div>
            <h3>Cue Management</h3>
            <p>Track every cue in real time. Pending, live, complete, or delayed.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">♫</div>
            <h3>Performer Timing</h3>
            <p>Call windows and readiness tracking for artists and talent.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">!</div>
            <h3>Delay Logging</h3>
            <p>Track delays and see impact across your timeline.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">∴</div>
            <h3>Department Views</h3>
            <p>Role-based dashboards for every team member.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <p>&copy; 2026 SHOWCTRL. The stage execution platform for live events.</p>
      </footer>
    </div>
  )
}
