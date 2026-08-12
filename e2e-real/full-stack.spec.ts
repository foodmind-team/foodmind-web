import { expect, test } from '@playwright/test'

test.describe.serial('real FoodMind stack without route interception', () => {
  const email = process.env.FOODMIND_E2E_EMAIL || 'parity-e2e-20260811@example.test'
  const password = process.env.FOODMIND_E2E_PASSWORD || 'Real-stack-password-2026'
  const runKey = Date.now().toString(36)
  const ingredientName = `E2E firm tofu ${runKey}`
  const recipeName = `E2E tofu bowl ${runKey}`

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
    await page.getByLabel('Ingredient').fill(ingredientName)
    await page.getByLabel('Quantity').fill('400')
    await page.getByLabel('Unit').fill('g')
    await page.getByRole('button', { name: /add lot/i }).click()
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
    await page.getByLabel('Ingredient').fill('E2E archive lot')
    await page.getByLabel('Quantity').fill('1')
    await page.getByLabel('Unit').fill('item')
    await page.getByRole('button', { name: /add lot/i }).click()
    const disposableLot = page.getByRole('article').filter({ hasText: 'E2E archive lot' })
    await disposableLot.getByRole('button', { name: /archive/i }).click()
    await expect(page.getByRole('heading', { name: 'E2E archive lot' })).toHaveCount(0)
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
