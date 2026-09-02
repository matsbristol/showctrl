import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface HospitalityEntry {
  id: string
  personName: string
  role: 'performer' | 'crew' | 'guest'
  mealStatus: 'pending' | 'served' | 'completed'
  accommodationConfirmed: boolean
  specialRequirements: string[]
  notes?: string
  updatedAt: number
}

interface HospitalityContextType {
  hospitality: HospitalityEntry[]
  addHospitalityEntry: (entry: Omit<HospitalityEntry, 'id' | 'updatedAt'>) => void
  updateHospitalityEntry: (id: string, updates: Partial<HospitalityEntry>) => void
  removeHospitalityEntry: (id: string) => void
  getByMealStatus: (status: HospitalityEntry['mealStatus']) => HospitalityEntry[]
  getByRole: (role: HospitalityEntry['role']) => HospitalityEntry[]
  getMissingAccommodations: () => HospitalityEntry[]
  getSpecialRequirements: () => Array<{ requirement: string; count: number }>
}

const HospitalityContext = createContext<HospitalityContextType | undefined>(undefined)

export function HospitalityProvider({ children }: { children: ReactNode }) {
  const [hospitality, setHospitality] = useState<HospitalityEntry[]>(() => {
    const stored = localStorage.getItem('showctrl_hospitality')
    if (stored) return JSON.parse(stored)

    // Seed data
    return [
      { id: 'hosp-1', personName: 'The Echoes Band', role: 'performer', mealStatus: 'served', accommodationConfirmed: true, specialRequirements: ['vegetarian', 'gluten-free'], updatedAt: Date.now() },
      { id: 'hosp-2', personName: 'Aurora', role: 'performer', mealStatus: 'pending', accommodationConfirmed: true, specialRequirements: ['vegan'], notes: 'Prefers plant-based meals', updatedAt: Date.now() },
      { id: 'hosp-3', personName: 'Production Team', role: 'crew', mealStatus: 'completed', accommodationConfirmed: true, specialRequirements: [], updatedAt: Date.now() },
      { id: 'hosp-4', personName: 'Guest Musician', role: 'guest', mealStatus: 'pending', accommodationConfirmed: false, specialRequirements: ['vegetarian'], notes: 'Accommodation TBD', updatedAt: Date.now() },
    ]
  })

  useEffect(() => {
    localStorage.setItem('showctrl_hospitality', JSON.stringify(hospitality))
  }, [hospitality])

  const addHospitalityEntry = (entry: Omit<HospitalityEntry, 'id' | 'updatedAt'>) => {
    const newEntry: HospitalityEntry = {
      ...entry,
      id: `hosp-${Date.now()}`,
      updatedAt: Date.now(),
    }
    setHospitality((prev) => [...prev, newEntry])
  }

  const updateHospitalityEntry = (id: string, updates: Partial<HospitalityEntry>) => {
    setHospitality((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, ...updates, updatedAt: Date.now() } : h
      )
    )
  }

  const removeHospitalityEntry = (id: string) => {
    setHospitality((prev) => prev.filter((h) => h.id !== id))
  }

  const getByMealStatus = (status: HospitalityEntry['mealStatus']) => {
    return hospitality.filter((h) => h.mealStatus === status)
  }

  const getByRole = (role: HospitalityEntry['role']) => {
    return hospitality.filter((h) => h.role === role)
  }

  const getMissingAccommodations = () => {
    return hospitality.filter((h) => !h.accommodationConfirmed)
  }

  const getSpecialRequirements = () => {
    const requirements: Record<string, number> = {}
    hospitality.forEach((h) => {
      h.specialRequirements.forEach((req) => {
        requirements[req] = (requirements[req] || 0) + 1
      })
    })
    return Object.entries(requirements).map(([requirement, count]) => ({ requirement, count }))
  }

  const value: HospitalityContextType = {
    hospitality,
    addHospitalityEntry,
    updateHospitalityEntry,
    removeHospitalityEntry,
    getByMealStatus,
    getByRole,
    getMissingAccommodations,
    getSpecialRequirements,
  }

  return (
    <HospitalityContext.Provider value={value}>
      {children}
    </HospitalityContext.Provider>
  )
}

export function useHospitality() {
  const context = useContext(HospitalityContext)
  if (!context) {
    throw new Error('useHospitality must be used within HospitalityProvider')
  }
  return context
}
