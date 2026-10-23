import { useRunOfShow } from '../context/RunOfShowContext'
import { usePerformerReadiness } from '../context/PerformerReadinessContext'
import { usePerformersContext } from '../context/PerformersContext'
import { useStages } from '../context/StagesContext'

export default function CuesPage() {
  const { currentRunOfShow } = useRunOfShow()
  const { cues, updateCueStatus } = usePerformerReadiness()
  const { getArtistName } = usePerformersContext()
  const { getStageName } = useStages()

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b'
      case 'live':
        return '#ef4444'
      case 'complete':
        return '#10b981'
      case 'delayed':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  if (!currentRunOfShow) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Cues</h1>
          <p className="page-subtitle">Manage and track show cues</p>
        </div>
        <div className="placeholder-content">
          <p>No run-of-show loaded. Create one first to manage cues.</p>
        </div>
      </div>
    )
  }

  const timelineItems = currentRunOfShow.items

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Cues</h1>
          <p className="page-subtitle">Timeline cues from {currentRunOfShow.name}</p>
        </div>
      </div>

      {timelineItems.length === 0 ? (
        <div className="placeholder-content">
          <p>No cues in timeline. Add items to the run-of-show to create cues.</p>
        </div>
      ) : (
        <div className="cues-list">
          {timelineItems.map((item, index) => {
            const itemCue = cues.find((c) => c.cueId === item.id)

            return (
              <div key={item.id} className="cue-card">
                <div className="cue-header">
                  <div className="cue-index">
                    <span>{index + 1}</span>
                  </div>
                  <div className="cue-title-section">
                    <h3>{item.name}</h3>
                    <div className="cue-type-badge">{item.type}</div>
                  </div>
                  <div className="cue-status-section">
                    <div
                      className={`cue-status-badge ${itemCue?.status || 'pending'}`}
                      style={{ background: getStatusColor(itemCue?.status || 'pending') }}
                    >
                      {itemCue?.status || 'pending'}
                    </div>
                  </div>
                </div>

                {item.description && (
                  <p className="cue-description">{item.description}</p>
                )}

                <div className="cue-details-grid">
                  <div className="cue-detail">
                    <span className="label">Start Time:</span>
                    <span className="value">{formatTime(item.startTime)}</span>
                  </div>
                  {item.endTime && (
                    <div className="cue-detail">
                      <span className="label">End Time:</span>
                      <span className="value">{formatTime(item.endTime)}</span>
                    </div>
                  )}
                  <div className="cue-detail">
                    <span className="label">Stage:</span>
                    <span className="value">{getStageName(item.stage) || item.stage}</span>
                  </div>
                  {item.departments.length > 0 && (
                    <div className="cue-detail">
                      <span className="label">Departments:</span>
                      <span className="value">{item.departments.map((d) => d.replace('-', ' ')).join(', ')}</span>
                    </div>
                  )}
                </div>

                {item.performers.length > 0 && (
                  <div className="cue-performers">
                    <span className="label">Artists:</span>
                    <span className="value">
                      {item.performers
                        .map((perfId) => getArtistName(perfId) || perfId)
                        .join(', ')}
                    </span>
                  </div>
                )}

                {item.notes && (
                  <div className="cue-notes">
                    <span className="label">Notes:</span>
                    <p>{item.notes}</p>
                  </div>
                )}

                {itemCue?.delayReason && (
                  <div className="cue-delay">
                    <span className="label">Delay:</span>
                    <span className="value">
                      {(itemCue.delayMs || 0) / 1000 / 60} min - {itemCue.delayReason}
                    </span>
                  </div>
                )}

                <div className="cue-actions">
                  {itemCue?.status !== 'pending' && (
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => updateCueStatus(item.id, 'pending')}
                    >
                      Reset to Pending
                    </button>
                  )}
                  {itemCue?.status !== 'live' && (
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => updateCueStatus(item.id, 'live')}
                    >
                      Mark Live
                    </button>
                  )}
                  {itemCue?.status !== 'complete' && (
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => updateCueStatus(item.id, 'complete')}
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
