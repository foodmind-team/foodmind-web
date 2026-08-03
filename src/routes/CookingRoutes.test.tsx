import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { CookingDetailPage, CookingPage } from './CookingRoutes'

const origin = 'http://localhost:3000'
const planId = '00000000-0000-4000-8000-000000000042'
const taskId = 'task-0a1b2c3d'
const references = { cuisines: [], dietaryTags: [], allergens: [], mealTypes: ['DINNER'], placeTypes: [] }
const emptyHistory = { items: [], page: 0, size: 8, totalItems: 0, totalPages: 0, hasNext: false }
const readyPlan = {
  planId,
  status: 'READY',
  createdAt: '2026-08-02T10:00:00Z',
  completedAt: '2026-08-02T10:02:00Z',
  solverStatus: 'OPTIMAL',
  makespanMinutes: 54,
  region: 'SG',
  explanation: 'A balanced weeknight dinner.',
  sources: [{ sequenceNo: 1, sourceType: 'CATALOGUE', targetServings: 2, dishName: 'Soba salad' }],
  timeline: [
    { taskId: 'task-1', instruction: 'Boil the soba', startMinute: 0, durationMinutes: 8, workMode: 'ACTIVE' },
    { taskId: 'task-2', instruction: 'Rest and dress', startMinute: 8, durationMinutes: 4, workMode: 'PASSIVE' },
  ],
  miseEnPlace: [{ sequenceNo: 1, instruction: 'Wash the greens', ingredient: 'Greens', durationMinutes: 3 }],
  dishCompletions: [{ dishId: 'dish-1', completionMinute: 54, taskCount: 2, isShared: false }],
  completionChecklist: [{ completionItemId: 'c-1', ingredientName: 'Soba', allocations: [{ inventoryLotId: 'lot-1', quantity: 2, unit: 'portions' }] }],
  assumptions: [{ text: 'Firm tofu substitutes silken tofu.', sourceType: 'pantry' }],
}

function renderCookingRoutes(initialEntry = '/cooking') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="/cooking" element={<CookingPage />} /><Route path="/cooking/:planId" element={<CookingDetailPage />} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>)
}

