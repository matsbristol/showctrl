import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface Riser {
  id: string
  name: string
  zone: string
  capacity: number
  assignedPerformers: string[]
  notes?: string
  updatedAt: number
}

interface RiserPlanningContextType {
  risers: Riser[]
  addRiser: (riser: Omit<Riser, 'id' | 'updatedAt'>) => void
  updateRiser: (id: string, updates: Partial<Riser>) => void
  removeRiser: (id: string) => void
  assignPerformer: (riserId: string, performerId: string) => void
  removePerformer: (riserId: string, performerId: string) => void
  getRisersByZone: (zone: string) => Riser[]
  getRiserCapacityUsage: (riserId: string) => { used: number; capacity: number; percent: number }
}

const RiserPlanningContext = createContext<RiserPlanningContextType | undefined>(undefined)

export function RiserPlanningProvider({ children }: { children: ReactNode }) {
  const [risers, setRisers] = useState<Riser[]>(() => {
    const stored = localStorage.getItem('showctrl_risers')
    if (stored) return JSON.parse(stored)

    // Seed data
    return [
      { id: 'riser-1', name: 'Main Stage Left', zone: 'main', capacity: 8, assignedPerformers: ['The Echoes'], notes: 'Primary performance area', updatedAt: Date.now() },
      { id: 'riser-2', name: 'Main Stage Right', zone: 'main', capacity: 8, assignedPerformers: ['Aurora'], notes: 'Backup position', updatedAt: Date.now() },
      { id: 'riser-3', name: 'Secondary Stage', zone: 'secondary', capacity: 5, assignedPerformers: [], notes: 'For DJ/MC', updatedAt: Date.now() },
    ]
  })

  useEffect(() => {
    localStorage.setItem('showctrl_risers', JSON.stringify(risers))
  }, [risers])

  const addRiser = (riser: Omit<Riser, 'id' | 'updatedAt'>) => {
    const newRiser: Riser = {
      ...riser,
      id: `riser-${Date.now()}`,
      updatedAt: Date.now(),
    }
    setRisers((prev) => [...prev, newRiser])
  }

  const updateRiser = (id: string, updates: Partial<Riser>) => {
    setRisers((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
      )
    )
  }

  const removeRiser = (id: string) => {
    setRisers((prev) => prev.filter((r) => r.id !== id))
  }

  const assignPerformer = (riserId: string, performerId: string) => {
    setRisers((prev) =>
      prev.map((r) =>
        r.id === riserId
          ? {
              ...r,
              assignedPerformers: [...new Set([...r.assignedPerformers, performerId])],
              updatedAt: Date.now(),
            }
          : r
      )
    )
  }

  const removePerformer = (riserId: string, performerId: string) => {
    setRisers((prev) =>
      prev.map((r) =>
        r.id === riserId
          ? {
              ...r,
              assignedPerformers: r.assignedPerformers.filter((p) => p !== performerId),
              updatedAt: Date.now(),
            }
          : r
      )
    )
  }

  const getRisersByZone = (zone: string) => {
    return risers.filter((r) => r.zone === zone)
  }

  const getRiserCapacityUsage = (riserId: string) => {
    const riser = risers.find((r) => r.id === riserId)
    if (!riser) return { used: 0, capacity: 0, percent: 0 }

    const used = riser.assignedPerformers.length
    return {
      used,
      capacity: riser.capacity,
      percent: Math.round((used / riser.capacity) * 100),
    }
  }

  const value: RiserPlanningContextType = {
    risers,
    addRiser,
    updateRiser,
    removeRiser,
    assignPerformer,
    removePerformer,
    getRisersByZone,
    getRiserCapacityUsage,
  }

  return (
    <RiserPlanningContext.Provider value={value}>
      {children}
    </RiserPlanningContext.Provider>
  )
}

export function useRiserPlanning() {
  const context = useContext(RiserPlanningContext)
  if (!context) {
    throw new Error('useRiserPlanning must be used within RiserPlanningProvider')
  }
  return context
}
