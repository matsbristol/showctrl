import { useState } from 'react'
import { Link } from 'react-router-dom'

interface Event {
  id: string
  name: string
  date: string
  location: string
  stages: number
  artists: number
  status: 'draft' | 'scheduled' | 'live' | 'completed'
}

export default function EventsPage() {
  const [events] = useState<Event[]>([
    {
      id: '1',
      name: 'Summer Festival 2026',
      date: '2026-06-15',
      location: 'Central Park, NYC',
      stages: 4,
      artists: 32,
      status: 'scheduled',
    },
    {
      id: '2',
      name: 'Arena Concert - The Band',
      date: '2026-05-20',
      location: 'Madison Square Garden',
      stages: 1,
      artists: 3,
      status: 'draft',
    },
  ])

  const statusColors = {
    draft: '#9ca3af',
    scheduled: '#06b6d4',
    live: '#ef4444',
    completed: '#10b981',
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Events</h1>
          <p className="page-subtitle">Manage your shows and performances</p>
        </div>
        <button className="btn btn-primary">+ New Event</button>
      </div>

      <div className="events-grid">
        {events.map((event) => (
          <Link
            key={event.id}
            to={`/events/${event.id}`}
            className="event-card"
          >
            <div className="event-header">
              <h3>{event.name}</h3>
              <div
                className="event-status"
                style={{
                  background: statusColors[event.status],
                }}
              >
                {event.status}
              </div>
            </div>
            <div className="event-meta">
              <div className="event-date">{event.date}</div>
              <div className="event-location">{event.location}</div>
            </div>
            <div className="event-stats">
              <div className="stat">
                <span className="stat-label">Stages</span>
                <span className="stat-value">{event.stages}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Artists</span>
                <span className="stat-value">{event.artists}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
