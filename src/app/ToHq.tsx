import { Navigate, useLocation } from 'react-router-dom'

/** "/" opens Festival HQ. Keeps the #… part, which carries a sign-in link's token. */
export function ToHq() {
  const { hash, search } = useLocation()
  return <Navigate to={{ pathname: '/hq', search, hash }} replace />
}
