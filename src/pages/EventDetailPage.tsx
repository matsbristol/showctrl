import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'

interface Stage {
  id: string
  name: string
  status: string
}

export default function EventDetailPage() {
  const { eventId } = useParams()
  const [stages] = useState<Stage[]>([
    { id: '1', name: 'Main Stage', status: 'ready' },
    { id: '2', name: 'Secondary Stage', status: 'setup' },
    { id: '3', name: 'DJ Booth', status: 'ready' },
  ])

  const [masterTime] = useState('14:32:15')

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link to="/" className="breadcrumb">← Events</Link>
          <h1>Summer Festival 2026</h1>
          <p className="page-subtitle">4 stages • 32 artists</p>
        </div>
      </div>

      <div className="event-dashboard">
        <div className="dashboard-grid">
          {/* Master Clock */}
          <div className="dashboard-card master-clock">
            <div className="card-header">
              <h3>Master Clock</h3>
              <div className="status-indicator live"></div>
            </div>
            <div className="clock-display">{masterTime}</div>
            <p className="card-meta">All departments synchronized</p>
          </div>

          {/* Show Status */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>Show Status</h3>
            </div>
            <div className="status-rows">
              <div className="status-row">
                <span>Status</span>
                <span className="status-badge">In Progress</span>
              </div>
              <div className="status-row">
                <span>On Time</span>
                <span className="status-value">+2m</span>
              </div>
              <div className="status-row">
                <span>Cues Pending</span>
                <span className="status-value">3</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="action-buttons">
              <button className="btn btn-secondary">Start Show</button>
              <button className="btn btn-secondary">Edit Timeline</button>
              <button className="btn btn-secondary">Add Delay</button>
            </div>
          </div>
        </div>

        {/* Stages Section */}
        <div className="section">
          <h2>Stages</h2>
          <div className="stages-grid">
            {stages.map((stage) => (
              <div key={stage.id} className="stage-card">
                <div className="stage-header">
                  <h4>{stage.name}</h4>
                  <span className="stage-status">{stage.status}</span>
                </div>
                <div className="stage-content">
                  <div className="stage-info">
                    <div className="info-row">
                      <span>Next Artist</span>
                      <span>TBA</span>
                    </div>
                    <div className="info-row">
                      <span>Start Time</span>
                      <span>--:--</span>
                    </div>
                  </div>
                  <Link
                    to={`/events/${eventId}/stages/${stage.id}`}
                    className="btn btn-secondary"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
