import { useMemo, useState, type ReactNode } from 'react'
import type { Preview } from '../access/access'
import { SessionContext, type LiveAccount, type Session } from './hooks'

/**
 * Live session: the signed-in Supabase user. The event's owner is always
 * Festival admin (CLAUDE.md, "Access model"). "View as" previews still work,
 * to check what a role sees; there is no switching to other people.
 */
export function LiveSessionProvider({ uid, isOwner, account, children }: {
  uid: string
  isOwner: boolean
  account: LiveAccount
  children: ReactNode
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const value = useMemo<Session>(() => ({
    mode: 'live',
    viewer: { uid, isOwner, preview },
    live: account,
    setDemoUser: () => {},
    setPreview,
  }), [uid, isOwner, preview, account])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
