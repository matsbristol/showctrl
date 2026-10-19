import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Preview } from '../access/access'
import { useSnapshot } from '../data/hooks'
import { SessionContext, type Session } from './hooks'

/** Remembers which demo person you were viewing as. */
const DEMO_USER_KEY = 'showctrl-react-me'
const DEFAULT_DEMO_USER = 'demo-admin'

function readDemoUser(): string {
  try {
    return localStorage.getItem(DEMO_USER_KEY) || DEFAULT_DEMO_USER
  } catch {
    return DEFAULT_DEMO_USER
  }
}

/**
 * Demo session: no sign-in, you pick a person from the sample festival's
 * members. Real sign-in replaces this provider when the backend arrives;
 * everything below it only sees `Session`.
 */
export function SessionProvider({ children, initialUser }: { children: ReactNode; initialUser?: string }) {
  const snap = useSnapshot()
  const [uid, setUid] = useState(() => initialUser ?? readDemoUser())
  const [preview, setPreview] = useState<Preview | null>(null)

  // If the saved person no longer exists (data was reset), fall back to the admin.
  const effectiveUid = snap.col.members[uid] ? uid : DEFAULT_DEMO_USER

  const setDemoUser = useCallback((next: string) => {
    setUid(next)
    setPreview(null)
    try { localStorage.setItem(DEMO_USER_KEY, next) } catch { /* private mode: not remembered */ }
  }, [])

  const value = useMemo<Session>(() => ({
    mode: 'demo',
    viewer: { uid: effectiveUid, preview },
    setDemoUser,
    setPreview,
  }), [effectiveUid, preview, setDemoUser])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
