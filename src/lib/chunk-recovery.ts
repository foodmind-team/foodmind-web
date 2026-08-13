const RECOVERY_KEY = 'foodmind:stale-chunk-recovery'

const STALE_CHUNK_MESSAGES = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'Unable to preload CSS',
]

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '')
  return STALE_CHUNK_MESSAGES.some((candidate) => message.includes(candidate))
}

function failureKey(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown chunk')
}

export function installChunkRecovery({
  target = window,
  storage = window.sessionStorage,
  reload = () => window.location.reload(),
}: {
  target?: Window
  storage?: Storage
  reload?: () => void
} = {}): () => void {
  const recover = (event: Event) => {
    const error = (event as VitePreloadErrorEvent).payload
    if (!isStaleChunkError(error)) return

    const key = failureKey(error)
    if (storage.getItem(RECOVERY_KEY) === key) return

    storage.setItem(RECOVERY_KEY, key)
    event.preventDefault()
    reload()
  }

  target.addEventListener('vite:preloadError', recover)
  return () => target.removeEventListener('vite:preloadError', recover)
}
