import createClient from 'openapi-fetch'
import type { components, paths } from './generated/schema'

export type Schema<Name extends keyof components['schemas']> = components['schemas'][Name]
export type ApiErrorBody = Schema<'ApiErrorResponse'>
export type AuthTokenResponse = Schema<'AuthTokenResponse'>

type SessionListener = () => void

let accessToken: string | null = null
let expiresAt: number | null = null
let refreshPromise: Promise<boolean> | null = null
let authenticationFailureHandler: (() => void) | null = null
const sessionListeners = new Set<SessionListener>()
const authPaths = new Set(['/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/logout', '/api/v1/auth/logout-all'])

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly traceId?: string
  readonly fieldErrors: ApiErrorBody['fieldErrors']
  readonly retryAfterMs?: number

  constructor(response: Response, payload?: Partial<ApiErrorBody>) {
    super(payload?.message || defaultMessage(response.status))
    this.name = 'ApiError'
    this.status = response.status
    this.code = payload?.code || `HTTP_${response.status}`
    this.traceId = payload?.traceId
    this.fieldErrors = payload?.fieldErrors || []
    const retryAfter = response.headers.get('retry-after')
    if (retryAfter) {
      const seconds = Number(retryAfter)
      this.retryAfterMs = Number.isFinite(seconds)
        ? seconds * 1000
        : Math.max(0, Date.parse(retryAfter) - Date.now())
    }
  }
}

function defaultMessage(status: number) {
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to view this.'
  if (status === 404) return 'This item is no longer available.'
  if (status === 409) return 'This changed while you were working. Review the latest version.'
  if (status === 429) return 'FoodMind is receiving many requests. Please try again shortly.'
  if (status >= 500) return 'FoodMind is temporarily unavailable. Please try again.'
  return 'We could not complete that request.'
}

function notifySessionListeners() {
  sessionListeners.forEach((listener) => listener())
}

export function setAccessSession(tokens: AuthTokenResponse) {
  accessToken = tokens.accessToken
  expiresAt = Date.parse(tokens.expiresAt)
  notifySessionListeners()
}

export function clearAccessSession() {
  accessToken = null
  expiresAt = null
  notifySessionListeners()
}

export function subscribeToSession(listener: SessionListener) {
  sessionListeners.add(listener)
  return () => sessionListeners.delete(listener)
}

export function getSessionSnapshot() {
  return expiresAt
}

export function registerAuthenticationFailureHandler(handler: (() => void) | null) {
  authenticationFailureHandler = handler
}

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) return input.url
  const origin = globalThis.location?.origin || 'http://localhost'
  return new URL(input.toString(), origin).toString()
}

function sessionRequest(input: RequestInfo | URL, init?: RequestInit) {
  const request = input instanceof Request
    ? new Request(input, init)
    : new Request(requestUrl(input), init)
  const headers = new Headers(request.headers)
  if (!headers.has('X-Correlation-ID')) headers.set('X-Correlation-ID', crypto.randomUUID())
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return new Request(request, { headers, credentials: 'include' })
}

async function readErrorPayload(response: Response) {
  try {
    return (await response.clone().json()) as Partial<ApiErrorBody>
  } catch {
    return undefined
  }
}

async function performRefresh() {
  try {
    const response = await globalThis.fetch(requestUrl('/api/v1/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': crypto.randomUUID(),
      },
      body: JSON.stringify({ clientType: 'WEB' }),
    })
    if (!response.ok) {
      clearAccessSession()
      return false
    }
    setAccessSession((await response.json()) as AuthTokenResponse)
    return true
  } catch {
    clearAccessSession()
    return false
  }
}

export function refreshAccessSession() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const request = sessionRequest(input, init)
  const retrySource = request.clone()
  let response = await globalThis.fetch(request)
  const path = new URL(request.url).pathname

  if (response.status === 401 && !authPaths.has(path)) {
    const refreshed = await refreshAccessSession()
    if (refreshed) {
      response = await globalThis.fetch(sessionRequest(retrySource))
      if (response.status === 401) authenticationFailureHandler?.()
    } else {
      authenticationFailureHandler?.()
    }
  }

  return response
}

export const api = createClient<paths>({
  baseUrl: new URL('/api/v1', globalThis.location?.origin || 'http://localhost').toString().replace(/\/$/, ''),
  credentials: 'include',
  fetch: authenticatedFetch,
})

export function dataOrThrow<T>(result: {
  data?: T
  error?: unknown
  response: Response
}): T {
  if (result.error !== undefined || !result.response.ok) {
    const payload = result.error && typeof result.error === 'object'
      ? (result.error as Partial<ApiErrorBody>)
      : undefined
    throw new ApiError(result.response, payload)
  }
  return result.data as T
}

export async function responseError(response: Response) {
  return new ApiError(response, await readErrorPayload(response))
}

export function errorMessage(error: unknown) {
  if (!navigator.onLine) return 'You appear to be offline. Reconnect and try again.'
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export function isSafeReturnPath(value: string | null): value is string {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//') && !value.includes('://'))
}
