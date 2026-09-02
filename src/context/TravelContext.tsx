import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface TravelEntry {
  id: string
  personName: string
  role: 'performer' | 'crew' | 'guest'
  status: 'not-traveled' | 'in-transit' | 'arrived' | 'departed'
  transportType: 'car' | 'bus' | 'flight' | 'train' | 'other'
  scheduledArrival?: number // Unix timestamp
  actualArrival?: number // Unix timestamp
  accommodation?: string
  notes?: string
  updatedAt: number
}

interface TravelContextType {
  travelEntries: TravelEntry[]
  addTravelEntry: (entry: Omit<TravelEntry, 'id' | 'updatedAt'>) => void
  updateTravelEntry: (id: string, updates: Partial<TravelEntry>) => void
  removeTravelEntry: (id: string) => void
  getTravelByStatus: (status: TravelEntry['status']) => TravelEntry[]
  getTravelByRole: (role: TravelEntry['role']) => TravelEntry[]
  getArrivalCountdown: (scheduledArrival: number) => string
}

const TravelContext = createContext<TravelContextType | undefined>(undefined)

export function TravelProvider({ children }: { children: ReactNode }) {
  const [travelEntries, setTravelEntries] = useState<TravelEntry[]>(() => {
    const stored = localStorage.getItem('showctrl_travel')
    if (stored) return JSON.parse(stored)

    // Seed data - times relative to now
    const nowMs = Date.now()
    const in2Hours = nowMs + 2 * 60 * 60 * 1000
    const in4Hours = nowMs + 4 * 60 * 60 * 1000
    const yesterday = nowMs - 24 * 60 * 60 * 1000

    return [
      { id: 'travel-1', personName: 'The Echoes Band', role: 'performer', status: 'arrived', transportType: 'bus', scheduledArrival: in4Hours, actualArrival: yesterday, accommodation: 'Hotel Norway', updatedAt: Date.now() },
      { id: 'travel-2', personName: 'Aurora', role: 'performer', status: 'in-transit', transportType: 'flight', scheduledArrival: in2Hours, accommodation: 'Hotel Norway', notes: 'Landing at 2pm', updatedAt: Date.now() },
      { id: 'travel-3', personName: 'Production Manager', role: 'crew', status: 'arrived', transportType: 'car', scheduledArrival: yesterday, actualArrival: yesterday, updatedAt: Date.now() },
    ]
  })

  useEffect(() => {
    localStorage.setItem('showctrl_travel', JSON.stringify(travelEntries))
  }, [travelEntries])

  const addTravelEntry = (entry: Omit<TravelEntry, 'id' | 'updatedAt'>) => {
    const newEntry: TravelEntry = {
      ...entry,
      id: `travel-${Date.now()}`,
      updatedAt: Date.now(),
    }
    setTravelEntries((prev) => [...prev, newEntry])
  }

  const updateTravelEntry = (id: string, updates: Partial<TravelEntry>) => {
    setTravelEntries((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
      )
    )
  }

  const removeTravelEntry = (id: string) => {
    setTravelEntries((prev) => prev.filter((t) => t.id !== id))
  }

  const getTravelByStatus = (status: TravelEntry['status']) => {
    return travelEntries.filter((t) => t.status === status)
  }

  const getTravelByRole = (role: TravelEntry['role']) => {
    return travelEntries.filter((t) => t.role === role)
  }

  const getArrivalCountdown = (scheduledArrival: number) => {
    const now = Date.now()
    const diff = scheduledArrival - now

    if (diff < 0) return 'Overdue'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const value: TravelContextType = {
    travelEntries,
    addTravelEntry,
    updateTravelEntry,
    removeTravelEntry,
    getTravelByStatus,
    getTravelByRole,
    getArrivalCountdown,
  }

  return <TravelContext.Provider value={value}>{children}</TravelContext.Provider>
}

export function useTravel() {
  const context = useContext(TravelContext)
  if (!context) {
    throw new Error('useTravel must be used within TravelProvider')
  }
  return context
}
