import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface Stage {
  id: string
  name: string
  location: string
  capacity: number
  setup: string
  notes?: string
}

interface StagesContextType {
  stages: Stage[]
  addStage: (stage: Omit<Stage, 'id'>) => void
  updateStage: (id: string, updates: Partial<Stage>) => void
  removeStage: (id: string) => void
  getStageName: (id: string) => string | undefined
}

const StagesContext = createContext<StagesContextType | undefined>(undefined)

export function StagesProvider({ children }: { children: ReactNode }) {
  const [stages, setStages] = useState<Stage[]>(() => {
    const stored = localStorage.getItem('showctrl_stages')
    if (stored) return JSON.parse(stored)

    return [
      { id: 'main', name: 'Main Stage', location: 'Center', capacity: 5000, setup: '40x20m', notes: 'Primary performance area' },
      { id: 'secondary', name: 'Secondary Stage', location: 'West Wing', capacity: 2000, setup: '25x15m' },
      { id: 'vip-lounge', name: 'VIP Lounge', location: 'North', capacity: 200, setup: '15x12m', notes: 'Intimate performances' },
      { id: 'outdoor', name: 'Outdoor Area', location: 'South Lawn', capacity: 1000, setup: 'Open air' },
    ]
  })

  useEffect(() => {
    localStorage.setItem('showctrl_stages', JSON.stringify(stages))
  }, [stages])

  const addStage = (stage: Omit<Stage, 'id'>) => {
    const newStage: Stage = {
      ...stage,
      id: `stage-${Date.now()}`,
    }
    setStages((prev) => [...prev, newStage])
  }

  const updateStage = (id: string, updates: Partial<Stage>) => {
    setStages((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      )
    )
  }

  const removeStage = (id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id))
  }

  const getStageName = (id: string) => {
    return stages.find((s) => s.id === id)?.name
  }

  const value: StagesContextType = {
    stages,
    addStage,
    updateStage,
    removeStage,
    getStageName,
  }

  return <StagesContext.Provider value={value}>{children}</StagesContext.Provider>
}

export function useStages() {
  const context = useContext(StagesContext)
  if (!context) {
    throw new Error('useStages must be used within StagesProvider')
  }
  return context
}
