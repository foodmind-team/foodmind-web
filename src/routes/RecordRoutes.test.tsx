import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { RecordComposerPage, RecordDetailPage } from './RecordRoutes'

const origin = 'http://localhost:3000'
const recordId = '00000000-0000-4000-8000-000000000081'
const assetId = '00000000-0000-4000-8000-000000000082'

function renderDetail(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/records/food/${recordId}${search}`]}>
          <Routes>
            <Route path="/records/:recordType/:id" element={<RecordDetailPage />} />
            <Route path="/groups/:groupId" element={<div>Group workspace opened</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

function renderComposer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/records/new?type=food&mealName=Laksa+bowl&placeName=Green+Lane+Kitchen&price=18&currency=SGD&sessionId=session-1&candidateId=candidate-1']}>
          <Routes>
            <Route path="/records/new" element={<RecordComposerPage />} />
            <Route path="/explore" element={<div>Explore post opened</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('record detail image', () => {
  it('shows the saved authorized image and an unavailable state after a load failure', async () => {
    const imageUrl = 'https://foodmind-private.s3.ap-southeast-1.amazonaws.com/media/record.png'
    server.use(http.get(`${origin}/api/v1/food-records/${recordId}`, () => HttpResponse.json({
      id: recordId,
      mealNameSnapshot: 'Laksa',
      occurredAt: '2026-08-01T12:00:00Z',
      price: null,
      rating: 4,
      comment: null,
      wouldEatAgain: true,
      visibility: 'PRIVATE',
      groupId: null,
      mediaAssetId: assetId,
      imageUrl,
      canManage: false,
      createdAt: '2026-08-01T12:00:00Z',
      updatedAt: '2026-08-01T12:00:00Z',
      version: 0,
    })))

    renderDetail()
    const image = await screen.findByRole('img', { name: 'Uploaded image for Laksa' })

    expect(image).toHaveAttribute('src', imageUrl)
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(screen.queryByRole('button', { name: 'Delete image' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit record' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByText(/this group record is read-only/i)).toBeInTheDocument()

    fireEvent.error(image)

    expect(await screen.findByText('Image unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Uploaded image for Laksa' })).not.toBeInTheDocument()
  })

  it('removes an owned image from the detail after the backend confirms deletion', async () => {
    server.use(
      http.get(`${origin}/api/v1/food-records/${recordId}`, () => HttpResponse.json({
        id: recordId,
        mealNameSnapshot: 'Laksa',
        occurredAt: '2026-08-01T12:00:00Z',
        price: null,
        rating: 4,
        comment: null,
        wouldEatAgain: true,
        visibility: 'GROUP',
        groupId: 'group-1',
        mediaAssetId: assetId,
        imageUrl: 'https://foodmind-private.s3.ap-southeast-1.amazonaws.com/media/record.png',
        canManage: true,
        createdAt: '2026-08-01T12:00:00Z',
        updatedAt: '2026-08-01T12:00:00Z',
        version: 0,
      })),
      http.delete(`${origin}/api/v1/media/${assetId}`, () => new HttpResponse(null, { status: 204 })),
    )

    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete image' }))
    await userEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Delete image' }))

    expect(await screen.findByText('The stored image asset has been deleted.')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Uploaded image for Laksa' })).not.toBeInTheDocument()
  })
})

describe('record detail navigation', () => {
  it('returns to the originating trusted group', async () => {
    server.use(http.get(`${origin}/api/v1/food-records/${recordId}`, () => HttpResponse.json({
      id: recordId,
      mealNameSnapshot: 'Laksa',
      occurredAt: '2026-08-01T12:00:00Z',
      price: null,
      rating: 4,
      comment: null,
      wouldEatAgain: true,
      visibility: 'GROUP',
      groupId: 'group-1',
      canManage: false,
      createdAt: '2026-08-01T12:00:00Z',
      updatedAt: '2026-08-01T12:00:00Z',
      version: 0,
    })))

    renderDetail('?fromGroup=group-1')

    const backLink = await screen.findByRole('link', { name: 'Back to group' })
    expect(backLink).toHaveAttribute('href', '/groups/group-1')
    await userEvent.click(backLink)
    expect(await screen.findByText('Group workspace opened')).toBeInTheDocument()
  })
})

describe('recommendation record handoff', () => {
  it('posts the prefilled meal for a trusted group and opens it in Explore', async () => {
    let postedBody: Record<string, unknown> = {}
    server.use(
      http.get(`${origin}/api/v1/groups`, () => HttpResponse.json([{ id: 'group-1', name: 'Kitchen Table', status: 'ACTIVE' }])),
      http.get(`${origin}/api/v1/catalogue/reference-data`, () => HttpResponse.json({ cuisines: [], dietaryTags: [], allergens: [], mealTypes: [], placeTypes: [] })),
      http.post(`${origin}/api/v1/food-records`, async ({ request }) => {
        postedBody = await request.json() as Record<string, unknown>
        return HttpResponse.json({
          id: recordId,
          mealNameSnapshot: 'Laksa bowl',
          placeNameSnapshot: 'Green Lane Kitchen',
          occurredAt: '2026-08-17T12:00:00Z',
          price: { amount: 18, currency: 'SGD' },
          rating: null,
          comment: null,
          wouldEatAgain: null,
          visibility: 'GROUP',
          groupId: 'group-1',
          createdAt: '2026-08-17T12:00:00Z',
          updatedAt: '2026-08-17T12:00:00Z',
          version: 0,
        }, { status: 201 })
      }),
    )
    renderComposer()

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Who can see this in Explore?' }), 'GROUP')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Group' }), 'group-1')
    await userEvent.click(screen.getByRole('button', { name: /post meal to explore/i }))

    expect(await screen.findByText('Explore post opened')).toBeInTheDocument()
    await waitFor(() => expect(postedBody).toMatchObject({
      mealNameSnapshot: 'Laksa bowl',
      placeNameSnapshot: 'Green Lane Kitchen',
      price: 18,
      currency: 'SGD',
      visibility: 'GROUP',
      groupId: 'group-1',
    }))
  })
})
