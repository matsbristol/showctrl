/*
 * The app root. Loaded on demand so the first paint (an empty page with the
 * strip colour) doesn't wait for the whole bundle.
 */
import { lazy, Suspense } from 'react'

const ShowctrlApp = lazy(() => import('./ShowctrlApp'))

export function Root() {
  return (
    <Suspense fallback={null}>
      <ShowctrlApp />
    </Suspense>
  )
}
