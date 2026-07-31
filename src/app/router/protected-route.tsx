import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { LoadingState } from '../../components/feedback/States'
import { useAuth } from '../providers/AuthProvider'
import { isSafeReturnPath } from '../../lib/api/client'

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'checking') return <main className="auth-check"><LoadingState label="Restoring your FoodMind session…" /></main>
  if (status === 'anonymous') {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { status } = useAuth()
  const [searchParams] = useSearchParams()
  if (status === 'checking') return <main className="auth-check"><LoadingState label="Checking your session…" /></main>
  if (status === 'authenticated') {
    const returnTo = searchParams.get('returnTo')
    return <Navigate to={isSafeReturnPath(returnTo) ? returnTo : '/'} replace />
  }
  return <Outlet />
}
