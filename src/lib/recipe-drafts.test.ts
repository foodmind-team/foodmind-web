import { deleteRecipeDraft, loadRecipeDrafts, saveRecipeDraft, scaledRecipeIngredients } from './recipe-drafts'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

describe('device-local recipe drafts', () => {
  it('seeds useful recipes independently for each owner', () => {
    const storage = memoryStorage()
    const first = loadRecipeDrafts('owner-a', storage)
    const second = loadRecipeDrafts('owner-b', storage)
    expect(first).toHaveLength(3)
    expect(second).toHaveLength(3)
    expect(first[0].ingredients.length).toBeGreaterThan(0)
  })

  it('creates, updates, and deletes a draft', () => {
    const storage = memoryStorage()
    const created = saveRecipeDraft('owner', {
      name: 'Sesame greens', category: 'Quick dinner', servings: 2, minutes: 15,
      ingredients: [{ name: 'bok choy', quantity: 300, unit: 'g' }], steps: ['Stir fry.'],
    }, undefined, storage)
    const updated = saveRecipeDraft('owner', { ...created, name: 'Sesame greens bowl' }, created.id, storage)
    expect(loadRecipeDrafts('owner', storage).find((draft) => draft.id === created.id)?.name).toBe('Sesame greens bowl')
    deleteRecipeDraft('owner', updated.id, storage)
    expect(loadRecipeDrafts('owner', storage).some((draft) => draft.id === created.id)).toBe(false)
  })

  it('scales selected recipe ingredients for the real cooking-plan request', () => {
    const [recipe] = loadRecipeDrafts('owner', memoryStorage())
    const [ingredient] = scaledRecipeIngredients([recipe], recipe.servings * 2)
    expect(ingredient.quantity).toBe((recipe.ingredients[0].quantity || 0) * 2)
    expect(ingredient.source).toBe('MANUAL')
  })
})
