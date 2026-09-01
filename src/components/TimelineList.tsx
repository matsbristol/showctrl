import { useRunOfShow, type TimelineItem } from '../context/RunOfShowContext'

interface TimelineListProps {
  items: TimelineItem[]
}

export default function TimelineList({ items }: TimelineListProps) {
  const { deleteTimelineItem } = useRunOfShow()

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60

    if (minutes > 0) {
      return `${minutes}m ${secs}s`
    }
    return `${secs}s`
  }

  const getItemTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      cue: '🎯',
      transition: '↻',
      'performer-entry': '🎤',
      technical: '⚙️',
      break: '⏸️',
    }
    return icons[type] || '•'
  }

  const getDepartmentColor = (dept: string) => {
    const colors: Record<string, string> = {
      'stage-manager': '#06b6d4',
      'tech-lead': '#8b5cf6',
      lighting: '#ec4899',
      sound: '#f59e0b',
      video: '#14b8a6',
      stagehands: '#6366f1',
      security: '#ef4444',
      'talent-liaison': '#84cc16',
    }
    return colors[dept] || '#6b7280'
  }

  const totalDuration = items.length > 0
    ? items[items.length - 1].startTime + items[items.length - 1].duration
    : 0

  return (
    <div className="timeline-list">
      <div className="timeline-summary">
        <div className="summary-stat">
          <span className="summary-label">Items</span>
          <span className="summary-value">{items.length}</span>
        </div>
        <div className="summary-stat">
          <span className="summary-label">Duration</span>
          <span className="summary-value">{formatTime(totalDuration)}</span>
        </div>
      </div>

      <div className="timeline-items">
        {items.map((item, index) => (
          <div key={item.id} className="timeline-item">
            <div className="item-index">{index + 1}</div>

            <div className="item-marker" style={{ borderLeftColor: getDepartmentColor(item.department) }}>
              <div className="item-type-icon">{getItemTypeIcon(item.type)}</div>
            </div>

            <div className="item-content">
              <div className="item-header">
                <h4 className="item-name">{item.name}</h4>
                <span className="item-type">{item.type}</span>
              </div>

              {item.description && <p className="item-description">{item.description}</p>}

              <div className="item-meta">
                <div className="meta-row">
                  <span className="meta-label">Start:</span>
                  <span className="meta-value">{formatTime(item.startTime)}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Duration:</span>
                  <span className="meta-value">{formatDuration(item.duration)}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Department:</span>
                  <span
                    className="meta-badge"
                    style={{ background: getDepartmentColor(item.department) }}
                  >
                    {item.department}
                  </span>
                </div>
              </div>

              {item.performers.length > 0 && (
                <div className="item-performers">
                  <strong>Performers:</strong> {item.performers.join(', ')}
                </div>
              )}

              {item.notes && <div className="item-notes">📝 {item.notes}</div>}
            </div>

            <div className="item-actions">
              <button
                className="btn btn-secondary btn-small"
                onClick={() => deleteTimelineItem(item.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
