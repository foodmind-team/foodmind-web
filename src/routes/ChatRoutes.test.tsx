import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { ChatConversationPage } from './ChatRoutes'

const origin = 'http://localhost:3000'
const sessionId = '00000000-0000-4000-8000-000000000041'
const session = { id: sessionId, title: 'Food history helper', status: 'ACTIVE', createdAt: '2026-08-01T12:00:00Z', updatedAt: '2026-08-01T12:00:00Z' }

function renderConversation() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={[`/chat/${sessionId}`]}><Routes><Route path="/chat/:sessionId" element={<ChatConversationPage />} /><Route path="/chat" element={<div>Chat index</div>} /></Routes></MemoryRouter></ToastProvider></QueryClientProvider>)
}

describe('grounded chatbot', () => {
  it('lets the backend select the workflow and displays the grounded response status', async () => {
    const posted = vi.fn()
    let messages: unknown[] = []
    const assistant = { id: 'assistant-1', sessionId, role: 'ASSISTANT', content: 'Your recent meals are mostly nearby lunch options.', responseStatus: 'SUCCEEDED', correlationId: '00000000-0000-4000-8000-000000000099', createdAt: '2026-08-01T12:01:00Z', sources: [], suggestedQuestions: [], suggestedDestinations: [] }
    server.use(
      http.get(`${origin}/api/v1/chat/sessions`, () => HttpResponse.json({ items: [session], page: 0, size: 50, totalElements: 1, totalPages: 1, hasNext: false })),
      http.get(`${origin}/api/v1/chat/sessions/${sessionId}`, () => HttpResponse.json(session)),
      http.get(`${origin}/api/v1/chat/sessions/${sessionId}/messages`, () => HttpResponse.json({ items: messages, nextCursor: null })),
      http.post(`${origin}/api/v1/chat/sessions/${sessionId}/messages`, async ({ request }) => {
        const body = await request.json()
        posted(body)
        messages = [assistant]
        return HttpResponse.json(assistant, { status: 201 })
      }),
    )

    renderConversation()
    const composer = await screen.findByLabelText('Message')
    await userEvent.type(composer, 'Summarise my recent meals')
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => expect(posted).toHaveBeenCalledWith({ content: 'Summarise my recent meals', referenceIds: [], useSessionReferences: false }))
    expect(posted.mock.calls[0][0]).not.toHaveProperty('route')
    expect(await screen.findByText(assistant.content)).toBeInTheDocument()
    expect(screen.getByText('Succeeded')).toBeInTheDocument()
  })
})
