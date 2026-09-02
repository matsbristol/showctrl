import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface CrewMember {
  id: string
  name: string
  role: 'stage-manager' | 'lighting' | 'sound' | 'video' | 'stage-hand' | 'security' | 'other'
  status: 'on-site' | 'ready' | 'break' | 'off-duty' | 'not-arrived'
  department: string
  contact?: string
  notes?: string
  updatedAt: number
}

interface CrewContextType {
  crew: CrewMember[]
  addCrewMember: (member: Omit<CrewMember, 'id' | 'updatedAt'>) => void
  updateCrewMember: (id: string, updates: Partial<CrewMember>) => void
  removeCrewMember: (id: string) => void
  getCrewByRole: (role: CrewMember['role']) => CrewMember[]
  getCrewByStatus: (status: CrewMember['status']) => CrewMember[]
  getCrewByDepartment: (department: string) => CrewMember[]
}

const CrewContext = createContext<CrewContextType | undefined>(undefined)

export function CrewProvider({ children }: { children: ReactNode }) {
  const [crew, setCrew] = useState<CrewMember[]>(() => {
    const stored = localStorage.getItem('showctrl_crew')
    if (stored) return JSON.parse(stored)

    // Seed data
    return [
      { id: 'crew-1', name: 'Sarah Chen', role: 'stage-manager', status: 'ready', department: 'stage', notes: 'Lead stage manager', updatedAt: Date.now() },
      { id: 'crew-2', name: 'Marcus Johnson', role: 'lighting', status: 'on-site', department: 'technical', updatedAt: Date.now() },
      { id: 'crew-3', name: 'Elena Rodriguez', role: 'sound', status: 'ready', department: 'technical', updatedAt: Date.now() },
      { id: 'crew-4', name: 'James Park', role: 'stage-hand', status: 'break', department: 'stage', updatedAt: Date.now() },
      { id: 'crew-5', name: 'Lisa Thompson', role: 'security', status: 'on-site', department: 'security', updatedAt: Date.now() },
    ]
  })

  useEffect(() => {
    localStorage.setItem('showctrl_crew', JSON.stringify(crew))
  }, [crew])

  const addCrewMember = (member: Omit<CrewMember, 'id' | 'updatedAt'>) => {
    const newMember: CrewMember = {
      ...member,
      id: `crew-${Date.now()}`,
      updatedAt: Date.now(),
    }
    setCrew((prev) => [...prev, newMember])
  }

  const updateCrewMember = (id: string, updates: Partial<CrewMember>) => {
    setCrew((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, ...updates, updatedAt: Date.now() } : m
      )
    )
  }

  const removeCrewMember = (id: string) => {
    setCrew((prev) => prev.filter((m) => m.id !== id))
  }

  const getCrewByRole = (role: CrewMember['role']) => {
    return crew.filter((m) => m.role === role)
  }

  const getCrewByStatus = (status: CrewMember['status']) => {
    return crew.filter((m) => m.status === status)
  }

  const getCrewByDepartment = (department: string) => {
    return crew.filter((m) => m.department === department)
  }

  const value: CrewContextType = {
    crew,
    addCrewMember,
    updateCrewMember,
    removeCrewMember,
    getCrewByRole,
    getCrewByStatus,
    getCrewByDepartment,
  }

  return <CrewContext.Provider value={value}>{children}</CrewContext.Provider>
}

export function useCrew() {
  const context = useContext(CrewContext)
  if (!context) {
    throw new Error('useCrew must be used within CrewProvider')
  }
  return context
}
