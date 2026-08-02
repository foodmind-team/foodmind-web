import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { ExplorePage } from './ExploreRoutes'

const origin = 'http://localhost:3000'
const recordId = '00000000-0000-4000-8000-000000000051'

function renderExplore() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/explore']}>
          <Routes><Route path="/explore" element={<ExplorePage />} /></Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Explore discovery preview', () => {
  it('opens an accessible preview without losing the full detail destination', async () => {
    server.use(http.get(`${origin}/api/v1/explore`, () => HttpResponse.json({
      items: [{
        sourceType: 'GROUP_RECORD',
        sourceId: recordId,
        title: 'Hainanese chicken rice',
        subtitle: 'Tried by the lunch group',
        snippet: 'Tender chicken, fragrant rice, and a balanced chilli sauce.',
        imageReference: null,
        visibility: 'GROUP',
        occurredAt: '2026-08-01T12:00:00Z',
      }],
      nextCursor: null,
      hasNext: false,
    })))

    renderExplore()
    await userEvent.click(await screen.findByRole('button', { name: 'Preview Hainanese chicken rice' }))

    const dialog = screen.getByRole('dialog', { name: 'Hainanese chicken rice' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open full details/i })).toHaveAttribute('href', `/records/food/${recordId}`)

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
