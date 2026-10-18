import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../data/hooks'
import type { Preview } from '../shared/access'
import type { Id } from '../types/model'
import { SessionContext, type Session } from './session'

const ME_KEY = 'showctrl-demo-me3'
const DEFAULT_ME = 'demo-admin'

function readMe(): Id {
  try {
    return localStorage.getItem(ME_KEY) || DEFAULT_ME
  } catch {
    return DEFAULT_ME
  }
}

/**
 * Who is using the app. In demo mode the user picks a persona from the sample
 * members. In live mode `initialMe` is the signed-in email and the persona can't change.
 */
export function SessionProvider({ initialMe, isOwner = false, children }: { initialMe?: Id; isOwner?: boolean; children: ReactNode }) {
  const store = useStore()
  const [me, setMeState] = useState<Id>(() => initialMe ?? readMe())
  const [preview, setPreview] = useState<Preview | null>(null)

  useEffect(() => { store.setActor(me) }, [store, me])

  // Demo only: a persona that no longer exists (e.g. after a demo reset) falls back to the admin.
  useEffect(() => {
    if (store.mode !== 'local') return
    return store.subscribe('members', ({ docs }) => {
      if (!docs[me] && docs[DEFAULT_ME]) setMeState(DEFAULT_ME)
    })
  }, [store, me])

  const value = useMemo<Session>(() => ({
    me,
    isOwner,
    preview,
    setPreview,
    setMe: (id: Id) => {
      setMeState(id)
      setPreview(null)
      try { localStorage.setItem(ME_KEY, id) } catch { /* private mode */ }
    },
  }), [me, preview, isOwner])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
