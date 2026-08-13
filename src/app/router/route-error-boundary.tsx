import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { isStaleChunkError } from '../../lib/chunk-recovery'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const staleChunk = isStaleChunkError(error)
  const message = staleChunk
    ? 'A new FoodMind version was deployed while this page was open. Reload the latest version to continue.'
    : isRouteErrorResponse(error)
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
      {staleChunk && <button className="primary-action" type="button" onClick={() => window.location.reload()}><RefreshCw size={17} /> Reload latest version</button>}
      <Link className={staleChunk ? 'secondary-action' : 'primary-action'} to="/"><ArrowLeft size={17} /> Return home</Link>
    </main>
  )
}
