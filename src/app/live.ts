import { createContext, useContext } from 'react'
import type { EventSummary } from './backend'

/** Present only in live mode: the user's events, a way to switch between them, and their name. */
export interface Live {
  events: EventSummary[]
  switchEvent: () => void
  /** The name they go by, or null until they give one. */
  name: string | null
  setName: (name: string) => Promise<void>
}

export const LiveContext = createContext<Live | null>(null)

export function useLive(): Live | null {
  return useContext(LiveContext)
}
