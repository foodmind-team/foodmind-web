import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { parsePreferenceCodes } from '../lib/preference-codes'
import { PreferencesPage } from './ProfileRoutes'

const origin = 'http://localhost:3000'
const reference = {
  cuisines: [{ code: 'CHINESE', name: 'Chinese' }, { code: 'INDIAN', name: 'Indian' }],
  dietaryTags: [{ code: 'VEGAN', name: 'Vegan' }],
  allergens: [{ code: 'PEANUT', name: 'Peanut' }],
  mealTypes: ['DINNER'],
  placeTypes: [],
}
const preferences = {
  budgetMin: 5,
  budgetMax: 25,
  currency: 'SGD',
  spiceTolerance: 3,
  preferredArea: 'Central',
  preferredLatitude: 1.28,
  preferredLongitude: 103.83,
  maxDistanceKm: 8,
  cleanlinessPriority: 4,
  minimumCleanlinessEvidenceScore: 0.8,
  foodGoal: 'BALANCED',
  drinkSweetnessPreference: 'LOW',
  drinkIcePreference: 'LESS',
  cookingRegion: 'SG',
  likedCuisineCodes: [],
  dislikedCuisineCodes: [],
  dietaryTagCodes: ['VEGAN'],
  allergens: [{ code: 'PEANUT', severity: 'SEVERE' }],
  preferredMealTypes: ['DINNER'],
  hardConstraints: { requiredDietaryTagCodes: ['VEGAN'], allergens: [{ code: 'PEANUT', severity: 'SEVERE' }] },
  version: 1,
}

function renderPreferences() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter><PreferencesPage /></MemoryRouter></ToastProvider></QueryClientProvider>)
}

describe('preferences form', () => {
  it('normalizes directly entered dietary and allergen codes', () => {
    expect(parsePreferenceCodes(' vegan, Tree Nut;vegan\nsoy ')).toEqual(['VEGAN', 'TREE_NUT', 'SOY'])
  })

  it('removes unused controls, keeps cuisines exclusive, and submits direct inputs', async () => {
    let submitted: Record<string, unknown> | undefined
    server.use(
      http.get(`${origin}/api/v1/users/me/preferences`, () => HttpResponse.json(preferences)),
      http.get(`${origin}/api/v1/catalogue/reference-data`, () => HttpResponse.json(reference)),
      http.put(`${origin}/api/v1/users/me/preferences`, async ({ request }) => {
        submitted = await request.json() as Record<string, unknown>
        return HttpResponse.json({ ...preferences, ...submitted, version: 2 })
      }),
    )
    const user = userEvent.setup()
    renderPreferences()

    expect(await screen.findByRole('heading', { name: 'Preferences', level: 1 })).toBeInTheDocument()
    expect(screen.queryByLabelText('Maximum distance (km)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Food goal')).not.toBeInTheDocument()
    expect(screen.queryByText('Cleanliness evidence')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Preferred latitude')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Preferred longitude')).not.toBeInTheDocument()

    const dietaryInput = screen.getByLabelText(/Required dietary tags/)
    const allergenInput = screen.getByLabelText(/Allergens/)
    expect(dietaryInput).toHaveValue('VEGAN')
    expect(allergenInput).toHaveValue('PEANUT')

    const likedChinese = within(screen.getByRole('group', { name: 'Liked cuisines' })).getByRole('checkbox', { name: 'Chinese' })
    const dislikedChinese = within(screen.getByRole('group', { name: 'Disliked cuisines' })).getByRole('checkbox', { name: 'Chinese' })
    await user.click(likedChinese)
    expect(likedChinese).toBeChecked()
    expect(dislikedChinese).not.toBeChecked()
    await user.click(dislikedChinese)
    expect(dislikedChinese).toBeChecked()
    expect(likedChinese).not.toBeChecked()

    await user.clear(dietaryInput)
    await user.type(dietaryInput, 'vegan, pescatarian; vegan')
    await user.clear(allergenInput)
    await user.type(allergenInput, 'peanut, tree nut')
    await user.click(screen.getByRole('button', { name: /Save preferences/ }))

    await waitFor(() => expect(submitted).toBeDefined())
    expect(submitted).toEqual({
      budgetMin: 5,
      budgetMax: 25,
      currency: 'SGD',
      spiceTolerance: 3,
      preferredArea: 'Central',
      drinkSweetnessPreference: 'LOW',
      drinkIcePreference: 'LESS',
      cookingRegion: 'SG',
      likedCuisineCodes: [],
      dislikedCuisineCodes: ['CHINESE'],
      dietaryTagCodes: ['VEGAN', 'PESCATARIAN'],
      preferredMealTypes: ['DINNER'],
      allergens: [
        { code: 'PEANUT', severity: 'SEVERE' },
        { code: 'TREE_NUT', severity: 'MODERATE' },
      ],
    })
    expect(submitted).not.toHaveProperty('maxDistanceKm')
    expect(submitted).not.toHaveProperty('foodGoal')
    expect(submitted).not.toHaveProperty('cleanlinessPriority')
    expect(submitted).not.toHaveProperty('minimumCleanlinessEvidenceScore')
    expect(submitted).not.toHaveProperty('preferredLatitude')
    expect(submitted).not.toHaveProperty('preferredLongitude')
  })
})

