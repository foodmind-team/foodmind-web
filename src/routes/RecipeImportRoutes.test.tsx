import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { RecipeImportSessionPage, RecipeImportStartPage } from './RecipeImportRoutes'

const origin = 'http://localhost:3000'
const importId = '00000000-0000-4000-8000-000000000301'
const recipeOneId = '00000000-0000-4000-8000-000000000401'
const recipeTwoId = '00000000-0000-4000-8000-000000000402'
const drafts = [
  { draftId: 'dish-1', name: 'Lemon Pasta', servings: 4, ingredients: ['200 g spaghetti', '1 lemon'], steps: ['Boil the spaghetti.', 'Toss with lemon.'] },
  { draftId: 'dish-2', name: 'Tomato Salad', servings: null, ingredients: ['2 tomatoes'], steps: ['Slice the tomatoes.'] },
]
const question = { questionId: 'dish-2:servings', draftId: 'dish-2', fieldPath: 'servings', prompt: 'How many servings does Tomato Salad make?', responseType: 'TEXT' as const, required: true, suggestedValue: null }
const base = { importId, text: 'Recipe text', createdRecipes: [], failureCode: null, failureMessage: null, completedAt: null, createdAt: '2026-08-09T08:00:00Z', updatedAt: '2026-08-09T08:00:00Z' }
const needs = { ...base, status: 'NEEDS_CLARIFICATION' as const, drafts, questions: [question], answers: [], version: 1 }
const ready = { ...base, status: 'READY' as const, drafts: [drafts[0], { ...drafts[1], servings: 4 }], questions: [], answers: [{ questionId: question.questionId, value: '4' }], version: 2 }
const completed = {
  ...ready,
  status: 'COMPLETED' as const,
  version: 3,
  completedAt: '2026-08-09T08:02:00Z',
  createdRecipes: [
    { id: recipeOneId, name: 'Lemon Pasta', servings: 4, imageUrl: null, tags: [], allergenHints: [], ingredients: drafts[0].ingredients, steps: drafts[0].steps, createdAt: '2026-08-09T08:02:00Z', updatedAt: '2026-08-09T08:02:00Z', version: 0 },
    { id: recipeTwoId, name: 'Tomato Salad', servings: 4, imageUrl: null, tags: [], allergenHints: [], ingredients: drafts[1].ingredients, steps: drafts[1].steps, createdAt: '2026-08-09T08:02:00Z', updatedAt: '2026-08-09T08:02:00Z', version: 0 },
  ],
}

function renderRoutes(initialEntry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="/cooking/import" element={<RecipeImportStartPage />} /><Route path="/cooking/import/:importId" element={<RecipeImportSessionPage />} /><Route path="/cooking" element={<CookingLocation />} /></Routes></MemoryRouter></QueryClientProvider>)
}

function CookingLocation() {
  const location = useLocation()
  return <><h1>Cooking selection</h1><output>{location.search}</output></>
}

describe('natural-language recipe import', () => {
  it('blocks mixed-language text locally with an English error', async () => {
    const user = userEvent.setup()
    let requests = 0
    server.use(http.post(`${origin}/api/v1/recipe-imports`, () => { requests += 1; return HttpResponse.json(needs, { status: 201 }) }))
    renderRoutes('/cooking/import')

    await user.type(screen.getByLabelText('Recipe text'), 'Make 番茄 pasta')
    await user.click(screen.getByRole('button', { name: /parse recipes/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('Please use English only. Chinese or mixed-language input is not supported.')
    expect(requests).toBe(0)
  })

  it('reloads a persisted question, answers it, saves all recipes, and redirects selected IDs', async () => {
    const user = userEvent.setup()
    let answerIfMatch = ''
    let confirmIfMatch = ''
    server.use(
      http.get(`${origin}/api/v1/recipe-imports/${importId}`, () => HttpResponse.json(needs)),
      http.post(`${origin}/api/v1/recipe-imports/${importId}/answers`, async ({ request }) => {
        answerIfMatch = request.headers.get('if-match') || ''
        expect(await request.json()).toEqual({ answers: [{ questionId: question.questionId, value: '4' }] })
        return HttpResponse.json(ready)
      }),
      http.post(`${origin}/api/v1/recipe-imports/${importId}/confirm`, ({ request }) => {
        confirmIfMatch = request.headers.get('if-match') || ''
        return HttpResponse.json(completed)
      }),
    )
    renderRoutes(`/cooking/import/${importId}`)

    expect(await screen.findByText('How many servings does Tomato Salad make?')).toBeInTheDocument()
    expect(screen.getByText('Lemon Pasta')).toBeInTheDocument()
    expect(screen.getAllByText('Tomato Salad')).toHaveLength(2)
    await user.type(screen.getByRole('textbox', { name: question.prompt }), '4')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText('Every recipe is ready to save.')).toBeInTheDocument()
    expect(answerIfMatch).toBe('"1"')
    await user.click(screen.getByRole('button', { name: /save recipes and choose for cooking/i }))

    expect(await screen.findByRole('heading', { name: 'Cooking selection' })).toBeInTheDocument()
    expect(screen.getByText(`?selected=${recipeOneId},${recipeTwoId}`)).toBeInTheDocument()
    expect(confirmIfMatch).toBe('"2"')
  })

  it('creates a durable session before navigating to its URL', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${origin}/api/v1/recipe-imports`, () => HttpResponse.json(needs, { status: 201 })),
      http.get(`${origin}/api/v1/recipe-imports/${importId}`, () => HttpResponse.json(needs)),
    )
    renderRoutes('/cooking/import')

    await user.click(screen.getByRole('button', { name: /use an example/i }))
    await user.click(screen.getByRole('button', { name: /parse recipes/i }))

    await waitFor(() => expect(screen.getByText('A few details will finish these recipes.')).toBeInTheDocument())
  })
})
