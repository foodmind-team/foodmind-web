import { expect, test } from '@playwright/test'
import { mockApi } from '../fixtures/api.js'

test('captures responsive and data-rich UI evidence', async ({ page }) => {
  await mockApi(page, { populated: true })

  for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 900 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /dinner, decided with confidence/i })).toBeVisible()
    await page.screenshot({ path: test.info().outputPath(`home-${viewport.width}.png`), fullPage: true })
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/records/food')
  await expect(page.getByRole('heading', { name: /^food records$/i })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('food-records-1440.png'), fullPage: true })

  for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 900 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /^insights$/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /your food story/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /food and drink activity/i })).toBeVisible()
    await expect(page.locator('details.metric-data-disclosure')).not.toHaveAttribute('open', '')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
    await page.screenshot({ path: test.info().outputPath(`dashboard-${viewport.width}.png`), fullPage: true })
  }
})
