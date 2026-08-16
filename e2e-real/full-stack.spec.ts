import { expect, test } from '@playwright/test'

test.describe.serial('real FoodMind stack without route interception', () => {
  const email = process.env.FOODMIND_E2E_EMAIL || 'parity-e2e-20260811@example.test'
  const password = process.env.FOODMIND_E2E_PASSWORD || 'Real-stack-password-2026'
  const runKey = Date.now().toString(36)
  const ingredientName = `E2E firm tofu ${runKey}`
  const recipeName = `E2E tofu bowl ${runKey}`
  const mediaRecordName = 'E2E MinIO image meal'
  const mediaGroupName = 'E2E media group'

  test('registers and renders every primary page without a crash or blank shell', async ({ page }) => {
    const serverErrors: string[] = []
    page.on('response', (response) => {
      if (response.url().includes('/api/v1/') && response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
      }
    })

    await page.goto('/register')
    await page.getByLabel('Display name').fill('Web Android Parity User')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByLabel('Time zone').fill('Asia/Singapore')
    await page.getByRole('button', { name: /create account/i }).click()
    await page.waitForTimeout(750)
    if (page.url().endsWith('/register')) {
      await page.goto('/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: /^sign in/i }).click()
    }
    await expect(page).toHaveURL(/\/$/)

    const destinations = [
      ['/', /dinner, decided with confidence/i],
      ['/inventory', /what is in your kitchen/i],
      ['/shopping-lists', /your shopping lists/i],
      ['/saved/recipes', /recipes you can actually cook/i],
      ['/cooking/import', /describe the recipes/i],
      ['/cooking', /what do you want to cook tonight/i],
      ['/chat', /ask foodmind/i],
      ['/dashboard', /^dashboard$/i],
      ['/history', /^history$/i],
      ['/explore', /^explore$/i],
      ['/groups', /your groups/i],
      ['/me/preferences', /preferences/i],
    ] as const
    for (const [path, heading] of destinations) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
      await expect(page.locator('.route-error')).toHaveCount(0)
      await expect(page.locator('body')).not.toBeEmpty()
    }
    expect(serverErrors).toEqual([])
  })

  test('performs inventory and cloud recipe CRUD through visible controls', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /^sign in/i }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/inventory')
    await page.getByRole('button', { name: 'Add ingredient', exact: true }).click()
    await page.getByLabel('Ingredient').fill(ingredientName)
    await page.getByLabel('Quantity').fill('400')
    await page.getByLabel('Unit').fill('g')
    await page.getByRole('button', { name: 'Add ingredient', exact: true }).click()
    await expect(page.getByRole('heading', { name: ingredientName })).toBeVisible()
    const sharedLot = page.getByRole('article').filter({ hasText: ingredientName })
    await sharedLot.getByRole('button', { name: /^edit$/i }).click()
    const editedLot = page.getByRole('article').filter({
      has: page.getByRole('button', { name: /^save$/i }),
    })
    await editedLot.getByLabel('Quantity').fill('350')
    await editedLot.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByRole('article').filter({ hasText: ingredientName })).toContainText(/350 g available/i)

    await page.goto('/saved/recipes/manual')
    await page.getByLabel('Recipe name').fill(recipeName)
    await page.getByLabel('Servings').fill('2')
    await page.getByPlaceholder('300 g firm tofu').fill('300 g firm tofu')
    await page.getByRole('textbox', { name: 'Step 1', exact: true }).fill('Sear the tofu for 8 minutes.')
    await page.getByRole('button', { name: /save recipe/i }).click()
    await expect(page.getByRole('heading', { name: recipeName })).toBeVisible()
    await page.getByPlaceholder('Search your recipes').fill(recipeName)
    await expect(page.getByRole('heading', { name: recipeName })).toBeVisible()

    await page.goto('/records/food?size=50')
    await expect(page).toHaveURL(/size=50/)
    await expect(page.getByText(/no food records|nothing recorded/i).first()).toBeVisible()

    await page.goto('/inventory')
    await page.getByRole('button', { name: 'Add ingredient', exact: true }).click()
    await page.getByLabel('Ingredient').fill('E2E archive lot')
    await page.getByLabel('Quantity').fill('1')
    await page.getByLabel('Unit').fill('item')
    await page.getByRole('button', { name: 'Add ingredient', exact: true }).click()
    const disposableLot = page.getByRole('article').filter({ hasText: 'E2E archive lot' })
    await disposableLot.getByRole('button', { name: /archive/i }).click()
    await disposableLot.getByRole('button', { name: 'Archive ingredient', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'E2E archive lot' })).toHaveCount(0)
  })
  test('uploads a real private image and renders it in record detail and Explore', async ({ page, browser }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /^sign in/i }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/groups')
    await page.getByRole('button', { name: 'Create group', exact: true }).first().click()
    await page.getByLabel('Group name').fill(mediaGroupName)
    await page.getByLabel('Description').fill('Private group used by the real MinIO media parity test.')
    await page.getByRole('button', { name: 'Create group', exact: true }).last().click()
    await expect(page).toHaveURL(/\/groups\/[0-9a-f-]+$/)

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=',
      'base64',
    )
    await page.goto('/records/new')
    await page.getByLabel('Meal name').fill(mediaRecordName)
    await page.getByLabel('Visibility').selectOption('GROUP')
    await page.getByLabel('Group').selectOption({ label: mediaGroupName })
    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-record.png',
      mimeType: 'image/png',
      buffer: png,
    })
    await page.getByRole('button', { name: /add to history/i }).click()
    await expect(page).toHaveURL(/\/records\/food\/[0-9a-f-]+$/)
    const recordId = page.url().split('/').pop()
    expect(recordId).toMatch(/^[0-9a-f-]+$/)

    const detailImage = page.getByRole('img', { name: `Uploaded image for ${mediaRecordName}` })
    await expect(detailImage).toBeVisible()
    await expect.poll(() => detailImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)

    await page.goto('/explore')
    const card = page.getByRole('button', { name: `Preview ${mediaRecordName}` })
    await expect(card).toBeVisible()
    const cardImage = card.locator('img')
    await expect(cardImage).toBeVisible()
    await expect.poll(() => cardImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    await card.click()
    const previewImage = page.getByRole('dialog').locator('img')
    await expect(previewImage).toBeVisible()
    await expect.poll(() => previewImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)

    const outsiderContext = await browser.newContext()
    const outsider = await outsiderContext.newPage()
    await outsider.goto('/register')
    await outsider.getByLabel('Display name').fill('Media Outsider')
    await outsider.getByLabel('Email').fill(`media-outsider-${runKey}@example.test`)
    await outsider.getByLabel('Password').fill(password)
    await outsider.getByLabel('Time zone').fill('Asia/Singapore')
    await outsider.getByRole('button', { name: /create account/i }).click()
    await expect(outsider).toHaveURL(/\/$/)
    await outsider.goto('/explore')
    await expect(outsider.getByText(mediaRecordName, { exact: true })).toHaveCount(0)
    const denied = await outsiderContext.request.get(
      `http://127.0.0.1:4173/api/v1/food-records/${recordId}`,
    )
    expect([403, 404]).toContain(denied.status())
    await outsiderContext.close()
  })

  test('submits recipe import, recommendation, cooking, and chat requests to real services', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /^sign in/i }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/cooking/import')
    await expect(page.getByRole('heading', { name: /describe the recipes/i })).toBeVisible()
    await page.getByLabel('Recipe text').fill('Recipe: E2E Tomato Salad\n2 servings\nIngredients:\n2 tomatoes\n1 tbsp olive oil\nSteps:\n1. Slice tomatoes.\n2. Toss with olive oil.')
    await page.getByRole('button', { name: /parse recipes/i }).click()
    await expect(page).toHaveURL(/\/cooking\/import\/[0-9a-f-]+/)
    const saveImported = page.getByRole('button', { name: /save recipes and choose for cooking/i })
    if (await saveImported.isVisible()) {
      await saveImported.click()
      await expect(page).toHaveURL(/\/cooking\?selected=/)
    }

    await page.goto('/')
    await expect(page.getByRole('heading', { name: /dinner, decided with confidence/i })).toBeVisible()
    const recommendationResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/recommendations/generate') && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /generate recommendation/i }).click()
    await recommendationResponse
    await expect(page.locator('main')).toContainText(/recommendation|no valid|try again/i)

    await page.goto('/cooking')
    await expect(page.getByRole('heading', { name: /what do you want to cook tonight/i })).toBeVisible()
    const recipeChoice = page.getByRole('button', { name: `Select ${recipeName}`, exact: true })
    await expect(recipeChoice).toBeVisible()
    await recipeChoice.click()
    await page.getByRole('button', { name: /generate plan/i }).click()
    await expect(page).toHaveURL(/\/cooking\/[0-9a-f-]+/)
    await expect(page.locator('main')).toContainText(/ready|confirmation|inventory|failed|processing/i)

    await page.goto('/chat')
    await expect(page.getByRole('heading', { name: /ask foodmind/i })).toBeVisible()
    await page.getByRole('button', { name: /new chat/i }).click()
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]+/)
    await page.getByLabel('Message', { exact: true }).fill('Where can I find my saved recipes?')
    await page.getByRole('button', { name: /send message/i }).click()
    await expect(page.locator('main')).toContainText(/navigate|recipe|cooking|FoodMind/i)
  })
})
