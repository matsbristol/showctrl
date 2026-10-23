import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface DepartmentStatusConfig {
  department: string
  selectedStages: string[]
  selectedPerformers: string[]
}

interface DepartmentStatusContextType {
  configs: DepartmentStatusConfig[]
  getConfig: (department: string) => DepartmentStatusConfig
  updateConfig: (department: string, config: Partial<DepartmentStatusConfig>) => void
}

const DepartmentStatusContext = createContext<DepartmentStatusContextType | undefined>(undefined)

export function DepartmentStatusProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<DepartmentStatusConfig[]>(() => {
    const stored = localStorage.getItem('showctrl_department_status')
    if (stored) return JSON.parse(stored)

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

    return DEPARTMENTS.map((dept) => ({
      department: dept,
      selectedStages: [],
      selectedPerformers: [],
    }))
  })

  useEffect(() => {
    localStorage.setItem('showctrl_department_status', JSON.stringify(configs))
  }, [configs])

  const getConfig = (department: string): DepartmentStatusConfig => {
    return (
      configs.find((c) => c.department === department) || {
        department,
        selectedStages: [],
        selectedPerformers: [],
      }
    )
  }

  const updateConfig = (department: string, updates: Partial<DepartmentStatusConfig>) => {
    setConfigs((prev) => {
      const existing = prev.find((c) => c.department === department)
      if (existing) {
        return prev.map((c) =>
          c.department === department ? { ...c, ...updates } : c
        )
      }
      return [
        ...prev,
        {
          department,
          selectedStages: [],
          selectedPerformers: [],
          ...updates,
        },
      ]
    })
  }

  const value: DepartmentStatusContextType = {
    configs,
    getConfig,
    updateConfig,
  }

  return (
    <DepartmentStatusContext.Provider value={value}>{children}</DepartmentStatusContext.Provider>
  )
}

export function useDepartmentStatus() {
  const context = useContext(DepartmentStatusContext)
  if (!context) {
    throw new Error('useDepartmentStatus must be used within DepartmentStatusProvider')
  }
  return context
}
