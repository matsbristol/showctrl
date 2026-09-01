import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export type TimelineItemType = 'cue' | 'transition' | 'performer-entry' | 'technical' | 'break'

export interface TimelineItem {
  id: string
  name: string
  description?: string
  startTime: number // Unix timestamp or offset from show start
  duration: number // milliseconds
  department: string
  performers: string[]
  notes?: string
  type: TimelineItemType
}

export interface RunOfShow {
  id: string
  eventId: string
  name: string
  items: TimelineItem[]
  createdAt: number
  updatedAt: number
}

interface RunOfShowContextType {
  currentRunOfShow: RunOfShow | null
  createRunOfShow: (eventId: string, name: string) => void
  addTimelineItem: (item: Omit<TimelineItem, 'id'>) => void
  updateTimelineItem: (id: string, updates: Partial<TimelineItem>) => void
  deleteTimelineItem: (id: string) => void
  reorderItems: (fromIndex: number, toIndex: number) => void
  getTotalDuration: () => number
  getItemCountdown: (itemId: string, currentTime: number) => number
}

const RunOfShowContext = createContext<RunOfShowContextType | undefined>(undefined)

export function RunOfShowProvider({ children }: { children: ReactNode }) {
  const [currentRunOfShow, setCurrentRunOfShow] = useState<RunOfShow | null>(() => {
    const stored = localStorage.getItem('showctrl_runofshow')
    if (stored) return JSON.parse(stored)

    // Seed data for testing
    return {
      id: 'ros-demo',
      eventId: 'event-1',
      name: 'Summer Festival 2026 - Main Stage',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [
        {
          id: 'item-1',
          name: 'Doors Open',
          type: 'cue',
          description: 'House opens, audience entry begins',
          startTime: 0,
          duration: 900000, // 15 mins
          department: 'venue',
          performers: [],
          notes: 'Full capacity: 5000 people'
        },
        {
          id: 'item-2',
          name: 'Opening Act - The Echoes',
          type: 'performer-entry',
          description: 'First performance of the day',
          startTime: 900000,
          duration: 1800000, // 30 mins
          department: 'stage',
          performers: ['The Echoes'],
          notes: 'Sound check at 10 mins before'
        },
        {
          id: 'item-3',
          name: 'Set Change & Tech',
          type: 'technical',
          description: 'Stage reset for headliner',
          startTime: 2700000,
          duration: 600000, // 10 mins
          department: 'technical',
          performers: [],
          notes: 'Lighting reset, stage setup'
        },
        {
          id: 'item-4',
          name: 'Headliner - Aurora',
          type: 'performer-entry',
          description: 'Main headline act',
          startTime: 3300000,
          duration: 3600000, // 60 mins
          department: 'stage',
          performers: ['Aurora'],
          notes: 'VIP meet & greet after show'
        },
        {
          id: 'item-5',
          name: 'Closing & House Clear',
          type: 'break',
          description: 'Event wrap-up',
          startTime: 6900000,
          duration: 900000, // 15 mins
          department: 'venue',
          performers: [],
          notes: 'Expected completion 8:45 PM'
        }
      ]
    }
  })

  // Persist to localStorage
  useEffect(() => {
    if (currentRunOfShow) {
      localStorage.setItem('showctrl_runofshow', JSON.stringify(currentRunOfShow))
    }
  }, [currentRunOfShow])

  const createRunOfShow = (eventId: string, name: string) => {
    const newRunOfShow: RunOfShow = {
      id: `ros-${Date.now()}`,
      eventId,
      name,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setCurrentRunOfShow(newRunOfShow)
  }

  const addTimelineItem = (item: Omit<TimelineItem, 'id'>) => {
    if (!currentRunOfShow) return

    const newItem: TimelineItem = {
      ...item,
      id: `item-${Date.now()}`,
    }

    setCurrentRunOfShow({
      ...currentRunOfShow,
      items: [...currentRunOfShow.items, newItem],
      updatedAt: Date.now(),
    })
  }

  const updateTimelineItem = (id: string, updates: Partial<TimelineItem>) => {
    if (!currentRunOfShow) return

    setCurrentRunOfShow({
      ...currentRunOfShow,
      items: currentRunOfShow.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
      updatedAt: Date.now(),
    })
  }

  const deleteTimelineItem = (id: string) => {
    if (!currentRunOfShow) return

    setCurrentRunOfShow({
      ...currentRunOfShow,
      items: currentRunOfShow.items.filter((item) => item.id !== id),
      updatedAt: Date.now(),
    })
  }

  const reorderItems = (fromIndex: number, toIndex: number) => {
    if (!currentRunOfShow) return

    const items = [...currentRunOfShow.items]
    const [movedItem] = items.splice(fromIndex, 1)
    items.splice(toIndex, 0, movedItem)

    setCurrentRunOfShow({
      ...currentRunOfShow,
      items,
      updatedAt: Date.now(),
    })
  }

  const getTotalDuration = (): number => {
    if (!currentRunOfShow || currentRunOfShow.items.length === 0) return 0

    const lastItem = currentRunOfShow.items[currentRunOfShow.items.length - 1]
    return lastItem.startTime + lastItem.duration
  }

  const getItemCountdown = (itemId: string, currentTime: number): number => {
    if (!currentRunOfShow) return 0

    const item = currentRunOfShow.items.find((i) => i.id === itemId)
    if (!item) return 0

    return item.startTime - currentTime
  }

  const value: RunOfShowContextType = {
    currentRunOfShow,
    createRunOfShow,
    addTimelineItem,
    updateTimelineItem,
    deleteTimelineItem,
    reorderItems,
    getTotalDuration,
    getItemCountdown,
  }

  return (
    <RunOfShowContext.Provider value={value}>{children}</RunOfShowContext.Provider>
  )
}

export function useRunOfShow() {
  const context = useContext(RunOfShowContext)
  if (!context) {
    throw new Error('useRunOfShow must be used within RunOfShowProvider')
  }
  return context
}
