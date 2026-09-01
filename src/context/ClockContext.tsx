import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

interface OperationalPhase {
  name: string
  id: string
  scheduledTime: number // Unix timestamp
}

interface ClockContextType {
  masterTime: number // Current real-world time (always synced)
  showStartTime: number | null // When the show is scheduled to start
  phases: OperationalPhase[]
  clockDrift: number // milliseconds drift from real time
  clockDriftStatus: 'healthy' | 'warning' | 'critical'
  setShowStartTime: (time: number) => void
  addPhase: (phase: OperationalPhase) => void
  updatePhase: (id: string, updates: Partial<OperationalPhase>) => void
  removePhase: (id: string) => void
  // Derived values
  timeToPhase: (phaseId: string) => number // milliseconds until phase (negative if past)
  phaseCountdown: (phaseId: string) => string // formatted countdown
}

const ClockContext = createContext<ClockContextType | undefined>(undefined)

export function ClockProvider({ children }: { children: ReactNode }) {
  const [masterTime, setMasterTime] = useState(Date.now())
  const [showStartTime, setShowStartTime] = useState<number | null>(null)
  const [clockDrift, setClockDrift] = useState(0) // milliseconds
  const [phases, setPhases] = useState<OperationalPhase[]>([
    { name: 'Get-in', id: 'getin', scheduledTime: Date.now() + 3600000 },
    { name: 'Load-in', id: 'loadin', scheduledTime: Date.now() + 7200000 },
    { name: 'Show Start', id: 'show-start', scheduledTime: Date.now() + 10800000 },
    { name: 'Load-out', id: 'loadout', scheduledTime: Date.now() + 14400000 },
  ])

  // Master clock always syncs to real system time (100ms updates)
  // In production, this would sync with NTP server specified in settings
  useEffect(() => {
    let lastTime = Date.now()

    const interval = setInterval(() => {
      const now = Date.now()
      const expectedDelta = 100 // ms
      const actualDelta = now - lastTime
      const drift = actualDelta - expectedDelta

      setMasterTime(now)
      setClockDrift(drift)
      lastTime = now
    }, 100)

    return () => clearInterval(interval)
  }, [])

  const timeToPhase = (phaseId: string): number => {
    const phase = phases.find((p) => p.id === phaseId)
    if (!phase) return 0
    return phase.scheduledTime - masterTime
  }

  const phaseCountdown = (phaseId: string): string => {
    const ms = timeToPhase(phaseId)
    const totalSeconds = Math.round(ms / 1000)

    if (totalSeconds < 0) {
      return 'STARTED'
    }

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const addPhase = (phase: OperationalPhase) => {
    setPhases([...phases, phase])
  }

  const updatePhase = (id: string, updates: Partial<OperationalPhase>) => {
    setPhases(phases.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }

  const removePhase = (id: string) => {
    setPhases(phases.filter((p) => p.id !== id))
  }

  const getClockDriftStatus = (): 'healthy' | 'warning' | 'critical' => {
    const absDrift = Math.abs(clockDrift)
    if (absDrift <= 1000) return 'healthy' // ±1s
    if (absDrift <= 5000) return 'warning' // ±5s
    return 'critical' // >5s
  }

  const value: ClockContextType = {
    masterTime,
    showStartTime,
    phases,
    clockDrift,
    clockDriftStatus: getClockDriftStatus(),
    setShowStartTime,
    addPhase,
    updatePhase,
    removePhase,
    timeToPhase,
    phaseCountdown,
  }

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>
}

export function useClock() {
  const context = useContext(ClockContext)
  if (!context) {
    throw new Error('useClock must be used within ClockProvider')
  }
  return context
}
