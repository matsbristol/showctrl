/*
 * Picks which app to load. /legacy/* runs the September app untouched;
 * everything else is the port of the prototype. Both load on demand, so
 * each one's global CSS never reaches the other.
 */
import { lazy, Suspense } from 'react'

const ShowctrlApp = lazy(() => import('./ShowctrlApp'))
const LegacyRoot = lazy(() => import('../legacy/LegacyRoot'))

const isLegacyPath = (path: string) => path === '/legacy' || path.startsWith('/legacy/')

export function Root() {
  return (
    <Suspense fallback={null}>
      {isLegacyPath(location.pathname) ? <LegacyRoot /> : <ShowctrlApp />}
    </Suspense>
  )
}
