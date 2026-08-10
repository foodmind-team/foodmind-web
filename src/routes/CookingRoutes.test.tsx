import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { CookingDetailPage } from './CookingRoutes'
import { CookingSelectPage } from './CookingSelectionPage'

vi.mock('../app/providers/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}))

const origin = 'http://localhost:3000'
const planId = '00000000-0000-4000-8000-000000000042'
const taskId = 'task-0a1b2c3d'
const recipeOneId = '00000000-0000-4000-8000-000000000101'
const recipeTwoId = '00000000-0000-4000-8000-000000000102'
const recipePage = {
  items: [
    { id: recipeOneId, name: 'Scrambled Eggs with Tomato', servings: 2, imageUrl: null, tags: ['Weeknight'], allergenHints: ['EGG'], ingredients: ['3 eggs', '200 g tomatoes'], steps: ['Cook the eggs.'], createdAt: '2026-08-02T09:00:00Z', updatedAt: '2026-08-02T09:00:00Z', version: 0 },
    { id: recipeTwoId, name: 'Corn & Rib Soup', servings: 4, imageUrl: null, tags: ['Soup'], allergenHints: [], ingredients: ['500 g pork ribs', '2 corn cobs'], steps: ['Simmer until tender.'], createdAt: '2026-08-02T09:00:00Z', updatedAt: '2026-08-02T09:00:00Z', version: 0 },
  ],
  page: 0, size: 100, totalItems: 2, totalPages: 1, hasNext: false,
}
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

const confirmationPlan = {
  planId,
  status: 'NEEDS_CONFIRMATION',
  createdAt: '2026-08-02T10:00:00Z',
  explanation: 'Some ingredients are missing. Choose a recovery strategy.',
  repairOptions: [
    {
      optionId: 'repair_purchase_broccoli',
      optionType: 'purchase',
      description: "Purchase 90 g of 'Broccoli' (no known substitute available)",
      changes: ['Add broccoli to the shopping list'],
      effects: ['Broccoli shortage resolved'],
      revalidationStatus: 'validated',
    },
    {
      optionId: 'repair_purchase_tomato',
      optionType: 'purchase',
      description: "Purchase 200 g of 'Canned tomatoes' (no known substitute available)",
      changes: ['Add canned tomatoes to the shopping list'],
      effects: ['Tomato shortage resolved'],
      revalidationStatus: 'validated',
    },
    {
      optionId: 'repair_servings_1_abc',
      optionType: 'reduce_servings',
      description: 'Reduce servings from 2 to 1 (available ingredients support ~50% of original portions)',
      changes: ['Scale all ingredient quantities to 1 serving'],
      effects: ['All ingredient shortages resolved by scaling down'],
      revalidationStatus: 'validated',
    },
  ],
  confirmationQuestions: [
    {
      questionId: 'repair:strategy',
      fieldPath: 'repair_strategy',
      prompt: 'Some ingredients are missing. Choose how to continue.',
      responseType: 'CHOICE',
      required: true,
      options: [
        { value: 'repair_servings_1_abc', label: 'Reduce to 1 serving', suggested: true },
        { value: 'repair_purchase_bundle', label: 'Buy missing ingredients', suggested: false },
      ],
    },
    {
      questionId: 'gap:r1-step-1-heat',
      fieldPath: 'recipe.r1.step_1.heat',
      prompt: "The recipe.r1.step_1.heat for recipe 'r1' is missing. Please provide the correct value.",
      responseType: 'TEXT',
      required: true,
      suggestedValue: 'HIGH',
    },
    {
      questionId: 'assumption:r1-text',
      fieldPath: 'recipe.r1.assumptions',
      prompt: 'Assumption: Firm tofu substitutes silken tofu. Accept this suggested value?',
      responseType: 'CHOICE',
      required: true,
      options: [
        { value: 'accept', label: 'Accept suggested value', suggested: true },
        { value: 'provide_alternative', label: 'Provide an alternative value', suggested: false },
      ],
    },
  ],
  decisions: [
    { optionId: 'repair_servings_1_abc', optionType: 'reduce_servings', payload: { servings: 1 }, planRevision: 'p-1:v1' },
    {
      optionId: 'repair_purchase_bundle',
      optionType: 'purchase',
      payload: { items: [{ ingredient_name: 'Broccoli', quantity: 90, unit: 'g' }, { ingredient_name: 'Canned tomatoes', quantity: 200, unit: 'g' }] },
      planRevision: 'p-1:v1',
    },
  ],
}

function renderCookingRoutes(initialEntry = `/cooking?selected=${recipeOneId},${recipeTwoId}`) {
  server.use(http.get(`${origin}/api/v1/recipes`, () => HttpResponse.json(recipePage)))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="/cooking" element={<CookingSelectPage />} /><Route path="/cooking/:planId" element={<CookingDetailPage />} /><Route path="/shopping-lists/:shoppingListId" element={<h1>Shopping list</h1>} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>)
}

