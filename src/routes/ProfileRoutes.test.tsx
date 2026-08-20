import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../components/feedback/ToastProvider'
import { server } from '../test/server'
import { PreferencesPage } from './ProfileRoutes'

const origin = 'http://localhost:3000'
const preferences = {
  budgetMin: 8,
  budgetMax: 30,
  currency: 'SGD',
  preferredArea: 'Orchard',
  preferredLatitude: 1.284,
  preferredLongitude: 103.832,
  maxDistanceKm: 8,
  cleanlinessPriority: 2,
  minimumCleanlinessEvidenceScore: 0.8,
  likedCuisineCodes: [],
  dislikedCuisineCodes: [],
  dietaryTagCodes: [],
  allergens: [],
  preferredMealTypes: ['DINNER'],
  hardConstraints: { requiredDietaryTagCodes: [], allergens: [] },
  version: 1,
}
const references = { cuisines: [], dietaryTags: [], allergens: [], mealTypes: ['DINNER'], placeTypes: [] }

function renderPreferences() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider><MemoryRouter><PreferencesPage /></MemoryRouter></ToastProvider>
    </QueryClientProvider>,
  )
}

describe('account preferences', () => {
  it('uses device location without exposing coordinate or area inputs', async () => {
    const originalGeolocation = navigator.geolocation
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 1.31, longitude: 103.81 } } as GeolocationPosition) },
    })
    let submitted: Record<string, unknown> = {}
    server.use(
      http.get(`${origin}/api/v1/users/me/preferences`, () => HttpResponse.json(preferences)),
      http.get(`${origin}/api/v1/catalogue/reference-data`, () => HttpResponse.json(references)),
      http.put(`${origin}/api/v1/users/me/preferences`, async ({ request }) => {
        submitted = await request.json() as Record<string, unknown>
        return HttpResponse.json({ ...preferences, ...submitted, version: 2 })
      }),
    )

    renderPreferences()

    expect(await screen.findByRole('heading', { name: 'Preferences', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /latitude/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /longitude/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /preferred area/i })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Priority' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /update current location/i }))
    expect(await screen.findByText('Current location is ready and will be saved with your preferences.')).toBeInTheDocument()
    await userEvent.clear(screen.getByRole('spinbutton', { name: /^Maximum distance \(km\)/ }))
    await userEvent.type(screen.getByRole('spinbutton', { name: /^Maximum distance \(km\)/ }), '6')
    await userEvent.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => expect(submitted.preferredLatitude).toBe(1.31))
    expect(submitted.preferredLongitude).toBe(103.81)
    expect(submitted.maxDistanceKm).toBe(6)
    expect(submitted.preferredArea).toBeUndefined()
    expect(submitted.cleanlinessPriority).toBe(2)
    expect(submitted.minimumCleanlinessEvidenceScore).toBe(0.8)
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: originalGeolocation })
  })
})
