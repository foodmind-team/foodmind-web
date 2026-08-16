import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { RecordDetailPage } from './RecordRoutes'

const origin = 'http://localhost:3000'
const recordId = '00000000-0000-4000-8000-000000000081'
const assetId = '00000000-0000-4000-8000-000000000082'

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/records/food/${recordId}`]}>
          <Routes><Route path="/records/:recordType/:id" element={<RecordDetailPage />} /></Routes>
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
      createdAt: '2026-08-01T12:00:00Z',
      updatedAt: '2026-08-01T12:00:00Z',
      version: 0,
    })))

    renderDetail()
    const image = await screen.findByRole('img', { name: 'Uploaded image for Laksa' })

    expect(image).toHaveAttribute('src', imageUrl)
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')

    fireEvent.error(image)

    expect(await screen.findByText('Image unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Uploaded image for Laksa' })).not.toBeInTheDocument()
  })
})
