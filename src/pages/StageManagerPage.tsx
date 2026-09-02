import { useClock } from '../context/ClockContext'
import { useRunOfShow } from '../context/RunOfShowContext'
import { usePerformerReadiness } from '../context/PerformerReadinessContext'
import { useModules } from '../context/ModulesContext'
import CrewSection from '../components/CrewSection'
import RiserPlanningSection from '../components/RiserPlanningSection'
import TravelLogisticsSection from '../components/TravelLogisticsSection'
import HospitalitySection from '../components/HospitalitySection'
import { useEffect, useState } from 'react'

export default function StageManagerPage() {
  const { masterTime, clockDriftStatus } = useClock()
  const { currentRunOfShow } = useRunOfShow()
  const { performers, cues, updatePerformerStatus, updateCueStatus } = usePerformerReadiness()
  const { modules, toggleModule } = useModules()
  const [displayTime, setDisplayTime] = useState('')
  const [currentItemIndex, setCurrentItemIndex] = useState(0)
  const [showSettings, setShowSettings] = useState(false)

  // Update display time
  useEffect(() => {
    const hours = new Date(masterTime).getHours().toString().padStart(2, '0')
    const minutes = new Date(masterTime).getMinutes().toString().padStart(2, '0')
    const seconds = new Date(masterTime).getSeconds().toString().padStart(2, '0')
    setDisplayTime(`${hours}:${minutes}:${seconds}`)
  }, [masterTime])

  if (!currentRunOfShow || currentRunOfShow.items.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Stage Manager</h1>
          <p className="page-subtitle">Live Operations Control</p>
        </div>
        <div className="placeholder-content">
          <p>No run-of-show loaded. Please create a show timeline first.</p>
        </div>
      </div>
    )
  }

  const items = currentRunOfShow.items
  const currentItem = items[currentItemIndex]
  const nextItems = items.slice(currentItemIndex + 1, currentItemIndex + 4)
  const readyPerformers = performers.filter((p) => p.status === 'ready')
  const notReadyPerformers = performers.filter((p) => p.status === 'not-ready')

  return (
    <div className="page-container stage-manager-view">
      {/* Master Clock - Prominent, Always Visible */}
      <div className="master-clock-section">
        <div className="clock-display-large">{displayTime}</div>
        <div className={`clock-status ${clockDriftStatus}`}>
          {clockDriftStatus === 'healthy' ? '🟢' : clockDriftStatus === 'warning' ? '🟡' : '🔴'} Clock{' '}
          {clockDriftStatus}
        </div>
      </div>

      <div className="stage-manager-grid">
        {/* Current Item */}
        <div className="sm-section current-item">
          <h3>Now Playing</h3>
          {currentItem ? (
            <div className="current-item-card">
              <div className="item-badge" data-type={currentItem.type}>{currentItem.type}</div>
              <h2 className="item-title">{currentItem.name}</h2>
              <p className="item-duration">
                Duration: {Math.floor(currentItem.duration / 1000)}s
              </p>
              {currentItem.performers.length > 0 && (
                <p className="item-performers">🎤 {currentItem.performers.join(', ')}</p>
              )}
              {currentItem.description && (
                <p className="item-notes">{currentItem.description}</p>
              )}
            </div>
          ) : (
            <p>Show complete</p>
          )}
        </div>

        {/* Next Items Queue */}
        <div className="sm-section queue">
          <h3>Queue</h3>
          <div className="queue-items">
            {nextItems.length > 0 ? (
              nextItems.map((item, idx) => (
                <div key={item.id} className="queue-item">
                  <div className="queue-index">{currentItemIndex + idx + 2}</div>
                  <div className="queue-content">
                    <div className="queue-name">{item.name}</div>
                    <div className="queue-type">{item.type}</div>
                  </div>
                </div>
              ))
            ) : (
              <p>No more items</p>
            )}
          </div>
        </div>

        {/* Performer Readiness */}
        <div className="sm-section performer-status">
          <h3>Performer Status</h3>
          <div className="status-grid">
            <div className="status-box ready">
              <div className="status-count">{readyPerformers.length}</div>
              <div className="status-label">Ready</div>
            </div>
            <div className="status-box not-ready">
              <div className="status-count">{notReadyPerformers.length}</div>
              <div className="status-label">Not Ready</div>
            </div>
          </div>
          <div className="performer-list">
            {notReadyPerformers.length > 0 && (
              <div>
                <h4>Waiting on:</h4>
                {notReadyPerformers.map((p) => (
                  <div key={p.performerId} className="performer-item not-ready">
                    <span>{p.name}</span>
                    <button
                      className="btn btn-small btn-primary"
                      onClick={() => updatePerformerStatus(p.performerId, 'ready')}
                    >
                      Mark Ready
                    </button>
                  </div>
                ))}
              </div>
            )}
            {readyPerformers.length > 0 && (
              <div>
                <h4>Ready to go:</h4>
                {readyPerformers.map((p) => (
                  <div key={p.performerId} className="performer-item ready">
                    <span>✓ {p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="sm-section actions">
          <h3>Actions</h3>
          <div className="action-buttons">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                updateCueStatus(currentItem?.id || '', 'live')
                setCurrentItemIndex(Math.min(currentItemIndex + 1, items.length - 1))
              }}
            >
              ▶ Next Cue
            </button>
            <button className="btn btn-secondary btn-lg">⏸ Log Delay</button>
            <button className="btn btn-secondary btn-lg" onClick={() => setShowSettings(!showSettings)}>
              ⚙️ Modules
            </button>
          </div>
        </div>
      </div>

      {/* Module Settings */}
      {showSettings && (
        <div className="modules-settings">
          <h3>Available Modules</h3>
          <p className="settings-desc">Enable/disable operational sections for this event</p>
          <div className="modules-grid">
            {Object.values(modules).map((module) => (
              <label key={module.type} className="module-toggle">
                <input
                  type="checkbox"
                  checked={module.enabled}
                  onChange={() => toggleModule(module.type)}
                />
                <span className="toggle-label">{module.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Operational Modules */}
      {Object.values(modules).some((m) => m.enabled) && (
        <div className="modules-container">
          <div className="modules-grid">
            {modules.crew.enabled && <CrewSection />}
            {modules['riser-planning'].enabled && <RiserPlanningSection />}
            {modules.travel.enabled && <TravelLogisticsSection />}
            {modules.hospitality.enabled && <HospitalitySection />}
          </div>
        </div>
      )}
    </div>
  )
}
