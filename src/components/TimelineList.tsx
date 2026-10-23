import { useRunOfShow, type TimelineItem } from '../context/RunOfShowContext'
import { usePerformersContext } from '../context/PerformersContext'
import { useStages } from '../context/StagesContext'

interface TimelineListProps {
  items: TimelineItem[]
  onEdit?: (item: TimelineItem) => void
}

export default function TimelineList({ items, onEdit }: TimelineListProps) {
  const { deleteTimelineItem } = useRunOfShow()
  const { getArtistName } = usePerformersContext()
  const { getStageName } = useStages()

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
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
      cue: '◆',
      transition: '→',
      'performer-entry': '♫',
      technical: '⚙',
      break: '‖',
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

  const getPrimaryDepartmentColor = (departments: string[]) => {
    return departments.length > 0 ? getDepartmentColor(departments[0]) : '#6b7280'
  }

  const totalDuration = items.length > 0
    ? items[items.length - 1].endTime || items[items.length - 1].startTime
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

            <div className="item-marker" style={{ borderLeftColor: getPrimaryDepartmentColor(item.departments) }}>
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
                {item.endTime && (
                  <div className="meta-row">
                    <span className="meta-label">End:</span>
                    <span className="meta-value">{formatTime(item.endTime)}</span>
                  </div>
                )}
                <div className="meta-row">
                  <span className="meta-label">Stage:</span>
                  <span className="meta-value">{getStageName(item.stage) || item.stage}</span>
                </div>
                {item.departments.length > 0 && (
                  <div className="meta-row">
                    <span className="meta-label">Depts:</span>
                    <div className="departments-list">
                      {item.departments.map((dept) => (
                        <span
                          key={dept}
                          className="meta-badge"
                          style={{ background: getDepartmentColor(dept) }}
                        >
                          {dept.replace('-', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {item.performers.length > 0 && (
                <div className="item-performers">
                  <strong>Artists:</strong> {item.performers.map((perfId) => getArtistName(perfId) || perfId).join(', ')}
                </div>
              )}
            </div>

            <div className="item-actions">
              {onEdit && (
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => onEdit(item)}
                >
                  Edit
                </button>
              )}
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
