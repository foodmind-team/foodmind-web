import type { Page, Request as PlaywrightRequest, Route } from '@playwright/test'

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`
const now = '2026-07-31T12:00:00Z'

export const recommendation = {
  sessionId: id('91'), traceId: 'trace-e2e', status: 'SUCCEEDED', modelStatus: 'SUCCEEDED', modelVersion: 'model-e2e',
  fallbackStatus: 'NOT_REQUIRED', fallbackVersion: 'fallback-v1', createdAt: now, completedAt: now,
  items: [
    { candidateId: id('92'), placeMealId: id('93'), mealId: id('94'), mealName: 'Garden chicken rice', placeId: id('95'), placeName: 'Orchard Garden Kitchen', area: 'Orchard', price: { amount: 9.5, currency: 'SGD' }, recommendationType: 'PERSONAL', rank: 1, reasonCodes: ['WITHIN_BUDGET', 'CUISINE_MATCH'], explanation: 'Fits your budget and recent preferences.' },
    { candidateId: id('96'), placeMealId: id('97'), mealId: id('98'), mealName: 'Miso mushroom noodles', placeId: id('99'), placeName: 'Noodle Common', area: 'Somerset', price: { amount: 12, currency: 'SGD' }, recommendationType: 'EXPLORATORY', rank: 2, reasonCodes: ['NOT_RECENTLY_REPEATED'], explanation: 'A nearby option that adds variety.' },
  ],
}

const user = { id: id('1'), email: 'maya@example.test', displayName: 'Maya Tan', role: 'USER', status: 'ACTIVE', timeZone: 'Asia/Singapore', version: 1, createdAt: now, updatedAt: now }
const tokens = { userId: user.id, accessToken: 'synthetic-access-token', tokenType: 'Bearer', expiresIn: 900, expiresAt: '2099-07-31T12:15:00Z', refreshToken: 'synthetic-refresh', refreshTokenExpiresAt: '2099-08-31T12:00:00Z', csrfToken: 'synthetic-csrf' }
const groups = [{ id: id('11'), name: 'Friday Food Friends', description: 'Trusted dinner crew', status: 'ACTIVE', ownerUserId: user.id, currentUserRole: 'OWNER', memberCount: 3, version: 1, createdAt: now, updatedAt: now }]
const reference = { cuisines: [], dietaryTags: [{ id: id('21'), code: 'VEGETARIAN', name: 'Vegetarian' }], allergens: [{ id: id('22'), code: 'PEANUT', name: 'Peanut' }], mealTypes: ['BREAKFAST', 'LUNCH', 'DINNER'], placeTypes: ['CAFE', 'CASUAL_DINING'] }
const preferences = { cuisineCodes: [], dietaryTagCodes: [], allergens: [], hardConstraints: { requiredDietaryTagCodes: [], allergens: [] }, preferredMealTypes: ['DINNER'], spiceTolerance: 2, budgetMin: 8, budgetMax: 30, currency: 'SGD', preferredArea: 'Orchard', maxDistanceKm: 5, minimumCleanlinessEvidenceScore: 0.8, version: 1 }

type MockOptions = { authenticated?: boolean; onGenerate?: (request: PlaywrightRequest) => void }

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) })
}

export async function mockApi(page: Page, options: MockOptions = {}) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v1', '')
    const method = request.method()

    if (path === '/auth/refresh' && method === 'POST') {
      return options.authenticated === false
        ? fulfill(route, { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in required.', fieldErrors: [] }, 401)
        : fulfill(route, tokens)
    }
    if (path === '/users/me' && method === 'GET') return fulfill(route, user)
    if (path === '/groups' && method === 'GET') return fulfill(route, groups)
    if (path === '/catalogue/reference-data' && method === 'GET') return fulfill(route, reference)
    if (path === '/users/me/preferences' && method === 'GET') return fulfill(route, preferences)
    if (path === '/history' && method === 'GET') return fulfill(route, { entries: [], nextCursor: null })
    if (path === '/explore' && method === 'GET') return fulfill(route, { items: [], nextCursor: null })
    if (path === '/search' && method === 'GET') return fulfill(route, { items: [], nextCursor: null, page: 0, size: 18, totalElements: 0, totalPages: 0, hasNext: false })
    if (path === '/want-to-try' && method === 'GET') return fulfill(route, { items: [], page: 0, size: 24, totalElements: 0, totalPages: 0, hasNext: false })
    if (path === '/cooking-plans/history' && method === 'GET') return fulfill(route, { items: [], page: 0, size: 8, totalElements: 0, totalPages: 0, hasNext: false })
    if (path === '/chat/sessions' && method === 'GET') return fulfill(route, { items: [], page: 0, size: 50, totalElements: 0, totalPages: 0, hasNext: false })
    if (path === '/dashboard' && method === 'GET') return fulfill(route, { empty: true, metrics: [], spendingTotals: [] })
    if (path === '/recommendations/history' && method === 'GET') return fulfill(route, { items: [], page: 0, size: 5, totalElements: 0, totalPages: 0, hasNext: false })
    if (path === '/recommendations/generate' && method === 'POST') {
      options.onGenerate?.(request)
      return fulfill(route, recommendation)
    }
    if (path === `/recommendations/${recommendation.sessionId}` && method === 'GET') return fulfill(route, recommendation)
    if (path.includes('/feedback') && method === 'POST') return fulfill(route, { accepted: true })
    if (path === '/want-to-try' && method === 'POST') return fulfill(route, { id: id('101') }, 201)
    return fulfill(route, { code: 'NOT_FOUND', message: `No synthetic fixture for ${method} ${path}`, fieldErrors: [] }, 404)
  })
}
