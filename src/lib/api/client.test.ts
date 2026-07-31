import { http, HttpResponse, delay } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  ApiError,
  clearAccessSession,
  dataOrThrow,
  errorMessage,
  getSessionSnapshot,
  isSafeReturnPath,
  refreshAccessSession,
  registerAuthenticationFailureHandler,
  responseError,
  setAccessSession,
  subscribeToSession,
  type Schema,
} from './client'
import { server } from '../../test/server'

const origin = 'http://localhost:3000'
const user: Schema<'CurrentUserResponse'> = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'maya@example.test',
  displayName: 'Maya',
  role: 'USER',
  status: 'ACTIVE',
  timeZone: 'Asia/Singapore',
  version: 1,
  createdAt: '2026-07-31T00:00:00Z',
  updatedAt: '2026-07-31T00:00:00Z',
}

function tokens(token = 'access-token'): Schema<'AuthTokenResponse'> {
  return {
    userId: user.id,
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: 900,
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshToken: 'discarded-refresh-token',
    refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    csrfToken: 'discarded-csrf-token',
  }
}

afterEach(() => {
  registerAuthenticationFailureHandler(null)
  clearAccessSession()
  vi.restoreAllMocks()
})

describe('typed API client', () => {
  it('sends the access token from memory, includes credentials, and creates a correlation ID', async () => {
    setAccessSession(tokens())
    const seen = vi.fn()
    server.use(http.get(`${origin}/api/v1/users/me`, ({ request }) => {
      seen({ authorization: request.headers.get('authorization'), correlation: request.headers.get('x-correlation-id'), credentials: request.credentials })
      return HttpResponse.json(user)
    }))

    const result = await api.GET('/users/me')
    expect(dataOrThrow<Schema<'CurrentUserResponse'>>(result)).toEqual(user)
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ authorization: 'Bearer access-token', credentials: 'include' }))
    expect(seen.mock.calls[0][0].correlation).toMatch(/[0-9a-f-]{36}/)
    expect(localStorage).toHaveLength(0)
    expect(sessionStorage).toHaveLength(0)
  })

  it('shares one refresh across concurrent 401 responses and retries once', async () => {
    setAccessSession(tokens('expired'))
    let refreshCalls = 0
    let protectedCalls = 0
    server.use(
      http.post(`${origin}/api/v1/auth/refresh`, async () => {
        refreshCalls += 1
        await delay(20)
        return HttpResponse.json(tokens('renewed'))
      }),
      http.get(`${origin}/api/v1/users/me`, ({ request }) => {
        protectedCalls += 1
        return request.headers.get('authorization') === 'Bearer renewed'
          ? HttpResponse.json(user)
          : HttpResponse.json({ code: 'AUTHENTICATION_REQUIRED', message: 'Expired' }, { status: 401 })
      }),
    )

    const [first, second] = await Promise.all([api.GET('/users/me'), api.GET('/users/me')])
    expect(dataOrThrow(first)).toEqual(user)
    expect(dataOrThrow(second)).toEqual(user)
    expect(refreshCalls).toBe(1)
    expect(protectedCalls).toBe(4)
  })

  it('retains the caller correlation ID when a request is retried', async () => {
    setAccessSession(tokens('expired'))
    const correlations: string[] = []
    server.use(
      http.post(`${origin}/api/v1/auth/refresh`, () => HttpResponse.json(tokens('renewed'))),
      http.get(`${origin}/api/v1/users/me`, ({ request }) => {
        correlations.push(request.headers.get('x-correlation-id') || '')
        return request.headers.get('authorization') === 'Bearer renewed'
          ? HttpResponse.json(user)
          : HttpResponse.json({ code: 'AUTHENTICATION_REQUIRED', message: 'Expired' }, { status: 401 })
      }),
    )

    const result = await api.GET('/users/me', { headers: { 'X-Correlation-ID': 'caller-correlation' } })
    expect(dataOrThrow(result)).toEqual(user)
    expect(correlations).toEqual(['caller-correlation', 'caller-correlation'])
  })

  it('keeps refresh single-flight when called directly', async () => {
    let calls = 0
    server.use(http.post(`${origin}/api/v1/auth/refresh`, async () => {
      calls += 1
      await delay(20)
      return HttpResponse.json(tokens())
    }))
    expect(await Promise.all([refreshAccessSession(), refreshAccessSession()])).toEqual([true, true])
    expect(calls).toBe(1)
  })

  it('clears the in-memory session when refresh is rejected or unavailable', async () => {
    setAccessSession(tokens())
    server.use(http.post(`${origin}/api/v1/auth/refresh`, () => new HttpResponse(null, { status: 401 })))
    expect(await refreshAccessSession()).toBe(false)
    expect(getSessionSnapshot()).toBeNull()

    setAccessSession(tokens())
    server.use(http.post(`${origin}/api/v1/auth/refresh`, () => HttpResponse.error()))
    expect(await refreshAccessSession()).toBe(false)
    expect(getSessionSnapshot()).toBeNull()
  })

  it('does not recursively refresh authentication endpoints', async () => {
    let refreshCalls = 0
    server.use(
      http.post(`${origin}/api/v1/auth/login`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${origin}/api/v1/auth/refresh`, () => {
        refreshCalls += 1
        return HttpResponse.json(tokens())
      }),
    )
    const result = await api.POST('/auth/login', { body: { email: 'maya@example.test', password: 'incorrect', clientType: 'WEB' } })
    expect(result.response.status).toBe(401)
    expect(refreshCalls).toBe(0)
  })

  it('reports authentication failure when refresh fails or the retried request is still unauthorized', async () => {
    const failure = vi.fn()
    registerAuthenticationFailureHandler(failure)
    server.use(
      http.post(`${origin}/api/v1/auth/refresh`, () => HttpResponse.json(tokens('renewed'))),
      http.get(`${origin}/api/v1/users/me`, () => new HttpResponse(null, { status: 401 })),
    )
    expect((await api.GET('/users/me')).response.status).toBe(401)
    expect(failure).toHaveBeenCalledTimes(1)

    failure.mockClear()
    server.use(http.post(`${origin}/api/v1/auth/refresh`, () => new HttpResponse(null, { status: 401 })))
    expect((await api.GET('/users/me')).response.status).toBe(401)
    expect(failure).toHaveBeenCalledTimes(1)
  })

  it('supports abort signals without converting them into backend errors', async () => {
    server.use(http.get(`${origin}/api/v1/users/me`, async () => {
      await delay(100)
      return HttpResponse.json(user)
    }))
    const controller = new AbortController()
    const pending = api.GET('/users/me', { signal: controller.signal })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await assertion
  })

  it('maps backend errors without exposing raw exceptions', () => {
    const response = new Response('', { status: 400 })
    expect(() => dataOrThrow({ response, error: { code: 'VALIDATION_ERROR', message: 'Check the fields.', fieldErrors: [{ field: 'email', code: 'Email', message: 'Invalid.' }] } })).toThrowError(ApiError)
    try {
      dataOrThrow({ response, error: { code: 'VALIDATION_ERROR', message: 'Check the fields.', fieldErrors: [{ field: 'email', code: 'Email', message: 'Invalid.' }] } })
    } catch (error) {
      expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', fieldErrors: [{ field: 'email' }] })
    }
  })

  it('handles successful empty responses and malformed error bodies', async () => {
    expect(dataOrThrow({ response: new Response(null, { status: 204 }), data: undefined })).toBeUndefined()
    const mapped = await responseError(new Response('not-json', { status: 503 }))
    expect(mapped).toMatchObject({ status: 503, code: 'HTTP_503', message: 'FoodMind is temporarily unavailable. Please try again.' })
  })

  it.each([
    [401, 'Your session has expired.'],
    [403, 'permission'],
    [404, 'no longer available'],
    [409, 'changed while'],
    [429, 'many requests'],
    [500, 'temporarily unavailable'],
    [400, 'could not complete'],
  ])('maps HTTP %i to actionable fallback copy', (status, expected) => {
    expect(new ApiError(new Response(null, { status })).message).toContain(expected)
  })

  it('maps numeric and date Retry-After headers', () => {
    expect(new ApiError(new Response(null, { status: 429, headers: { 'Retry-After': '2' } })).retryAfterMs).toBe(2_000)
    const retryDate = new Date(Date.now() + 5_000).toUTCString()
    expect(new ApiError(new Response(null, { status: 429, headers: { 'Retry-After': retryDate } })).retryAfterMs).toBeGreaterThanOrEqual(0)
  })

  it('notifies subscribers when the memory-only session changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToSession(listener)
    setAccessSession(tokens())
    expect(getSessionSnapshot()).toBeTypeOf('number')
    clearAccessSession()
    unsubscribe()
    setAccessSession(tokens())
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('uses explicit offline and safe generic error messages', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(errorMessage(new Error('hidden'))).toContain('offline')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    expect(errorMessage(new Error('Try again.'))).toBe('Try again.')
    expect(errorMessage(new ApiError(new Response(null, { status: 400 }), { fieldErrors: [{ field: 'currency', code: 'Length', message: 'Use a three-letter currency.' }] }))).toBe('Use a three-letter currency.')
    expect(errorMessage({ unknown: true })).toContain('Something went wrong')
  })
})

describe('return URL validation', () => {
  it.each(['/history', '/records/new?type=food', '/#section'])('accepts same-origin relative path %s', (path) => {
    expect(isSafeReturnPath(path)).toBe(true)
  })

  it.each([null, '', '//evil.example', 'https://evil.example', '/https://evil.example'])('rejects unsafe path %s', (path) => {
    expect(isSafeReturnPath(path)).toBe(false)
  })
})