describe('cooking plan async generation', () => {
  it('submits async, polls progress, then renders the terminal plan once polling returns 404', async () => {
    vi.useFakeTimers()
    try {
      let planStatus: 'PROCESSING' | 'READY' = 'PROCESSING'
      let polls = 0
      server.use(
        http.get(`${origin}/api/v1/catalogue/reference-data`, () => HttpResponse.json(references)),
        http.get(`${origin}/api/v1/cooking-plans/history`, () => HttpResponse.json(emptyHistory)),
        http.post(`${origin}/api/v1/cooking-plans/generate-async`, async ({ request }) => {
          const body = await request.json()
          expect(body).toHaveProperty('ingredients')
          expect(request.headers.get('idempotency-key')).toMatch(/[0-9a-f-]{36}/)
          return HttpResponse.json({ planId, taskId, status: 'PROCESSING', location: `/api/v1/cooking-plans/${planId}/task` }, { status: 202 })
        }),
        http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json(planStatus === 'PROCESSING' ? { planId, status: 'PROCESSING', createdAt: '2026-08-02T10:00:00Z' } : readyPlan)),
        http.get(`${origin}/api/v1/cooking-plans/${planId}/task`, () => {
          polls += 1
          if (polls === 1) return HttpResponse.json({ planId, taskId, status: 'PROCESSING', syncState: 'POLLING', progress: { node: 'assemble_request', completedSteps: 2, message: null } })
          if (polls === 2) return HttpResponse.json({ planId, taskId, status: 'PROCESSING', syncState: 'POLLING', progress: { node: 'solve_schedule', completedSteps: 7, message: 'Solving the schedule' } })
          planStatus = 'READY'
          return HttpResponse.json({ code: 'PLAN_NOT_FOUND', message: 'Plan is no longer processing' }, { status: 404 })
        }),
      )

      renderCookingRoutes()
      fireEvent.change(screen.getByPlaceholderText('e.g. firm tofu'), { target: { value: 'Firm tofu' } })
      fireEvent.click(screen.getByRole('button', { name: /generate in background/i }))

      // Flush the mutation, navigation, and the first plan/task reads.
      await vi.advanceTimersByTimeAsync(100)
      expect(screen.getByText('Assembling your cooking request…')).toBeInTheDocument()
      expect(screen.getByText('2 steps completed')).toBeInTheDocument()

      // Second poll updates the progress copy.
      await vi.advanceTimersByTimeAsync(2000)
      expect(screen.getByText('Solving the schedule')).toBeInTheDocument()
      expect(screen.getByText('7 steps completed')).toBeInTheDocument()

      // Third poll returns 404 → stop polling and read the terminal READY plan.
      await vi.advanceTimersByTimeAsync(2000)
      expect(screen.getByRole('heading', { name: 'Your FoodMind cooking plan' })).toBeInTheDocument()
      expect(screen.getByText('Boil the soba')).toBeInTheDocument()
      expect(polls).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders a terminal FAILED plan when the async submission itself fails', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${origin}/api/v1/catalogue/reference-data`, () => HttpResponse.json(references)),
      http.get(`${origin}/api/v1/cooking-plans/history`, () => HttpResponse.json(emptyHistory)),
      http.post(`${origin}/api/v1/cooking-plans/generate-async`, () => HttpResponse.json({ planId, status: 'FAILED', errorCode: 'AGENT_UNREACHABLE', errorMessage: 'Cooking agent is unreachable', createdAt: '2026-08-02T10:00:00Z', completedAt: '2026-08-02T10:00:01Z' }, { status: 200 })),
      http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json({ planId, status: 'FAILED', errorCode: 'AGENT_UNREACHABLE', errorMessage: 'Cooking agent is unreachable', createdAt: '2026-08-02T10:00:00Z', completedAt: '2026-08-02T10:00:01Z' })),
    )

    renderCookingRoutes()
    await user.type(await screen.findByPlaceholderText('e.g. firm tofu'), 'Firm tofu')
    await user.click(screen.getByRole('button', { name: /generate in background/i }))

    expect(await screen.findByText('A plan could not be completed')).toBeInTheDocument()
    expect(screen.getByText('Cooking agent is unreachable')).toBeInTheDocument()
  })

  it('cancels an in-flight generation and shows the FAILED(TASK_CANCELLED) terminal state', async () => {
    const user = userEvent.setup()
    let planStatus: 'PROCESSING' | 'FAILED' = 'PROCESSING'
    server.use(
      http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json(planStatus === 'PROCESSING' ? { planId, status: 'PROCESSING', createdAt: '2026-08-02T10:00:00Z' } : { planId, status: 'FAILED', errorCode: 'TASK_CANCELLED', errorMessage: 'Task cancelled by user', createdAt: '2026-08-02T10:00:00Z', completedAt: '2026-08-02T10:01:00Z' })),
      http.get(`${origin}/api/v1/cooking-plans/${planId}/task`, () => HttpResponse.json({ planId, taskId, status: 'PROCESSING', syncState: 'POLLING', progress: { node: 'solve_schedule', completedSteps: 7, message: null } })),
      http.post(`${origin}/api/v1/cooking-plans/${planId}/cancel`, () => {
        planStatus = 'FAILED'
        return HttpResponse.json({ planId, status: 'FAILED', errorCode: 'TASK_CANCELLED', errorMessage: 'Task cancelled by user', createdAt: '2026-08-02T10:00:00Z', completedAt: '2026-08-02T10:01:00Z' }, { status: 200 })
      }),
    )

    renderCookingRoutes(`/cooking/${planId}`)
    expect(await screen.findByRole('heading', { name: 'Building your cooking plan' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel this generation/i }))

    expect(await screen.findByText('Cooking plan cancelled')).toBeInTheDocument()
    expect(screen.getByText(/You cancelled this generation/)).toBeInTheDocument()
  })

  it('treats a 409 cancel as already terminal and re-reads the plan', async () => {
    const user = userEvent.setup()
    let planStatus: 'PROCESSING' | 'READY' = 'PROCESSING'
    server.use(
      http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json(planStatus === 'PROCESSING' ? { planId, status: 'PROCESSING', createdAt: '2026-08-02T10:00:00Z' } : readyPlan)),
      http.get(`${origin}/api/v1/cooking-plans/${planId}/task`, () => HttpResponse.json({ planId, taskId, status: 'PROCESSING', syncState: 'POLLING', progress: { node: 'solve_schedule', completedSteps: 7, message: null } })),
      http.post(`${origin}/api/v1/cooking-plans/${planId}/cancel`, () => {
        planStatus = 'READY'
        return HttpResponse.json({ code: 'TASK_NOT_CANCELLABLE', message: 'Plan is no longer processing' }, { status: 409 })
      }),
    )

    renderCookingRoutes(`/cooking/${planId}`)
    expect(await screen.findByRole('heading', { name: 'Building your cooking plan' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel this generation/i }))

    expect(await screen.findByRole('heading', { name: 'Your FoodMind cooking plan' })).toBeInTheDocument()
  })

  it('keeps the synchronous generate flow working with an idempotency key', async () => {
    const user = userEvent.setup()
    let idempotencyKey = ''
    server.use(
      http.get(`${origin}/api/v1/catalogue/reference-data`, () => HttpResponse.json(references)),
      http.get(`${origin}/api/v1/cooking-plans/history`, () => HttpResponse.json(emptyHistory)),
      http.post(`${origin}/api/v1/cooking-plans/generate`, ({ request }) => {
        idempotencyKey = request.headers.get('idempotency-key') || ''
        return HttpResponse.json(readyPlan, { status: 201 })
      }),
      http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json(readyPlan)),
    )

    renderCookingRoutes()
    await user.type(await screen.findByPlaceholderText('e.g. firm tofu'), 'Firm tofu')
    await user.click(screen.getByRole('button', { name: /generate cooking plan/i }))

    expect(await screen.findByRole('heading', { name: 'Your FoodMind cooking plan' })).toBeInTheDocument()
    expect(idempotencyKey).toMatch(/[0-9a-f-]{36}/)
  })
})
