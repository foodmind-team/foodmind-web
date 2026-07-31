export type PendingCommand = Readonly<{ payload: string; key: string }>

export function prepareCommand<T>(current: PendingCommand | null, body: T, createKey = () => crypto.randomUUID()): PendingCommand {
  const payload = JSON.stringify(body)
  return current?.payload === payload ? current : { payload, key: createKey() }
}

export function quotedVersion(version: number) {
  return `"${version}"`
}

export function clampCandidateIndex(index: number, candidateCount: number) {
  return Math.max(0, Math.min(index, Math.max(0, candidateCount - 1)))
}

export function usesRecommendationFallback(status?: string, fallbackStatus?: string) {
  return status === 'FALLBACK_SUCCEEDED' || fallbackStatus === 'SUCCEEDED'
}
