import { createContext, useContext, useMemo } from 'react'
import { createAccess, type Access, type Preview, type Viewer } from '../access/access'
import { useSnapshot } from '../data/hooks'

/** Live mode: the signed-in account and the event being worked on. */
export interface LiveAccount {
  email: string
  eventId: string
  signOut(): void
  /** Back to the list of events. */
  switchEvent(): void
}

export interface Session {
  /** 'demo' runs on sample data with a "view as" switcher; 'live' has real sign-in (Supabase). */
  mode: 'demo' | 'live'
  viewer: Viewer
  live?: LiveAccount
  /** Demo mode only: act as another person. Clears any preview. */
  setDemoUser(uid: string): void
  /** "View as" a role or a stage role, to check what someone else sees. Null to stop. */
  setPreview(preview: Preview | null): void
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSession must be used inside <SessionProvider>')
  return s
}

/** Access rules for the current viewer against the latest data. */
export function useAccess(): Access {
  const snap = useSnapshot()
  const { viewer } = useSession()
  return useMemo(() => createAccess(snap, viewer), [snap, viewer])
}
