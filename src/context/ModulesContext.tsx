import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export type ModuleType = 'crew' | 'riser-planning' | 'travel' | 'hospitality'

export interface ModuleConfig {
  type: ModuleType
  enabled: boolean
  label: string
}

interface ModulesContextType {
  modules: Record<ModuleType, ModuleConfig>
  toggleModule: (type: ModuleType) => void
  getEnabledModules: () => ModuleType[]
}

const ModulesContext = createContext<ModulesContextType | undefined>(undefined)

export function ModulesProvider({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState<Record<ModuleType, ModuleConfig>>(() => {
    const stored = localStorage.getItem('showctrl_modules')
    if (stored) return JSON.parse(stored)

    return {
      crew: { type: 'crew', enabled: false, label: 'Crew Management' },
      'riser-planning': { type: 'riser-planning', enabled: false, label: 'Riser Planning' },
      travel: { type: 'travel', enabled: false, label: 'Travel Logistics' },
      hospitality: { type: 'hospitality', enabled: false, label: 'Hospitality' },
    }
  })

  useEffect(() => {
    localStorage.setItem('showctrl_modules', JSON.stringify(modules))
  }, [modules])

  const toggleModule = (type: ModuleType) => {
    setModules((prev) => ({
      ...prev,
      [type]: { ...prev[type], enabled: !prev[type].enabled },
    }))
  }

  const getEnabledModules = (): ModuleType[] => {
    return Object.values(modules)
      .filter((m) => m.enabled)
      .map((m) => m.type)
  }

  const value: ModulesContextType = {
    modules,
    toggleModule,
    getEnabledModules,
  }

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>
}

export function useModules() {
  const context = useContext(ModulesContext)
  if (!context) {
    throw new Error('useModules must be used within ModulesProvider')
  }
  return context
}
