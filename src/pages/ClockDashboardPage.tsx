import { useState } from 'react'
import MasterClock from '../components/MasterClock'
import OperationalClocks from '../components/OperationalClocks'
import { useClock } from '../context/ClockContext'

type DashboardRole = 'production-manager' | 'show-runner' | 'stage-manager' | 'venue-manager'

export default function ClockDashboardPage() {
  const [role, setRole] = useState<DashboardRole>('production-manager')
  const { phases } = useClock()

  const dashboardConfigs: Record<DashboardRole, { title: string; description: string }> = {
    'production-manager': {
      title: 'Production Manager',
      description: 'Overview of all operational phases and show status',
    },
    'show-runner': {
      title: 'Show Runner',
      description: 'Detailed operational timeline with cue tracking',
    },
    'stage-manager': {
      title: 'Stage Manager',
      description: 'Master clock and stage-specific operations',
    },
    'venue-manager': {
      title: 'Venue Manager',
      description: 'Get-in, load-out, and facility operations',
    },
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Clock Dashboard</h1>
          <p className="page-subtitle">Real-time operational monitoring</p>
        </div>
      </div>

      {/* Role Selector */}
      <div className="role-selector">
        {(Object.keys(dashboardConfigs) as DashboardRole[]).map((r) => (
          <button
            key={r}
            className={`role-button ${role === r ? 'active' : ''}`}
            onClick={() => setRole(r)}
          >
            {dashboardConfigs[r].title}
          </button>
        ))}
      </div>

      <div className="dashboard-description">
        <p>{dashboardConfigs[role].description}</p>
      </div>

      {/* Dashboard Content */}
      <div className="clock-dashboard">
        {/* Primary: Master Clock */}
        <div className="dashboard-section featured">
          <MasterClock />
        </div>

        {/* Secondary: Operational Phases */}
        <div className="dashboard-section">
          <OperationalClocks />
        </div>

        {/* Phase Details */}
        <div className="dashboard-section">
          <h3 className="section-title">Phase Details</h3>
          <div className="phases-list">
            {phases.map((phase) => (
              <div key={phase.id} className="phase-detail-card">
                <div className="phase-detail-header">
                  <h4>{phase.name}</h4>
                  <span className="phase-detail-time">
                    {new Date(phase.scheduledTime).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
