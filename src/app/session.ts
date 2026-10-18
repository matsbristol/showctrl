import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useCollection, useConfig } from '../data/hooks'
import { createAccess, type Access, type Preview } from '../shared/access'
import { DEFAULT_TZ, EVENT_TYPES } from '../types/constants'
import type { Id, Terms } from '../types/model'

export interface Session {
  /** The signed-in user (in demo mode: the persona being viewed as). */
  me: Id | null
  /** Workspace owner. Always Festival admin. */
  isOwner: boolean
  /** Demo only: switch persona. */
  setMe: (id: Id) => void
  /** An admin previewing the app as a role or stage role. */
  preview: Preview | null
  setPreview: (p: Preview | null) => void
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSession must be used inside <SessionProvider>')
  return s
}

/** Access checks for the current user, recomputed when members, teams, stages or roles change. */
export function useAccess(): Access {
  const { me, isOwner, preview } = useSession()
  const members = useCollection('members')
  const stageteam = useCollection('stageteam')
  const stages = useCollection('stages')
  const roles = useConfig('roles')
  return useMemo(
    () => createAccess({ me, isOwner, preview, members, stageteam, stages, roles }),
    [me, isOwner, preview, members, stageteam, stages, roles],
  )
}

/** The event time zone. */
export function useTz(): string {
  return useConfig('event')?.tz || DEFAULT_TZ
}

/** Labels for performers and stages. Never hard-code "Artist" or "Stage" in UI text. */
export function useTerms(): Terms {
  const cfg = useConfig('event')
  return { ...EVENT_TYPES.festival.terms, ...cfg?.terms }
}

/** Current time, updated every `everyMs`, aligned to whole seconds. */
export function useNow(everyMs = 1000): number {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>
    const tick = () => {
      const n = Date.now()
      setT(n)
      id = setTimeout(tick, everyMs - (n % 1000) + 5)
    }
    id = setTimeout(tick, everyMs - (Date.now() % 1000) + 5)
    return () => clearTimeout(id)
  }, [everyMs])
  return t
}
