import { useState } from 'react'
import { useDepartmentStatus } from '../context/DepartmentStatusContext'
import { useRunOfShow } from '../context/RunOfShowContext'
import { useStages } from '../context/StagesContext'
import { usePerformersContext } from '../context/PerformersContext'

const DEPARTMENTS = [
  'stage-manager',
  'tech-lead',
  'lighting',
  'sound',
  'video',
  'stagehands',
  'security',
  'talent-liaison',
]

export default function DepartmentStatusPage() {
  const { getConfig, updateConfig } = useDepartmentStatus()
  const { currentRunOfShow } = useRunOfShow()
  const { stages } = useStages()
  const { artists } = usePerformersContext()
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0])

  const config = getConfig(selectedDept)

  const handleStageToggle = (stageId: string) => {
    const updated = config.selectedStages.includes(stageId)
      ? config.selectedStages.filter((s) => s !== stageId)
      : [...config.selectedStages, stageId]
    updateConfig(selectedDept, { selectedStages: updated })
  }

  const handlePerformerToggle = (performerId: string) => {
    const updated = config.selectedPerformers.includes(performerId)
      ? config.selectedPerformers.filter((p) => p !== performerId)
      : [...config.selectedPerformers, performerId]
    updateConfig(selectedDept, { selectedPerformers: updated })
  }

  const filteredItems = currentRunOfShow
    ? currentRunOfShow.items.filter((item) => {
        // Include if department is involved
        const hasDept = item.departments.includes(selectedDept)
        if (!hasDept) return false

        // Filter by selected stages
        if (config.selectedStages.length > 0 && !config.selectedStages.includes(item.stage)) {
          return false
        }

        // Filter by selected performers
        if (config.selectedPerformers.length > 0) {
          const hasPerformer = item.performers.some((p) =>
            config.selectedPerformers.includes(p)
          )
          if (!hasPerformer && item.performers.length > 0) return false
        }

        return true
      })
    : []

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const deptLabel = selectedDept.charAt(0).toUpperCase() + selectedDept.slice(1).replace('-', ' ')

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Department Status</h1>
          <p className="page-subtitle">Configure view for each department</p>
        </div>
      </div>

      <div className="dept-status-layout">
        {/* Department Selector */}
        <div className="dept-selector">
          <div className="dept-selector-header">
            <h3>Departments</h3>
          </div>
          <div className="dept-list">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                className={`dept-button ${selectedDept === dept ? 'active' : ''}`}
                onClick={() => setSelectedDept(dept)}
              >
                {dept.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="dept-config-panel">
          <div className="config-section">
            <div className="config-header">
              <h2>{deptLabel}</h2>
              <span className="config-subtitle">Configure what to display</span>
            </div>

            {/* Stage Selection */}
            <div className="config-group">
              <h4>Stages to Monitor</h4>
              <p className="config-help">Select stages relevant to this department</p>
              <div className="checkbox-group">
                {stages.map((stage) => (
                  <label key={stage.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.selectedStages.includes(stage.id)}
                      onChange={() => handleStageToggle(stage.id)}
                    />
                    <span>{stage.name}</span>
                  </label>
                ))}
              </div>
              {config.selectedStages.length === 0 && (
                <p className="config-note">Select stages to filter timeline</p>
              )}
            </div>

            {/* Performer Selection */}
            <div className="config-group">
              <h4>Performers to Track</h4>
              <p className="config-help">Select specific performers to focus on (optional)</p>
              <div className="checkbox-group">
                {artists.map((artist) => (
                  <label key={artist.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.selectedPerformers.includes(artist.id)}
                      onChange={() => handlePerformerToggle(artist.id)}
                    />
                    <span>{artist.name}</span>
                  </label>
                ))}
              </div>
              {config.selectedPerformers.length === 0 && (
                <p className="config-note">Leave empty to see all performers</p>
              )}
            </div>
          </div>

          {/* Status Display */}
          <div className="status-display">
            <div className="status-header">
              <h3>Timeline for {deptLabel}</h3>
              {config.selectedStages.length > 0 && (
                <span className="filter-badge">
                  {config.selectedStages.length} stage{config.selectedStages.length !== 1 ? 's' : ''}
                </span>
              )}
              {config.selectedPerformers.length > 0 && (
                <span className="filter-badge">
                  {config.selectedPerformers.length} performer{config.selectedPerformers.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {filteredItems.length === 0 ? (
              <div className="status-empty">
                <p>No timeline items for {deptLabel.toLowerCase()} with current filters</p>
              </div>
            ) : (
              <div className="status-items">
                {filteredItems.map((item, index) => (
                  <div key={item.id} className="status-item">
                    <div className="status-item-index">{index + 1}</div>
                    <div className="status-item-content">
                      <h4>{item.name}</h4>
                      <div className="status-item-meta">
                        <span className="meta">{formatTime(item.startTime)}</span>
                        {item.endTime && <span className="meta">→ {formatTime(item.endTime)}</span>}
                        <span className="meta stage-label">{stages.find(s => s.id === item.stage)?.name || item.stage}</span>
                      </div>
                      {item.performers.length > 0 && (
                        <div className="status-item-performers">
                          {item.performers
                            .map((id) => artists.find((a) => a.id === id)?.name || id)
                            .join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
