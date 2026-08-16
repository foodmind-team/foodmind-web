import { AlertTriangle, CloudOff, Inbox, LoaderCircle, LockKeyhole } from 'lucide-react'
import { ApiError, errorMessage } from '../../lib/api/client'

export function LoadingState({ label = 'Loading FoodMind…' }: { label?: string }) {
  return <div className="state-panel loading-state" role="status"><LoaderCircle className="spin" /><p>{label}</p></div>
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return <div className="state-panel"><Inbox /><h2>{title}</h2><p>{message}</p>{action}</div>
}

export function ErrorState({ error, onRetry, title, message }: { error: unknown; onRetry?: () => void; title?: string; message?: string }) {
  const forbidden = error instanceof ApiError && error.status === 403
  const offline = !navigator.onLine
  const Icon = offline ? CloudOff : forbidden ? LockKeyhole : AlertTriangle
  return (
    <div className="state-panel error-state" role="alert">
      <Icon />
      <h2>{title || (offline ? 'You are offline' : forbidden ? 'This stays private' : 'FoodMind hit a snag')}</h2>
      <p>{message || errorMessage(error)}</p>
      {error instanceof ApiError && error.traceId && <small>Support reference: {error.traceId}</small>}
      {onRetry && <button className="secondary-action" type="button" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function FallbackBanner({ message }: { message: string }) {
  return <div className="fallback-banner" role="status"><AlertTriangle size={18} /><span><strong>Reliable fallback used.</strong> {message}</span></div>
}
