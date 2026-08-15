import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { HomePage, RecommendationDetailPage } from './HomeRoutes'

const origin = 'http://localhost:3000'
const groups = [{ id: 'group-1', name: 'Kitchen Table', description: 'Trusted friends', createdByUserId: 'user-1', status: 'ACTIVE', createdAt: '2026-07-31T00:00:00Z', updatedAt: '2026-07-31T00:00:00Z', version: 0 }]
const references = { cuisines: [], dietaryTags: [], allergens: [], mealTypes: ['DINNER'], placeTypes: [] }
const preferences = { currency: 'SGD', cleanlinessPriority: 0, likedCuisineCodes: [], dislikedCuisineCodes: [], dietaryTagCodes: [], allergens: [], preferredMealTypes: ['DINNER'], hardConstraints: { requiredDietaryTagCodes: [], allergens: [] }, version: 1 }
const candidate = (index: number) => ({ candidateId: `candidate-${index}`, placeMealId: `place-meal-${index}`, mealId: `meal-${index}`, mealName: index === 1 ? 'Laksa bowl' : 'Soba set', placeId: `place-${index}`, placeName: index === 1 ? 'Green Lane Kitchen' : 'Nori Table', area: 'Tiong Bahru', price: { amount: 18, currency: 'SGD' }, recommendationType: index === 1 ? 'PERSONAL' as const : 'EXPLORATORY' as const, rank: index, modelScore: index === 1 ? 0.91 : 0.82, reasonCodes: ['WITHIN_BUDGET' as const], explanation: 'ML score confirmed from budget and location inputs.' })
const recommendation = { sessionId: 'session-1', traceId: 'trace-1', status: 'FALLBACK_SUCCEEDED' as const, modelStatus: 'UNAVAILABLE', fallbackStatus: 'SUCCEEDED' as const, fallbackVersion: 'fallback-v1', decisionProfile: { mode: 'GROUP_GUIDED' as const, appliedFactors: ['GROUP_MEMBER_RECORDS' as const], groupMemberEvidenceCount: 3 }, items: [candidate(1), candidate(2)] }

function renderRoute(initialEntry: string, page: React.ReactNode, path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[initialEntry]}><Routes><Route path={path} element={page} /><Route path="/recommendations/:sessionId" element={<div>Recommendation opened</div>} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>)
}

describe('recommendation decision loop', () => {
  it('generates a typed recommendation with an idempotency key', async () => {
    let idempotencyKey = ''
    let generatedBody: { maxBudget?: number; currency?: string } = {}
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
    expect(screen.getByRole('heading', { name: 'Informed by people you trust' })).toBeInTheDocument()
    expect(screen.getByText('3 authorized group records supported the returned choices.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try another/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Soba set', level: 1 })).toBeInTheDocument())
    expect(mutationCalls).toBe(0)
  })

  it('confirms a permanent rejection, preserves the session, and advances locally', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: /never recommend this/i }))

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
