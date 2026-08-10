import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { InventoryPage } from './InventoryRoutes'

const origin = 'http://localhost:3000'
const lotId = '00000000-0000-4000-8000-000000000601'
const lot = {
  lotId,
  ingredientName: 'Firm tofu',
  quantity: 500,
  reserved: 0,
  available: 500,
  unit: 'g',
  expiryDate: null,
  purchasedAt: '2026-08-10T10:00:00Z',
  createdAt: '2026-08-10T10:00:00Z',
  updatedAt: '2026-08-10T10:00:00Z',
  version: 0,
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter><InventoryPage /></MemoryRouter></ToastProvider></QueryClientProvider>)
}

describe('inventory expiry date', () => {
  it('sends and immediately renders an edited expiry date', async () => {
    const user = userEvent.setup()
    let body: Record<string, unknown> | null = null
    let currentLot = { ...lot, expiryDate: null as string | null }
    server.use(
      http.get(`${origin}/api/v1/inventory/lots`, () => HttpResponse.json({ items: [currentLot], page: 0, size: 100, totalItems: 1, totalPages: 1, hasNext: false })),
      http.put(`${origin}/api/v1/inventory/lots/${lotId}`, async ({ request }) => {
        body = await request.json() as Record<string, unknown>
        currentLot = { ...lot, quantity: 450, available: 450, expiryDate: '2026-08-21', version: 1 }
        return HttpResponse.json(currentLot)
      }),
    )
    renderPage()

    expect(await screen.findByText('No expiry date')).toBeInTheDocument()
    const editButton = screen.getByRole('button', { name: /edit/i })
    const card = editButton.closest('article')!
    await user.click(editButton)
    await user.clear(within(card).getByLabelText('Quantity'))
    await user.type(within(card).getByLabelText('Quantity'), '450')
    fireEvent.change(within(card).getByLabelText('Expiry'), { target: { value: '2026-08-21' } })
    await user.click(within(card).getByRole('button', { name: /^save$/i }))

    expect(body).toEqual({ ingredientName: 'Firm tofu', quantity: 450, unit: 'g', expiryDate: '2026-08-21' })
    expect(await screen.findByText('Expires 2026-08-21')).toBeInTheDocument()
  })
})
