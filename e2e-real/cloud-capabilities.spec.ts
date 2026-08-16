import { expect, test } from '@playwright/test'

const cloudAcceptanceEnabled = process.env.FOODMIND_E2E_CLOUD_CAPABILITIES === 'true'

test.describe('AWS media and OneMap acceptance', () => {
  test.skip(!cloudAcceptanceEnabled, 'Set FOODMIND_E2E_CLOUD_CAPABILITIES=true for the AWS staging acceptance run.')

  test('uploads a private image, enforces isolation, cleans up, and renders a walking route', async ({ page, context, browser, baseURL }) => {
    const runKey = `${Date.now().toString(36)}-${process.pid}`
    const email = `cloud-media-${runKey}@example.test`
    const password = 'Cloud-acceptance-password-2026'
    const recordName = `AWS media acceptance ${runKey}`
    const placeId = process.env.FOODMIND_E2E_PLACE_ID || 'a032d001-48a7-517a-bef0-95bc39640bca'
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=',
      'base64',
    )

    await page.goto('/register')
    await page.getByLabel('Display name').fill('Cloud Media Acceptance')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByLabel('Time zone').fill('Asia/Singapore')
    await page.getByRole('checkbox', { name: /I agree that FoodMind may collect/i }).check()
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page).toHaveURL(/\/$/)

    let recordId = ''
    let mediaAssetId = ''
    try {
      await page.goto('/records/new')
      await page.getByLabel('Meal name').fill(recordName)
      await page.locator('input[type="file"]').setInputFiles({
        name: 'cloud-acceptance.png',
        mimeType: 'image/png',
        buffer: png,
      })

      const uploadInstruction = page.waitForResponse((response) =>
        response.request().method() === 'POST' && response.url().includes('/api/v1/media/uploads'),
      )
      const storagePut = page.waitForResponse((response) => {
        const hostname = new URL(response.url()).hostname
        const isAwsHost = hostname === 'amazonaws.com' || hostname.endsWith('.amazonaws.com')
        return response.request().method() === 'PUT' && isAwsHost
      })
      const finalise = page.waitForResponse((response) =>
        response.request().method() === 'POST' && /\/api\/v1\/media\/[0-9a-f-]+\/finalise$/.test(new URL(response.url()).pathname),
      )
      const createRecord = page.waitForResponse((response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/api/v1/food-records'),
      )

      await page.getByRole('button', { name: /add to history/i }).click()
      const [instructionResponse, storageResponse, finaliseResponse, recordResponse] = await Promise.all([
        uploadInstruction,
        storagePut,
        finalise,
        createRecord,
      ])
      expect(instructionResponse.status()).toBe(201)
      mediaAssetId = (await instructionResponse.json()).mediaAssetId as string
      expect(mediaAssetId).toMatch(/^[0-9a-f-]+$/)
      expect(storageResponse.ok()).toBe(true)
      expect(storageResponse.request().headers()['content-type']).toBe('image/png')
      expect(storageResponse.request().headers()['x-amz-checksum-sha256']).toBeTruthy()
      expect(finaliseResponse.status()).toBe(200)
      await expect(finaliseResponse.json()).resolves.toMatchObject({ status: 'READY' })
      expect(recordResponse.status()).toBe(201)

      await expect(page).toHaveURL(/\/records\/food\/[0-9a-f-]+$/)
      recordId = page.url().split('/').pop() || ''
      expect(recordId).toMatch(/^[0-9a-f-]+$/)

      const detailImage = page.getByRole('img', { name: `Uploaded image for ${recordName}` })
      await expect(detailImage).toBeVisible()
      await expect.poll(() => detailImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)

      await page.goto('/history')
      await expect(page.getByText(recordName, { exact: true })).toBeVisible()
      await page.getByText(recordName, { exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/records/food/${recordId}$`))
      await expect(page.getByRole('img', { name: `Uploaded image for ${recordName}` })).toBeVisible()

      const outsiderContext = await browser.newContext({ baseURL })
      try {
        const outsider = await outsiderContext.newPage()
        await outsider.goto('/register')
        await outsider.getByLabel('Display name').fill('Cloud Media Outsider')
        await outsider.getByLabel('Email').fill(`cloud-outsider-${runKey}@example.test`)
        await outsider.getByLabel('Password').fill(password)
        await outsider.getByLabel('Time zone').fill('Asia/Singapore')
        await outsider.getByRole('checkbox', { name: /I agree that FoodMind may collect/i }).check()
        await outsider.getByRole('button', { name: /create account/i }).click()
        await expect(outsider).toHaveURL(/\/$/)
        const denied = outsider.waitForResponse((response) =>
          response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith(`/api/v1/food-records/${recordId}`),
        )
        await outsider.goto(`/records/food/${recordId}`)
        expect([403, 404]).toContain((await denied).status())
      } finally {
        await outsiderContext.close()
      }

      await page.getByRole('button', { name: 'Delete image', exact: true }).click()
      const deleteImagePanel = page.getByRole('alert').filter({ hasText: 'Delete the stored image?' })
      await deleteImagePanel.getByRole('button', { name: 'Delete image', exact: true }).click()
      await expect(page.getByText('The stored image asset has been deleted.')).toBeVisible()
      mediaAssetId = ''

      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      const deleteRecordPanel = page.getByRole('alert').filter({ hasText: 'Delete this record?' })
      await deleteRecordPanel.getByRole('button', { name: 'Delete record', exact: true }).click()
      await expect(page).toHaveURL(/\/history$/)
      await expect(page.getByText(recordName, { exact: true })).toHaveCount(0)
      recordId = ''

      await context.grantPermissions(['geolocation'])
      await context.setGeolocation({ latitude: 1.2966, longitude: 103.7764 })
      await page.goto(`/catalogue/place/${placeId}`)
      const map = page.getByLabel(/Map showing /)
      await expect(map).toBeVisible()
      await expect(page.locator('.leaflet-control-attribution')).toContainText('OneMap')
      const loadedTile = page.locator('.leaflet-tile-loaded').first()
      await expect(loadedTile).toBeVisible()
      await expect.poll(() => loadedTile.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)

      const routeResponse = page.waitForResponse((response) =>
        response.request().method() === 'GET' && response.url().includes(`/api/v1/catalogue/places/${placeId}/walking-route`),
      )
      await page.getByRole('button', { name: 'Use my location for walking route' }).click()
      expect((await routeResponse).status()).toBe(200)
      await expect(page.getByText(/^Walking route:/)).toBeVisible()
      await expect(page.locator('.leaflet-overlay-pane path.leaflet-interactive')).toBeVisible()
    } finally {
      if (mediaAssetId) {
        await context.request.delete(`/api/v1/media/${mediaAssetId}`).catch(() => undefined)
      }
      if (recordId) {
        await context.request.delete(`/api/v1/food-records/${recordId}`).catch(() => undefined)
      }
    }
  })
})
