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
export const group = { id: id('11'), name: 'Friday Food Friends', description: 'Trusted dinner crew', status: 'ACTIVE', createdByUserId: user.id, version: 1, createdAt: now, updatedAt: now }
const groups = [group]
const members = [{ userId: user.id, displayName: user.displayName, role: 'OWNER', joinedAt: now }, { userId: id('12'), displayName: 'Noah Lim', role: 'MEMBER', joinedAt: now }]
const reference = { cuisines: [], dietaryTags: [{ id: id('21'), code: 'VEGETARIAN', name: 'Vegetarian' }], allergens: [{ id: id('22'), code: 'PEANUT', name: 'Peanut' }], mealTypes: ['BREAKFAST', 'LUNCH', 'DINNER'], placeTypes: ['CAFE', 'CASUAL_DINING'] }
const preferences = { cuisineCodes: [], dietaryTagCodes: [], allergens: [], hardConstraints: { requiredDietaryTagCodes: [], allergens: [] }, preferredMealTypes: ['DINNER'], spiceTolerance: 2, budgetMin: 8, budgetMax: 30, currency: 'SGD', preferredArea: 'Orchard', maxDistanceKm: 5, minimumCleanlinessEvidenceScore: 0.8, version: 1 }
const foodRecord = { id: id('31'), mealNameSnapshot: 'Hainanese chicken rice', placeNameSnapshot: 'Orchard Garden Kitchen', cuisineCode: 'SINGAPOREAN', cuisineName: 'Singaporean', occurredAt: '2026-07-30T12:30:00Z', price: { amount: 9.5, currency: 'SGD' }, rating: 4.5, comment: null, wouldEatAgain: true, visibility: 'PRIVATE', groupId: null, mediaAssetId: null, createdAt: now, updatedAt: now, version: 1 }
const drinkRecord = { id: id('32'), drinkName: 'Iced matcha latte', shopNameSnapshot: 'Orchard Tea Bar', occurredAt: '2026-07-29T07:15:00Z', price: { amount: 5.8, currency: 'SGD' }, rating: 4, comment: null, sweetnessLevel: 2, iceLevel: 1, wouldBuyAgain: true, visibility: 'PRIVATE', groupId: null, mediaAssetId: null, createdAt: now, updatedAt: now, version: 1 }
const metrics = [
  { code: 'FOOD_COUNT', label: 'Food records', period: '2026-07-13', value: 5, unit: 'COUNT', empty: false },
  { code: 'DRINK_COUNT', label: 'Drink records', period: '2026-07-13', value: 3, unit: 'COUNT', empty: false },
  { code: 'FOOD_COUNT', label: 'Food records', period: '2026-07-20', value: 7, unit: 'COUNT', empty: false },
  { code: 'DRINK_COUNT', label: 'Drink records', period: '2026-07-20', value: 4, unit: 'COUNT', empty: false },
  { code: 'MEAN_RATING', label: 'Mean rating', period: '2026-07-20', value: 4.3, unit: 'RATING', samples: 11, empty: false },
  { code: 'REPEAT_FREQUENCY', label: 'Repeat frequency', period: '2026-07-20', value: 0.64, unit: 'RATE', samples: 11, empty: false },
  { code: 'ACCEPTANCE_RATE', label: 'Acceptance rate', period: '2026-07-20', value: 0.72, unit: 'RATE', samples: 18, empty: false },
  { code: 'REJECTION_RATE', label: 'Rejection rate', period: '2026-07-20', value: 0.28, unit: 'RATE', samples: 18, empty: false },
  { code: 'CUISINE_DISTRIBUTION', label: 'Cuisine distribution', period: '2026-07-20', value: 6, unit: 'COUNT', dimension: 'SINGAPOREAN', dimensionLabel: 'Singaporean', empty: false },
  { code: 'CUISINE_DISTRIBUTION', label: 'Cuisine distribution', period: '2026-07-20', value: 3, unit: 'COUNT', dimension: 'JAPANESE', dimensionLabel: 'Japanese', empty: false },
  { code: 'SELECTED_CANDIDATE_TYPE', label: 'Selected candidate type', period: '2026-07-20', value: 7, unit: 'COUNT', dimension: 'PERSONAL', dimensionLabel: 'Personal', empty: false },
  { code: 'REJECTION_REASON', label: 'Rejection reason', period: '2026-07-20', value: 3, unit: 'COUNT', dimension: 'TOO_FAR', dimensionLabel: 'Too far', empty: false },
] as const
const spendingTotals = [
  { code: 'SPENDING_TOTAL', label: 'Spending total', period: '2026-07-13', value: 78.4, unit: 'MONEY', currency: 'SGD', dimension: 'SGD', empty: false },
  { code: 'SPENDING_TOTAL', label: 'Spending total', period: '2026-07-20', value: 92.7, unit: 'MONEY', currency: 'SGD', dimension: 'SGD', empty: false },
  { code: 'SPENDING_TOTAL', label: 'Spending total', period: '2026-07-13', value: 14, unit: 'MONEY', currency: 'USD', dimension: 'USD', empty: false },
  { code: 'SPENDING_TOTAL', label: 'Spending total', period: '2026-07-20', value: 19, unit: 'MONEY', currency: 'USD', dimension: 'USD', empty: false },
] as const

