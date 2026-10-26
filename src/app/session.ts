import { createContext, useContext, useMemo } from 'react'
import { useCollection, useConfig } from '../data/hooks'
import { createAccess, type Access, type Preview } from '../shared/access'
import { DEFAULT_TZ, EVENT_TYPES } from '../types/constants'
import type { Id, Terms } from '../types/model'
import { tr } from '../i18n'

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
/** The event's words for performers and stages, in the interface language (custom words stay as typed). */
export function useTerms(): Terms {
  const cfg = useConfig('event')
  const terms = { ...EVENT_TYPES.festival.terms, ...cfg?.terms }
  return { performer: tr(terms.performer), performers: tr(terms.performers), stage: tr(terms.stage), stages: tr(terms.stages) }
}

export { useNow } from './time'
