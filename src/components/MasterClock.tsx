import { useClock } from '../context/ClockContext'
import { useEffect, useState } from 'react'

export default function MasterClock() {
  const { masterTime, clockDrift, clockDriftStatus } = useClock()
  const [displayTime, setDisplayTime] = useState('')

  useEffect(() => {
    const hours = new Date(masterTime).getHours().toString().padStart(2, '0')
    const minutes = new Date(masterTime).getMinutes().toString().padStart(2, '0')
    const seconds = new Date(masterTime).getSeconds().toString().padStart(2, '0')
    setDisplayTime(`${hours}:${minutes}:${seconds}`)
  }, [masterTime])

  const formatDrift = (ms: number) => {
    const sign = ms >= 0 ? '+' : '-'
    const absMs = Math.abs(ms)
    if (absMs < 1000) return `${sign}${absMs.toFixed(0)}ms`
    return `${sign}${(absMs / 1000).toFixed(2)}s`
  }

  const driftStatusColors = {
    healthy: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
  }

  return (
    <div className="master-clock-widget">
      <div className="widget-header">
        <h3>Master Clock</h3>
        <div className="status-indicator live"></div>
      </div>
      <div className="clock-display">{displayTime}</div>
      <div className="clock-drift-info">
        <p className="card-meta">Real-world time (NTP synced)</p>
        <div className="drift-status" style={{ borderColor: driftStatusColors[clockDriftStatus] }}>
          <span className="drift-indicator" style={{ background: driftStatusColors[clockDriftStatus] }}></span>
          <span className="drift-value">Drift: {formatDrift(clockDrift)}</span>
          <span className="drift-label">({clockDriftStatus})</span>
        </div>
      </div>
    </div>
  )
}
