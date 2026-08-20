import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { GroupWorkspacePage } from './GroupRoutes'

vi.mock('../app/providers/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

const origin = 'http://localhost:3000'
const groupId = '00000000-0000-4000-8000-000000000091'
const recordId = '00000000-0000-4000-8000-000000000092'

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/groups/${groupId}`]}>
          <Routes><Route path="/groups/:groupId" element={<GroupWorkspacePage />} /></Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('trusted group feed navigation', () => {
  it('links only named food records to their details with the group return source', async () => {
    server.use(
      http.get(`${origin}/api/v1/groups/${groupId}`, () => HttpResponse.json({
        id: groupId,
        name: 'Kitchen Table',
        description: 'Dinner decisions',
        createdByUserId: 'user-1',
        status: 'ACTIVE',
        createdAt: '2026-08-20T10:00:00Z',
        updatedAt: '2026-08-20T10:00:00Z',
        version: 0,
      })),
      http.get(`${origin}/api/v1/groups/${groupId}/members`, () => HttpResponse.json([
        { userId: 'user-1', displayName: 'Test1', role: 'OWNER', joinedAt: '2026-08-20T10:00:00Z' },
      ])),
      http.get(`${origin}/api/v1/groups/${groupId}/feed`, () => HttpResponse.json({
        items: [
          {
            sourceType: 'FOOD_RECORD',
            sourceId: recordId,
            foodRecordId: recordId,
            actorUserId: 'user-1',
            actorDisplayName: 'Test1',
            occurredAt: '2026-08-20T12:00:00Z',
            mealNameSnapshot: 'Tofu Poke Bowl',
          },
          {
            sourceType: 'RECOMMENDATION_SHARE',
            sourceId: '00000000-0000-4000-8000-000000000093',
            recommendationShareId: '00000000-0000-4000-8000-000000000093',
            recommendationCandidateId: '00000000-0000-4000-8000-000000000094',
            actorUserId: 'user-1',
            actorDisplayName: 'Test1',
            occurredAt: '2026-08-20T11:00:00Z',
            mealNameSnapshot: null,
          },
        ],
        nextCursor: null,
      })),
    )

    renderWorkspace()

    expect(await screen.findByRole('link', { name: 'Open Tofu Poke Bowl food record' })).toHaveAttribute(
      'href',
      `/records/food/${recordId}?fromGroup=${groupId}`,
    )
    expect(screen.getByText('Shared recommendation').closest('article')).toHaveClass('feed-row')
    expect(screen.queryByRole('link', { name: /Shared recommendation/i })).not.toBeInTheDocument()
  })
})
