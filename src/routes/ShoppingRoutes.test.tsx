import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { ShoppingListDetailPage } from './ShoppingRoutes'

const origin = 'http://localhost:3000'
const shoppingListId = '00000000-0000-4000-8000-000000000501'
const planId = '00000000-0000-4000-8000-000000000502'
const itemId = '00000000-0000-4000-8000-000000000503'

function shoppingList(checked = false, version = 0) {
  return {
    shoppingListId,
    sourcePlanId: planId,
    rootPlanId: planId,
    originalServings: 4,
    continuationPlanId: null,
    status: 'OPEN',
    checkedItemCount: checked ? 1 : 0,
    totalItemCount: 1,
    createdAt: '2026-08-02T10:00:00Z',
    updatedAt: '2026-08-02T10:00:00Z',
    completedAt: null,
    version,
    items: [{ itemId, sequenceNo: 1, ingredientName: 'Firm tofu', requiredQuantity: 100, purchasedQuantity: 100, unit: 'g', expiryDate: null, checked, version }],
  }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[`/shopping-lists/${shoppingListId}`]}><Routes><Route path="/shopping-lists/:shoppingListId" element={<ShoppingListDetailPage />} /><Route path="/cooking/:planId" element={<h1>Continued Cooking Plan</h1>} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>)
}

describe('persisted shopping list', () => {
  it('shows item quantities, checks the item, completes the list, and continues', async () => {
    const user = userEvent.setup()
    let updateBody: Record<string, unknown> | null = null
    let updateIfMatch: string | null = null
    server.use(
      http.get(`${origin}/api/v1/shopping-lists/${shoppingListId}`, () => HttpResponse.json(shoppingList())),
      http.patch(`${origin}/api/v1/shopping-lists/${shoppingListId}/items/${itemId}`, async ({ request }) => {
        updateBody = await request.json() as Record<string, unknown>
        updateIfMatch = request.headers.get('if-match')
        return HttpResponse.json(shoppingList(true, 1))
      }),
      http.post(`${origin}/api/v1/shopping-lists/${shoppingListId}/complete`, ({ request }) => {
        expect(request.headers.get('idempotency-key')).toMatch(/[0-9a-f-]{36}/)
        return HttpResponse.json({ planId, taskId: 'task-shopping', status: 'PROCESSING', location: `/api/v1/cooking-plans/${planId}/task` }, { status: 202 })
      }),
    )

    renderPage()
    expect(await screen.findByRole('heading', { name: 'Shopping list.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Firm tofu' })).toBeInTheDocument()
    expect(screen.getByText('100 g needed · 100 g planned')).toBeInTheDocument()
    expect(screen.queryByText(/servings/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/expiry/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox'))

    expect(updateBody).toEqual({ checked: true, purchasedQuantity: 100, unit: 'g', expiryDate: null })
    expect(updateIfMatch).toBe('"0"')
    await user.click(await screen.findByRole('button', { name: 'Everything purchased — continue' }))
    expect(await screen.findByRole('heading', { name: 'Continued Cooking Plan' })).toBeInTheDocument()
  })
})