describe('cook mode selection page', () => {
  it('lists backend recipes and sends exact recipe IDs to generate-async', async () => {
    const user = userEvent.setup()
    let receivedBody: Record<string, unknown> | null = null
    server.use(
      http.post(`${origin}/api/v1/cooking-plans/generate-async`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>
        receivedBody = body
        expect(request.headers.get('idempotency-key')).toMatch(/[0-9a-f-]{36}/)
        return HttpResponse.json({ planId, taskId, status: 'PROCESSING', location: `/api/v1/cooking-plans/${planId}/task` }, { status: 202 })
      }),
      http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json({ planId, status: 'READY', createdAt: '2026-08-02T10:00:00Z', completedAt: '2026-08-02T10:02:00Z', explanation: 'Done', timeline: [] })),
    )

    renderCookingRoutes()
    expect(screen.getByRole('heading', { name: 'What do you want to cook tonight?' })).toBeInTheDocument()
    expect(await screen.findByText('Scrambled Eggs with Tomato')).toBeInTheDocument()
    expect(screen.getByText('Corn & Rib Soup')).toBeInTheDocument()
    expect(screen.getByText(/dishes selected/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /generate plan/i }))
    expect(await screen.findByRole('heading', { name: 'Your FoodMind cooking plan' })).toBeInTheDocument()
    expect(receivedBody).toMatchObject({ servings: 4, recipeIds: [recipeOneId, recipeTwoId], region: 'SG', requiredDietaryTagCodes: [], avoidAllergenCodes: [] })
    expect(receivedBody).not.toHaveProperty('ingredients')
  })
})

