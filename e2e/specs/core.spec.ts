import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { group, mockApi, recommendation } from '../fixtures/api.js'

test('returns a direct protected route to sign-in without an authenticated refresh', async ({ page }) => {
  await mockApi(page, { authenticated: false })
  await page.goto('/history')
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fhistory/)
  await expect(page.getByRole('heading', { name: /sign in to foodmind/i })).toBeVisible()
})

test('generates one lead recommendation and Try another stays local', async ({ page }) => {
  let generateCalls = 0
  let idempotencyKey = ''
  let generateBody: Record<string, unknown> = {}
  await mockApi(page, { onGenerate: (request) => {
    generateCalls += 1
    idempotencyKey = request.headers()['idempotency-key'] || ''
    generateBody = request.postDataJSON() as Record<string, unknown>
  } })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /dinner, decided with confidence/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /generate recommendation/i })).toBeVisible()

  await page.getByRole('button', { name: /^edit$/i }).click()
  await page.getByLabel('Maximum budget').fill('24')
  await page.getByLabel('Latitude (optional)').fill('1.3521')
  await page.getByLabel('Longitude (optional)').fill('103.8198')
  await page.getByRole('button', { name: /^done$/i }).click()
  await page.getByRole('button', { name: /generate recommendation/i }).click()

  await expect(page).toHaveURL(`/recommendations/${recommendation.sessionId}`)
  await expect(page.getByRole('heading', { name: 'Garden chicken rice', exact: true }).first()).toBeVisible()
  expect(generateCalls).toBe(1)
  expect(idempotencyKey).toMatch(/[0-9a-f-]{36}/)
  expect(generateBody).toMatchObject({ maxBudget: 24, latitude: 1.3521, longitude: 103.8198 })

  await page.getByRole('button', { name: /try another/i }).click()
  await expect(page.getByRole('heading', { name: 'Miso mushroom noodles', exact: true }).first()).toBeVisible()
  expect(generateCalls).toBe(1)
})

test('core home is responsive and has no serious automated accessibility findings', async ({ page }) => {
  await mockApi(page)
  for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 900 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: /primary/i })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
    if (viewport.width === 360) {
      const generate = await page.getByRole('button', { name: /generate recommendation/i }).boundingBox()
      expect(generate).not.toBeNull()
      expect((generate?.y || 0) + (generate?.height || 0)).toBeLessThanOrEqual(viewport.height)
    }
  }

  await page.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') })
  const serious = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (root: Document, options: object) => Promise<{ violations: { id: string; impact: string | null }[] }> } }).axe
    const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] } })
    return result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
  })
  expect(serious).toEqual([])
})

test('all primary destinations render their documented empty or ready state', async ({ page }) => {
  await mockApi(page)
  const destinations = [
    ['/', /dinner, decided with confidence/i],
    ['/history', /^history$/i],
    ['/records/food', /^food records$/i],
    ['/records/drink', /^drink records$/i],
    ['/groups', /^your groups$/i],
    ['/explore', /explore what your circles/i],
    ['/saved', /saved for the right moment/i],
    ['/cooking', /cook with what you know/i],
    ['/chat', /^chat$/i],
    ['/dashboard', /^dashboard$/i],
    ['/me', /^maya tan$/i],
    ['/me/preferences', /preferences/i],
  ] as const

  for (const [path, heading] of destinations) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
    await expect(page.locator('.route-error')).toHaveCount(0)
    expect(await page.locator('body').innerText()).not.toMatch(/[ÃÂâ]/)
    await page.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') })
    const serious = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (root: Document, options: object) => Promise<{ violations: { id: string; impact: string | null }[] }> } }).axe
      const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] } })
      return result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    })
    expect(serious).toEqual([])
  }
})

test('record collection filters and global search intent stay in the URL', async ({ page }) => {
  await mockApi(page)
  await page.goto('/records/food')
  await page.getByLabel('Page size').selectOption('50')
  await expect(page).toHaveURL(/\/records\/food\?size=50$/)

  await page.goto('/explore?search=true')
  await expect(page.getByPlaceholder('Search places, meals, or products')).toBeFocused()
})

test('legacy group join is a compatibility fallback only', async ({ page }) => {
  let legacyCalls = 0
  await mockApi(page, { legacyJoinOnly: true, onLegacyJoin: () => { legacyCalls += 1 } })
  await page.goto('/groups/join')
  await page.getByLabel('Invitation token').fill('one-time-private-token')
  await page.getByRole('button', { name: /^join group$/i }).click()
  await expect(page).toHaveURL('/groups')
  expect(legacyCalls).toBe(1)
})

test('group owners can archive with the backend status command', async ({ page }) => {
  let updateBody: Record<string, unknown> = {}
  await mockApi(page, { onGroupUpdate: (request) => { updateBody = request.postDataJSON() as Record<string, unknown> } })
  await page.goto(`/groups/${group.id}`)
  await expect(page.getByRole('heading', { name: group.name })).toBeVisible()
  await page.getByRole('button', { name: 'Archive group' }).click()
  await page.getByRole('alert').getByRole('button', { name: 'Archive group' }).click()
  await expect(page.getByText('Archived', { exact: true })).toBeVisible()
  expect(updateBody).toEqual({ status: 'ARCHIVED' })
})

test('preference field errors focus the exact backend-rejected control', async ({ page }) => {
  await mockApi(page, { preferenceFieldError: true })
  await page.goto('/me/preferences')
  await page.getByRole('button', { name: /save preferences/i }).click()
  await expect(page.getByText('Use a supported three-letter currency code.')).toBeVisible()
  await expect(page.getByLabel('Currency')).toBeFocused()
})
