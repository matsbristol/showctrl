import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface PerformerReadiness {
  performerId: string
  name: string
  status: 'not-ready' | 'ready' | 'on-stage' | 'completed'
  callTime?: number // Unix timestamp
  updatedAt: number
  notes?: string
}

export interface CueStatus {
  cueId: string
  status: 'pending' | 'live' | 'complete' | 'delayed'
  delayMs?: number
  delayReason?: string
  updatedAt: number
}

interface PerformerReadinessContextType {
  performers: PerformerReadiness[]
  cues: CueStatus[]
  updatePerformerStatus: (
    performerId: string,
    status: PerformerReadiness['status'],
    notes?: string
  ) => void
  updateCueStatus: (
    cueId: string,
    status: CueStatus['status'],
    delayMs?: number,
    delayReason?: string
  ) => void
  addPerformer: (performer: Omit<PerformerReadiness, 'updatedAt'>) => void
  getPerformersByStatus: (status: PerformerReadiness['status']) => PerformerReadiness[]
}

const PerformerReadinessContext = createContext<PerformerReadinessContextType | undefined>(
  undefined
)

export function PerformerReadinessProvider({ children }: { children: ReactNode }) {
  const [performers, setPerformers] = useState<PerformerReadiness[]>(() => {
    const stored = localStorage.getItem('showctrl_performers')
    if (stored) return JSON.parse(stored)

    // Seed data for testing
    return [
      { performerId: 'perf-1', name: 'The Echoes - Lead', status: 'ready', updatedAt: Date.now() },
      { performerId: 'perf-2', name: 'The Echoes - Bass', status: 'ready', updatedAt: Date.now() },
      { performerId: 'perf-3', name: 'Aurora - Lead Vocals', status: 'not-ready', updatedAt: Date.now(), notes: 'Still in hair & makeup' },
      { performerId: 'perf-4', name: 'Aurora - Guitar', status: 'ready', updatedAt: Date.now() },
      { performerId: 'perf-5', name: 'Aurora - Drums', status: 'not-ready', updatedAt: Date.now(), notes: 'Waiting for stage clearance' },
    ]
  })

  const [cues, setCues] = useState<CueStatus[]>(() => {
    const stored = localStorage.getItem('showctrl_cues')
    return stored ? JSON.parse(stored) : []
  })

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('showctrl_performers', JSON.stringify(performers))
  }, [performers])

  useEffect(() => {
    localStorage.setItem('showctrl_cues', JSON.stringify(cues))
  }, [cues])

  const updatePerformerStatus = (
    performerId: string,
    status: PerformerReadiness['status'],
    notes?: string
  ) => {
    setPerformers((prev) =>
      prev.map((p) =>
        p.performerId === performerId
          ? { ...p, status, notes, updatedAt: Date.now() }
          : p
      )
    )
  }

  const updateCueStatus = (
    cueId: string,
    status: CueStatus['status'],
    delayMs?: number,
    delayReason?: string
  ) => {
    setCues((prev) => {
      const existing = prev.find((c) => c.cueId === cueId)
      if (existing) {
        return prev.map((c) =>
          c.cueId === cueId
            ? {
                ...c,
                status,
                delayMs,
                delayReason,
                updatedAt: Date.now(),
              }
            : c
        )
      }
      return [
        ...prev,
        {
          cueId,
          status,
          delayMs,
          delayReason,
          updatedAt: Date.now(),
        },
      ]
    })
  }

  const addPerformer = (performer: Omit<PerformerReadiness, 'updatedAt'>) => {
    setPerformers((prev) => [
      ...prev,
      {
        ...performer,
        updatedAt: Date.now(),
      },
    ])
  }

  const getPerformersByStatus = (status: PerformerReadiness['status']) => {
    return performers.filter((p) => p.status === status)
  }

  const value: PerformerReadinessContextType = {
    performers,
    cues,
    updatePerformerStatus,
    updateCueStatus,
    addPerformer,
    getPerformersByStatus,
  }

  return (
    <PerformerReadinessContext.Provider value={value}>
      {children}
    </PerformerReadinessContext.Provider>
  )
}

export function usePerformerReadiness() {
  const context = useContext(PerformerReadinessContext)
  if (!context) {
    throw new Error('usePerformerReadiness must be used within PerformerReadinessProvider')
  }
  return context
}
