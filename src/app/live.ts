import { createContext, useContext } from 'react'
import type { EventSummary } from './backend'

/** Present only in live mode: the user's events and a way to switch between them. */
export interface Live {
  events: EventSummary[]
  switchEvent: () => void
}

export const LiveContext = createContext<Live | null>(null)

export function useLive(): Live | null {
  return useContext(LiveContext)
}