describe('cooking plan async generation', () => {
  it('polls progress, then renders the terminal READY plan with the execution board', async () => {
    vi.useFakeTimers()
    try {
      let planStatus: 'PROCESSING' | 'READY' = 'PROCESSING'
      let polls = 0
      server.use(
        http.post(`${origin}/api/v1/cooking-plans/generate-async`, async ({ request }) => {
          const body = await request.json()
          expect(body).toMatchObject({ recipeIds: [recipeOneId, recipeTwoId], servings: 4 })
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
      await vi.advanceTimersByTimeAsync(100)
      expect(screen.getByText('Scrambled Eggs with Tomato')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /generate plan/i }))

      // Flush the mutation, navigation, and the first plan/task reads.
      await vi.advanceTimersByTimeAsync(100)
      await vi.waitFor(() => {
        expect(screen.getByText('Preparing recipes…')).toBeInTheDocument()
        expect(screen.getByRole('progressbar', { name: 'Cooking plan generation' })).toHaveAttribute('aria-valuenow', '8')
      })

      // Second poll updates the progress copy.
      await vi.advanceTimersByTimeAsync(2000)
      expect(screen.getByText('Solving the schedule')).toBeInTheDocument()
      expect(screen.getByText(/Step 5 of 6/)).toBeInTheDocument()
      expect(screen.getByRole('progressbar', { name: 'Cooking plan generation' })).toHaveAttribute('aria-valuenow', '88')

      // Third poll returns 404 → stop polling and read the terminal READY plan.
      await vi.advanceTimersByTimeAsync(2000)
      expect(screen.getByRole('heading', { name: 'Your FoodMind cooking plan' })).toBeInTheDocument()
      expect(screen.getAllByText('Boil the soba').length).toBeGreaterThan(0)
      expect(polls).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders a terminal FAILED plan when the async submission itself fails', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${origin}/api/v1/cooking-plans/generate-async`, () => HttpResponse.json({ planId, status: 'FAILED', errorCode: 'AGENT_UNREACHABLE', errorMessage: 'Cooking agent is unreachable', createdAt: '2026-08-02T10:00:00Z', completedAt: '2026-08-02T10:00:01Z' }, { status: 200 })),
      http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json({ planId, status: 'FAILED', errorCode: 'AGENT_UNREACHABLE', errorMessage: 'Cooking agent is unreachable', createdAt: '2026-08-02T10:00:00Z', completedAt: '2026-08-02T10:00:01Z' })),
    )

    renderCookingRoutes()
    await user.click(screen.getByRole('button', { name: /generate plan/i }))

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
})

describe('cooking execution progress', () => {
  it('puts the ingredient pull list in the first actionable step and removes duplicate modules', async () => {
    server.use(http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json(readyPlan)))

    renderCookingRoutes(`/cooking/${planId}`)

    expect(await screen.findByRole('heading', { name: '0 of 3 tasks complete' })).toBeInTheDocument()
    const ready = screen.getByRole('heading', { name: /ready to start/i }).closest('section')!
    expect(within(ready).getByText('Gather these ingredients')).toBeInTheDocument()
    expect(within(ready).getByText('Soba')).toBeInTheDocument()
    expect(within(ready).getByText('2 portions')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'All steps in order' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'What to buy and portion.' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'When each dish is ready.' })).not.toBeInTheDocument()
  })

  it('keeps blocked tasks collapsed until the user asks to see them', async () => {
    const user = userEvent.setup()
    server.use(http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json(readyPlan)))

    renderCookingRoutes(`/cooking/${planId}`)

    const blocked = (await screen.findByRole('heading', { name: /blocked/i })).closest('details')!
    expect(blocked).not.toHaveAttribute('open')
    await user.click(within(blocked).getByRole('heading', { name: /blocked/i }))
    expect(blocked).toHaveAttribute('open')
  })

  it('restores completed steps after the plan page is reopened', async () => {
    const user = userEvent.setup()
    server.use(http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json(readyPlan)))
    const first = renderCookingRoutes(`/cooking/${planId}`)

    await user.click(await screen.findByRole('button', { name: /start/i }))
    await user.click(screen.getByRole('button', { name: /complete/i }))
    expect(screen.getByRole('heading', { name: '1 of 3 tasks complete' })).toBeInTheDocument()
    first.unmount()

    renderCookingRoutes(`/cooking/${planId}`)
    expect(await screen.findByRole('heading', { name: '1 of 3 tasks complete' })).toBeInTheDocument()
  })
})

