import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { HomePage, RecommendationContextPage, RecommendationDetailPage } from './HomeRoutes'
import { RecordComposerPage } from './RecordRoutes'

const origin = 'http://localhost:3000'
const groups = [{ id: 'group-1', name: 'Kitchen Table', description: 'Trusted friends', createdByUserId: 'user-1', status: 'ACTIVE', createdAt: '2026-07-31T00:00:00Z', updatedAt: '2026-07-31T00:00:00Z', version: 0 }]
const references = { cuisines: [], dietaryTags: [], allergens: [], mealTypes: ['DINNER'], placeTypes: [] }
const preferences = { currency: 'SGD', preferredLatitude: 1.284, preferredLongitude: 103.832, maxDistanceKm: 8, cleanlinessPriority: 0, likedCuisineCodes: [], dislikedCuisineCodes: [], dietaryTagCodes: [], allergens: [], preferredMealTypes: ['DINNER'], hardConstraints: { requiredDietaryTagCodes: [], allergens: [] }, version: 1 }
const candidate = (index: number) => ({ candidateId: `candidate-${index}`, placeMealId: `place-meal-${index}`, mealId: `meal-${index}`, mealName: index === 1 ? 'Laksa bowl' : 'Soba set', placeId: `place-${index}`, placeName: index === 1 ? 'Green Lane Kitchen' : 'Nori Table', area: 'Tiong Bahru', price: { amount: 18, currency: 'SGD' }, recommendationType: index === 1 ? 'PERSONAL' as const : 'EXPLORATORY' as const, rank: index, modelScore: index === 1 ? 0.91 : 0.82, reasonCodes: ['WITHIN_BUDGET' as const], explanation: 'ML score confirmed from budget and location inputs.' })
const recommendation = { sessionId: 'session-1', traceId: 'trace-1', status: 'FALLBACK_SUCCEEDED' as const, modelStatus: 'UNAVAILABLE', fallbackStatus: 'SUCCEEDED' as const, fallbackVersion: 'fallback-v1', decisionProfile: { mode: 'GROUP_GUIDED' as const, appliedFactors: ['GROUP_MEMBER_RECORDS' as const], groupMemberEvidenceCount: 3 }, items: [candidate(1), candidate(2)] }

function renderRoute(initialEntry: string, page: React.ReactNode, path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[initialEntry]}><Routes><Route path={path} element={page} /><Route path="/recommendation-context" element={<RecommendationContextPage />} /><Route path="/recommendations/:sessionId" element={<div>Recommendation opened</div>} /><Route path="/records/new" element={<RecordComposerPage />} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>)
}

