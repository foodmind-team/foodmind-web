import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? error.statusText || 'This page could not be opened.'
    : error instanceof Error
      ? error.message
      : 'This page could not be opened.'
  return (
    <main className="route-error page">
      <AlertTriangle size={36} />
      <p className="eyebrow">A detour, not a dead end</p>
      <h1>FoodMind lost this page.</h1>
      <p>{message}</p>
      <Link className="primary-action" to="/"><ArrowLeft size={17} /> Return home</Link>
    </main>
  )
}