type MockOptions = {
  authenticated?: boolean
  populated?: boolean
  legacyJoinOnly?: boolean
  preferenceFieldError?: boolean
  onGenerate?: (request: PlaywrightRequest) => void
  onGroupUpdate?: (request: PlaywrightRequest) => void
  onLegacyJoin?: (request: PlaywrightRequest) => void
}

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
    if (path === '/users/me/preferences' && method === 'PUT') return options.preferenceFieldError
      ? fulfill(route, { code: 'VALIDATION_FAILED', message: 'Check your preference fields.', fieldErrors: [{ field: 'currency', message: 'Use a supported three-letter currency code.' }] }, 422)
      : fulfill(route, { ...preferences, ...request.postDataJSON(), version: 2, updatedAt: now })
    if (path === '/group-invitations/join' && method === 'POST') return options.legacyJoinOnly
      ? fulfill(route, { code: 'NOT_FOUND', message: 'Compatibility route required.', fieldErrors: [] }, 404)
      : fulfill(route, members[1])
    if (path === '/groups/join' && method === 'POST') { options.onLegacyJoin?.(request); return fulfill(route, members[1]) }
    if (path === `/groups/${group.id}` && method === 'GET') return fulfill(route, group)
    if (path === `/groups/${group.id}` && method === 'PATCH') {
      options.onGroupUpdate?.(request)
      return fulfill(route, { ...group, ...request.postDataJSON(), version: 2, updatedAt: now })
    }
    if (path === `/groups/${group.id}/members` && method === 'GET') return fulfill(route, members)
    if (path === `/groups/${group.id}/feed` && method === 'GET') return fulfill(route, { items: [], nextCursor: null })
    if (path === '/history' && method === 'GET') return fulfill(route, { entries: [], nextCursor: null })
    if (path === '/food-records' && method === 'GET') return fulfill(route, { items: options.populated ? [foodRecord] : [], page: 0, size: Number(url.searchParams.get('size') || 20), totalElements: options.populated ? 1 : 0, totalPages: options.populated ? 1 : 0, hasNext: false })
    if (path === '/drink-records' && method === 'GET') return fulfill(route, { items: options.populated ? [drinkRecord] : [], page: 0, size: Number(url.searchParams.get('size') || 20), totalElements: options.populated ? 1 : 0, totalPages: options.populated ? 1 : 0, hasNext: false })
    if (path === '/explore' && method === 'GET') return fulfill(route, { items: [], nextCursor: null })
    if (path === '/search' && method === 'GET') return fulfill(route, { items: [], nextCursor: null, page: 0, size: 18, totalElements: 0, totalPages: 0, hasNext: false })
    if (path === '/want-to-try' && method === 'GET') return fulfill(route, { items: [], page: 0, size: 24, totalElements: 0, totalPages: 0, hasNext: false })
    if (path === '/cooking-plans/history' && method === 'GET') return fulfill(route, { items: [], page: 0, size: 8, totalElements: 0, totalPages: 0, hasNext: false })
    if (path === '/chat/sessions' && method === 'GET') return fulfill(route, { items: [], page: 0, size: 50, totalElements: 0, totalPages: 0, hasNext: false })
    if (path === '/dashboard' && method === 'GET') return fulfill(route, options.populated
      ? { from: '2026-07-01T00:00:00Z', to: '2026-08-01T00:00:00Z', groupBy: 'WEEK', timeZone: 'Asia/Singapore', empty: false, metrics, spendingTotals }
      : { from: '2026-07-01T00:00:00Z', to: '2026-08-01T00:00:00Z', groupBy: 'WEEK', timeZone: 'Asia/Singapore', empty: true, metrics: [], spendingTotals: [] })
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