describe('recommendation decision loop', () => {
  it('edits recommendation context on a dedicated page and applies it to Home', async () => {
    const originalGeolocation = navigator.geolocation
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 1.301, longitude: 103.801 } } as GeolocationPosition) },
    })
    server.use(
      http.get(`${origin}/api/v1/groups`, () => HttpResponse.json(groups)),
      http.get(`${origin}/api/v1/catalogue/reference-data`, () => HttpResponse.json(references)),
      http.get(`${origin}/api/v1/users/me/preferences`, () => HttpResponse.json(preferences)),
    )
    renderRoute('/', <HomePage />, '/')

    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(await screen.findByRole('heading', { name: 'Shape your decision context', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /latitude/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /longitude/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Area' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /maximum spice/i })).not.toBeInTheDocument()

    await userEvent.type(screen.getByRole('spinbutton', { name: 'Maximum budget' }), '42')
    await userEvent.click(screen.getByRole('button', { name: /update current location/i }))
    expect(await screen.findByText('Using your current location for this recommendation only.')).toBeInTheDocument()
    await userEvent.clear(screen.getByRole('spinbutton', { name: /^Maximum distance \(km\)/ }))
    await userEvent.type(screen.getByRole('spinbutton', { name: /^Maximum distance \(km\)/ }), '5')
    await userEvent.click(screen.getByRole('button', { name: /apply context/i }))

    expect(await screen.findByRole('heading', { name: 'Dinner, decided with confidence.', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('SGD 42')).toBeInTheDocument()
    expect(screen.getByText('Within 5 km')).toBeInTheDocument()
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: originalGeolocation })
  })

  it('generates a typed recommendation with an idempotency key', async () => {
    let idempotencyKey = ''
    let generatedBody: { maxBudget?: number; currency?: string; latitude?: number; longitude?: number; maxDistanceKm?: number; constraints?: unknown } = {}
    server.use(
      http.get(`${origin}/api/v1/groups`, () => HttpResponse.json(groups)),
      http.get(`${origin}/api/v1/catalogue/reference-data`, () => HttpResponse.json(references)),
      http.get(`${origin}/api/v1/users/me/preferences`, () => HttpResponse.json(preferences)),
      http.post(`${origin}/api/v1/recommendations/generate`, async ({ request }) => {
        idempotencyKey = request.headers.get('idempotency-key') || ''
        generatedBody = await request.json() as typeof generatedBody
        return HttpResponse.json(recommendation, { status: 201 })
      }),
    )
    renderRoute('/', <HomePage />, '/')
    await userEvent.click(await screen.findByRole('button', { name: /generate recommendation/i }))
    expect(await screen.findByText('Recommendation opened')).toBeInTheDocument()
    expect(idempotencyKey).toMatch(/[0-9a-f-]{36}/)
    expect(generatedBody.maxBudget).toBeUndefined()
    expect(generatedBody.currency).toBeUndefined()
    expect(generatedBody.latitude).toBe(1.284)
    expect(generatedBody.longitude).toBe(103.832)
    expect(generatedBody.maxDistanceKm).toBe(8)
    expect(generatedBody.constraints).toBeUndefined()
  })

  it('omits a saved distance when the profile has no coordinate pair', async () => {
    let generatedBody: { latitude?: number; longitude?: number; maxDistanceKm?: number } = {}
    server.use(
      http.get(`${origin}/api/v1/groups`, () => HttpResponse.json(groups)),
      http.get(`${origin}/api/v1/users/me/preferences`, () => HttpResponse.json({
        ...preferences,
        preferredLatitude: null,
        preferredLongitude: null,
        maxDistanceKm: 8,
      })),
      http.post(`${origin}/api/v1/recommendations/generate`, async ({ request }) => {
        generatedBody = await request.json() as typeof generatedBody
        return HttpResponse.json(recommendation, { status: 201 })
      }),
    )

    renderRoute('/', <HomePage />, '/')
    await userEvent.click(await screen.findByRole('button', { name: /generate recommendation/i }))

    expect(await screen.findByText('Recommendation opened')).toBeInTheDocument()
    expect(generatedBody.latitude).toBeUndefined()
    expect(generatedBody.longitude).toBeUndefined()
    expect(generatedBody.maxDistanceKm).toBeUndefined()
  })

  it('reveals the next returned candidate without a network mutation', async () => {
    let mutationCalls = 0
    server.use(
      http.get(`${origin}/api/v1/groups`, () => HttpResponse.json(groups)),
      http.get(`${origin}/api/v1/recommendations/session-1`, () => HttpResponse.json(recommendation)),
      http.post(`${origin}/api/v1/recommendations/*`, () => { mutationCalls += 1; return HttpResponse.json({}, { status: 201 }) }),
    )
    renderRoute('/recommendations/session-1', <RecommendationDetailPage />, '/recommendations/:sessionId')
    expect(await screen.findByRole('heading', { name: 'Laksa bowl', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('ML match 91%')).toBeInTheDocument()
    expect(screen.getByText('Confirmed ML ranking basis')).toBeInTheDocument()
    expect(screen.queryByText('ML score confirmed from budget and location inputs.')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Informed by people you trust' })).toBeInTheDocument()
    expect(screen.getByText('3 authorized group records supported the returned choices.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try another/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Soba set', level: 1 })).toBeInTheDocument())
    expect(mutationCalls).toBe(0)
  })

  it('accepts the candidate and opens a prefilled meal record', async () => {
    let feedbackBody: Record<string, unknown> = {}
    server.use(
      http.get(`${origin}/api/v1/groups`, () => HttpResponse.json(groups)),
      http.get(`${origin}/api/v1/catalogue/reference-data`, () => HttpResponse.json(references)),
      http.get(`${origin}/api/v1/recommendations/session-1`, () => HttpResponse.json(recommendation)),
      http.post(`${origin}/api/v1/recommendations/session-1/feedback`, async ({ request }) => {
        feedbackBody = await request.json() as Record<string, unknown>
        return HttpResponse.json({ eventType: 'ACCEPTED', candidateId: 'candidate-1' }, { status: 201 })
      }),
    )
    renderRoute('/recommendations/session-1', <RecommendationDetailPage />, '/recommendations/:sessionId')

    await userEvent.click(await screen.findByRole('button', { name: /accept and record meal/i }))

    expect(await screen.findByRole('heading', { name: 'Record what you ate', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Meal name' })).toHaveValue('Laksa bowl')
    expect(screen.getByRole('textbox', { name: 'Place (optional)' })).toHaveValue('Green Lane Kitchen')
    expect(screen.getByRole('spinbutton', { name: 'Price' })).toHaveValue(18)
    expect(screen.getByRole('textbox', { name: 'Currency' })).toHaveValue('SGD')
    expect(screen.getByRole('button', { name: /post meal to explore/i })).toBeInTheDocument()
    expect(feedbackBody).toEqual({ eventType: 'ACCEPTED', candidateId: 'candidate-1' })
  })

  it('confirms the Reject this action, preserves the session, and advances locally', async () => {
    let feedbackBody: Record<string, unknown> = {}
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.use(
      http.get(`${origin}/api/v1/groups`, () => HttpResponse.json(groups)),
      http.get(`${origin}/api/v1/recommendations/session-1`, () => HttpResponse.json(recommendation)),
      http.post(`${origin}/api/v1/recommendations/session-1/feedback`, async ({ request }) => {
        feedbackBody = await request.json() as Record<string, unknown>
        return HttpResponse.json({ eventType: 'REJECTED', reasonCode: 'DO_NOT_RECOMMEND' }, { status: 201 })
      }),
    )
    renderRoute('/recommendations/session-1', <RecommendationDetailPage />, '/recommendations/:sessionId')

    expect(await screen.findByRole('heading', { name: 'Laksa bowl', level: 1 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^reject this$/i }))

    await waitFor(() => expect(feedbackBody).toEqual({
      eventType: 'REJECTED',
      candidateId: 'candidate-1',
      reasonCode: 'DO_NOT_RECOMMEND',
    }))
    expect(confirm).toHaveBeenCalledWith('Hide this meal at this place from all future recommendations? This cannot be undone.')
    expect(await screen.findByRole('heading', { name: 'Soba set', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Hidden from future recommendations. This saved session remains unchanged.')).toBeInTheDocument()
    confirm.mockRestore()
  })
})
