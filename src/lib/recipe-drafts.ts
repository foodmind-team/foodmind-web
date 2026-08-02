export type RecipeIngredientDraft = {
  name: string
  quantity: number | null
  unit: string
}

export type RecipeDraft = {
  id: string
  name: string
  category: string
  servings: number
  minutes: number
  ingredients: RecipeIngredientDraft[]
  steps: string[]
  createdAt: string
  updatedAt: string
}

export type RecipeDraftInput = Omit<RecipeDraft, 'id' | 'createdAt' | 'updatedAt'>

type DraftStorage = Pick<Storage, 'getItem' | 'setItem'>

export const RECIPE_DRAFTS_EVENT = 'foodmind:recipe-drafts-changed'
const STORAGE_VERSION = 'v1'

function storageKey(ownerId: string) {
  return `foodmind.recipe-drafts.${STORAGE_VERSION}:${ownerId}`
}

function starterRecipes(): RecipeDraft[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'starter-ginger-tofu-noodles',
      name: 'Ginger scallion tofu noodles',
      category: 'Quick dinner',
      servings: 2,
      minutes: 20,
      ingredients: [
        { name: 'firm tofu', quantity: 300, unit: 'g' },
        { name: 'wheat noodles', quantity: 200, unit: 'g' },
        { name: 'fresh ginger', quantity: 20, unit: 'g' },
        { name: 'spring onion', quantity: 3, unit: 'stalks' },
      ],
      steps: ['Sear the tofu until golden.', 'Cook the noodles and toss with ginger and spring onion.', 'Fold in the tofu and serve warm.'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'starter-tomato-lentil-shakshuka',
      name: 'Tomato lentil shakshuka',
      category: 'One pan',
      servings: 4,
      minutes: 30,
      ingredients: [
        { name: 'canned tomatoes', quantity: 800, unit: 'g' },
        { name: 'cooked lentils', quantity: 300, unit: 'g' },
        { name: 'eggs', quantity: 4, unit: '' },
        { name: 'red bell pepper', quantity: 1, unit: '' },
      ],
      steps: ['Simmer the tomato, lentil, and pepper base.', 'Make four wells and add the eggs.', 'Cover until the eggs are set.'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'starter-miso-salmon-rice',
      name: 'Miso salmon rice bowl',
      category: 'Weeknight',
      servings: 4,
      minutes: 28,
      ingredients: [
        { name: 'salmon fillet', quantity: 600, unit: 'g' },
        { name: 'white rice', quantity: 300, unit: 'g' },
        { name: 'white miso paste', quantity: 40, unit: 'g' },
        { name: 'broccoli', quantity: 300, unit: 'g' },
      ],
      steps: ['Cook the rice.', 'Roast the miso-glazed salmon and broccoli.', 'Divide into bowls and serve.'],
      createdAt: now,
      updatedAt: now,
    },
  ]
}

function isRecipeDraft(value: unknown): value is RecipeDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Partial<RecipeDraft>
  return typeof draft.id === 'string'
    && typeof draft.name === 'string'
    && typeof draft.category === 'string'
    && Number.isInteger(draft.servings)
    && Number.isInteger(draft.minutes)
    && Array.isArray(draft.ingredients)
    && draft.ingredients.every((ingredient) => ingredient && typeof ingredient.name === 'string')
    && Array.isArray(draft.steps)
    && draft.steps.every((step) => typeof step === 'string')
}

export function loadRecipeDrafts(ownerId: string, storage: DraftStorage = window.localStorage): RecipeDraft[] {
  try {
    const stored = storage.getItem(storageKey(ownerId))
    if (!stored) {
      const starters = starterRecipes()
      storage.setItem(storageKey(ownerId), JSON.stringify(starters))
      return starters
    }
    const parsed = JSON.parse(stored) as unknown
    return Array.isArray(parsed) ? parsed.filter(isRecipeDraft) : []
  } catch {
    return starterRecipes()
  }
}

function notifyDraftChange(ownerId: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(RECIPE_DRAFTS_EVENT, { detail: ownerId }))
}

export function saveRecipeDraft(ownerId: string, input: RecipeDraftInput, recipeId?: string, storage: DraftStorage = window.localStorage): RecipeDraft {
  const drafts = loadRecipeDrafts(ownerId, storage)
  const existing = recipeId ? drafts.find((draft) => draft.id === recipeId) : undefined
  const now = new Date().toISOString()
  const saved: RecipeDraft = {
    ...input,
    id: existing?.id || recipeId || crypto.randomUUID(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  const next = existing ? drafts.map((draft) => draft.id === saved.id ? saved : draft) : [saved, ...drafts]
  storage.setItem(storageKey(ownerId), JSON.stringify(next))
  notifyDraftChange(ownerId)
  return saved
}

export function deleteRecipeDraft(ownerId: string, recipeId: string, storage: DraftStorage = window.localStorage) {
  const next = loadRecipeDrafts(ownerId, storage).filter((draft) => draft.id !== recipeId)
  storage.setItem(storageKey(ownerId), JSON.stringify(next))
  notifyDraftChange(ownerId)
}

export function scaledRecipeIngredients(recipes: RecipeDraft[], targetServings: number) {
  return recipes.flatMap((recipe) => {
    const scale = targetServings / recipe.servings
    return recipe.ingredients
      .filter((ingredient) => ingredient.name.trim())
      .map((ingredient) => ({
        ingredientName: ingredient.name.trim(),
        quantity: ingredient.quantity === null ? null : Number((ingredient.quantity * scale).toFixed(2)),
        unit: ingredient.unit.trim() || null,
        source: 'MANUAL' as const,
      }))
  })
}
