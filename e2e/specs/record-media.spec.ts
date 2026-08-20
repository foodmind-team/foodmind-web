import { expect, test } from '@playwright/test'
import { mockApi } from '../fixtures/api.js'

const recordId = '00000000-0000-4000-8000-000000000031'
const mediaAssetId = '00000000-0000-4000-8000-000000000051'
const record = {
  id: recordId,
  mealNameSnapshot: 'Spicy Chicken Burger',
  placeNameSnapshot: 'Ordinary Burgers',
  occurredAt: '2026-08-20T12:36:00Z',
  price: { amount: 8.1, currency: 'SGD' },
  rating: null,
  comment: null,
  wouldEatAgain: null,
  visibility: 'GROUP',
  groupId: '00000000-0000-4000-8000-000000000011',
  mediaAssetId,
  imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="120"%3E%3Crect width="200" height="120" fill="%23657458"/%3E%3C/svg%3E',
  createdAt: '2026-08-20T12:36:00Z',
  updatedAt: '2026-08-20T12:37:00Z',
  version: 0,
}

test('read-only group records do not expose edit or delete actions', async ({ page }) => {
  await mockApi(page, { recordDetail: { ...record, canManage: false } })
  await page.goto(`/records/food/${recordId}`)

  await expect(page.getByText(/this group record is read-only/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete image' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Edit record' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
})

test('owners can delete an attached image and the card stays removed', async ({ page }) => {
  let deleteCalls = 0
  await mockApi(page, {
    recordDetail: { ...record, canManage: true },
    onMediaDelete: () => { deleteCalls += 1 },
  })
  await page.goto(`/records/food/${recordId}`)

  await page.getByRole('button', { name: 'Delete image' }).click()
  await page.getByRole('alert').getByRole('button', { name: 'Delete image' }).click()

  await expect(page.getByText('The stored image asset has been deleted.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Verified record image' })).toHaveCount(0)
  expect(deleteCalls).toBe(1)
})
