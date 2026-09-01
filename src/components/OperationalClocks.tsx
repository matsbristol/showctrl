import { useClock } from '../context/ClockContext'

export default function OperationalClocks() {
  const { phases, timeToPhase, phaseCountdown } = useClock()

  const getPhaseStatus = (phaseId: string) => {
    const timeMs = timeToPhase(phaseId)
    if (timeMs > 0) return 'pending'
    if (timeMs < -1800000) return 'completed' // 30 minutes past
    return 'active'
  }

  const getPhaseIcon = (phaseId: string) => {
    const icons: Record<string, string> = {
      getin: '📥',
      loadin: '📦',
      'show-start': '🎬',
      loadout: '📤',
    }
    return icons[phaseId] || '⏰'
  }

  return (
    <div className="operational-clocks">
      <h3 className="section-title">Operational Timeline</h3>
      <div className="clocks-grid">
        {phases.map((phase) => {
          const status = getPhaseStatus(phase.id)
          return (
            <div key={phase.id} className={`operational-clock ${status}`}>
              <div className="clock-icon">{getPhaseIcon(phase.id)}</div>
              <div className="clock-info">
                <div className="clock-name">{phase.name}</div>
                <div className="clock-countdown">{phaseCountdown(phase.id)}</div>
              </div>
              <div className={`clock-status-badge ${status}`}>{status}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
