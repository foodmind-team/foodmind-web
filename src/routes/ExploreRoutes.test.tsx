import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  it('offers only the For you and Group records feeds', async () => {
    const requestUrls: string[] = []
    server.use(http.get(`${origin}/api/v1/explore`, ({ request }) => {
      requestUrls.push(request.url)
      return HttpResponse.json({ items: [], nextCursor: null, hasNext: false })
    }))

    renderExplore()

    expect(screen.getByRole('button', { name: 'For you' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Group records' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Products' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Places' })).not.toBeInTheDocument()
    for (const removedFilter of ['All topics', 'Quick dinner', 'Group-tested', 'Cooking', 'Cafés']) {
      expect(screen.queryByRole('button', { name: removedFilter })).not.toBeInTheDocument()
    }

    await userEvent.click(screen.getByRole('button', { name: 'Group records' }))
    await waitFor(() => expect(requestUrls.some((url) => new URL(url).searchParams.get('types') === 'FOOD_RECORD')).toBe(true))
  })

  it('uses the Backend-owned image reference for a curated place', async () => {
    const placeId = 'ff90c8dc-7fe3-50c6-aaf0-8ea10f73c782'
    const imageReference = `/api/v1/catalogue-images/${placeId}`
    server.use(http.get(`${origin}/api/v1/explore`, () => HttpResponse.json({
      items: [{
        sourceType: 'CURATED_PLACE',
        sourceId: placeId,
        title: 'Udon Don Bar',
        subtitle: 'NUS University Town',
        snippet: null,
        imageReference,
        visibility: 'CURATED',
        occurredAt: null,
      }],
      nextCursor: null,
      hasNext: false,
    })))

    const view = renderExplore()
    await screen.findByRole('button', { name: 'Preview Udon Don Bar' })

    expect(view.container.querySelector(`img[src="${imageReference}"]`)).toBeInTheDocument()
  })

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

  it('renders a no-referrer signed image and falls back when it expires or fails', async () => {
    const imageUrl = 'https://foodmind-private.s3.ap-southeast-1.amazonaws.com/media/signed.png'
    server.use(http.get(`${origin}/api/v1/explore`, () => HttpResponse.json({
      items: [{
        sourceType: 'GROUP_RECORD',
        sourceId: recordId,
        title: 'Image-backed lunch',
        subtitle: null,
        snippet: 'Visible only to the authorised group.',
        imageReference: imageUrl,
        visibility: 'GROUP',
        occurredAt: '2026-08-01T12:00:00Z',
      }],
      nextCursor: null,
      hasNext: false,
    })))

    const view = renderExplore()
    await screen.findByRole('button', { name: 'Preview Image-backed lunch' })
    const image = view.container.querySelector(`img[src="${imageUrl}"]`)

    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')

    fireEvent.error(image!)

    await waitFor(() => {
      expect(view.container.querySelector(`img[src="${imageUrl}"]`)).not.toBeInTheDocument()
      expect(view.container.querySelector('.post-shape')).toBeInTheDocument()
    })
  })
})