describe('confirmation strategy', () => {
  it('offers a recovery action for a legacy confirmation without structured questions', async () => {
    server.use(
      http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json({
        planId,
        status: 'NEEDS_CONFIRMATION',
        createdAt: '2026-08-02T10:00:00Z',
        confirmationQuestions: [],
        decisions: [],
      })),
    )

    renderCookingRoutes(`/cooking/${planId}`)

    expect(await screen.findByRole('heading', { name: 'This plan needs to be regenerated' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choose recipes again' })).toHaveAttribute('href', '/cooking')
  })

  it('opens a persisted shopping list immediately when purchase is selected', async () => {
    const user = userEvent.setup()
    const shoppingListId = '00000000-0000-4000-8000-000000000202'
    server.use(
      http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json(confirmationPlan)),
      http.post(`${origin}/api/v1/cooking-plans/${planId}/shopping-list`, () => HttpResponse.json({ shoppingListId, sourcePlanId: planId, rootPlanId: planId, originalServings: 4, status: 'OPEN', checkedItemCount: 0, totalItemCount: 2, createdAt: '2026-08-02T10:00:00Z', updatedAt: '2026-08-02T10:00:00Z', version: 0, items: [] }, { status: 201 })),
    )

    renderCookingRoutes(`/cooking/${planId}`)
    expect(await screen.findByRole('heading', { name: 'Your plan needs a decision' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reduce to 1 serving' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buy missing ingredients' })).toBeInTheDocument()
    // Gap/assumption detail questions are hidden when a strategy question exists.
    expect(screen.queryByText(/step_1\.heat.*missing/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Firm tofu substitutes silken tofu/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Buy missing ingredients' }))
    expect(await screen.findByRole('heading', { name: 'Shopping list' })).toBeInTheDocument()
  })

  it('submits portion reduction asynchronously and rechecks inventory', async () => {
    const user = userEvent.setup()
    const childPlanId = '00000000-0000-4000-8000-000000000303'
    let receivedBody: unknown = null
    server.use(
      http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json(confirmationPlan)),
      http.post(`${origin}/api/v1/cooking-plans/${planId}/decisions-async`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({ ...readyPlan, planId: childPlanId })
      }),
      http.get(`${origin}/api/v1/cooking-plans/${childPlanId}`, () => HttpResponse.json({ ...readyPlan, planId: childPlanId })),
    )

    renderCookingRoutes(`/cooking/${planId}`)
    await user.click(await screen.findByRole('button', { name: 'Reduce to 1 serving' }))
    await user.click(screen.getByRole('button', { name: 'Reduce portions and recheck' }))

    expect(receivedBody).toEqual([{ questionId: 'repair:strategy', value: 'repair_servings_1_abc' }])
    expect(await screen.findByRole('heading', { name: 'Your FoodMind cooking plan' })).toBeInTheDocument()
  })

  it('automatically opens shopping when one serving is still short', async () => {
    const shoppingListId = '00000000-0000-4000-8000-000000000404'
    const purchaseOnly = {
      ...confirmationPlan,
      repairOptions: confirmationPlan.repairOptions.filter((option) => option.optionType === 'purchase'),
      confirmationQuestions: [{ ...confirmationPlan.confirmationQuestions[0], options: [{ value: 'repair_purchase_bundle', label: 'Buy missing ingredients', suggested: true }] }],
      decisions: confirmationPlan.decisions.filter((decision) => decision.optionType === 'purchase'),
    }
    server.use(
      http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json(purchaseOnly)),
      http.post(`${origin}/api/v1/cooking-plans/${planId}/shopping-list`, () => HttpResponse.json({ shoppingListId, sourcePlanId: planId, rootPlanId: planId, originalServings: 4, status: 'OPEN', checkedItemCount: 0, totalItemCount: 2, createdAt: '2026-08-02T10:00:00Z', updatedAt: '2026-08-02T10:00:00Z', version: 0, items: [] }, { status: 201 })),
    )

    renderCookingRoutes(`/cooking/${planId}`)
    expect(await screen.findByRole('heading', { name: 'Shopping list' })).toBeInTheDocument()
  })
})

describe('execution board', () => {
  it('starts an available task, completes it, and unblocks the next one', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${origin}/api/v1/cooking-plans/${planId}`, () => HttpResponse.json(readyPlan)),
    )

    renderCookingRoutes(`/cooking/${planId}`)
    expect(await screen.findByRole('heading', { name: 'Your FoodMind cooking plan' })).toBeInTheDocument()

    // Preparation is the first actionable step; cooking waits behind it.
    const startLane = screen.getByRole('heading', { name: /ready to start/i }).closest('section')!
    expect(within(startLane).getByText('Wash the greens')).toBeInTheDocument()
    expect(screen.getByText(/waiting for wash the greens to finish/i)).toBeInTheDocument()

    // Start preparation → it moves to in progress and can be completed.
    await user.click(screen.getByRole('button', { name: /start/i }))
    const progressLane = screen.getByRole('heading', { name: /in progress/i }).closest('section')!
    expect(within(progressLane).getByText('Wash the greens')).toBeInTheDocument()

    await user.click(within(progressLane).getByRole('button', { name: /complete/i }))
    expect(screen.getByText('1 of 3 tasks complete')).toBeInTheDocument()
    // The first cooking task is now ready to start.
    const nextLane = screen.getByRole('heading', { name: /ready to start/i }).closest('section')!
    expect(within(nextLane).getByText('Boil the soba')).toBeInTheDocument()
  })
})
