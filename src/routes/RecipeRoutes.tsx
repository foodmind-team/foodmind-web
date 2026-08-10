import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bot, Check, ChefHat, Edit3, Minus, NotebookTabs, Plus, Search, Server, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { SavedSectionTabs } from '../components/saved/SavedSectionTabs'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'

type RecipeForm = {
  name: string
  servings: string
  imageUrl: string
  tags: string
  allergenHints: string
  ingredients: Array<{ value: string }>
  steps: Array<{ value: string }>
}

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function recipeBody(values: RecipeForm): Schema<'UserRecipeRequest'> {
  return {
    name: values.name.trim(),
    servings: Number(values.servings),
    imageUrl: values.imageUrl.trim() || null,
    tags: splitList(values.tags),
    allergenHints: splitList(values.allergenHints),
    ingredients: values.ingredients.map((item) => item.value.trim()).filter(Boolean),
    steps: values.steps.map((item) => item.value.trim()).filter(Boolean),
  }
}

function RecipeCard({ recipe, index, onRemove }: {
  recipe: Schema<'UserRecipeResponse'>
  index: number
  onRemove: () => void
}) {
  const tones = ['recipe-sage', 'recipe-coral', 'recipe-lime', 'recipe-plum']
  return (
    <article className="recipe-card">
      <div className={`recipe-card-visual ${tones[index % tones.length]}`} aria-hidden="true"><span>{recipe.name.slice(0, 1)}</span><small>{recipe.tags?.[0] || 'Recipe'}</small></div>
      <div className="recipe-card-copy">
        <p className="eyebrow">{recipe.ingredients.length} ingredients · {recipe.steps.length} steps</p>
        <h2>{recipe.name}</h2>
        <div className="recipe-card-meta"><span><Users size={14} /> {recipe.servings} servings</span><span><Server size={14} /> Synced</span></div>
        <div className="recipe-card-actions">
          <Link className="text-button" to={`/saved/recipes/${recipe.id}/edit`}><Edit3 size={14} /> Edit</Link>
          <button className="icon-button" type="button" aria-label={`Remove ${recipe.name}`} onClick={onRemove}><Trash2 size={16} /></button>
          <Link className="recipe-cook-action" to={`/cooking?selected=${recipe.id}`}><ChefHat size={15} /> Cook</Link>
        </div>
      </div>
    </article>
  )
}

export function RecipeLibraryPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const recipes = useQuery({
    queryKey: queryKeys.recipes.list(),
    queryFn: async () => dataOrThrow<Schema<'UserRecipePageResponse'>>(await api.GET('/recipes', { params: { query: { page: 0, size: 100 } } })),
  })
  const remove = useMutation({
    mutationFn: async (recipe: Schema<'UserRecipeResponse'>) => dataOrThrow(await api.DELETE('/recipes/{id}', { params: { path: { id: recipe.id } } })),
    onSuccess: () => {
      showToast('Recipe removed.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipes.list() })
    },
  })
  const recipeItems = useMemo(() => (recipes.data?.items || []) as Schema<'UserRecipeResponse'>[], [recipes.data?.items])
  const filtered = useMemo(() => recipeItems.filter((recipe) =>
    `${recipe.name} ${(recipe.tags || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [recipeItems, query])

  return (
    <div className="page section-page recipe-library-page">
      <header className="section-page-heading"><div><p className="eyebrow">Your cooking shelf</p><h1>Recipes you can actually cook.</h1><p>Recipes are stored in your FoodMind account and are available to Web, Backend, Agent, and future Android clients.</p></div><div className="heading-actions"><Link className="primary-action" to="/saved/recipes/new"><Bot size={17} /> Add recipes with Agent</Link></div></header>
      <SavedSectionTabs />
      <div className="local-draft-note"><Server size={17} /><span><strong>Account-synced.</strong> Cooking Plan uses these exact backend recipe IDs and never trusts browser-only ingredient snapshots.</span></div>
      <section className="recipe-toolbar" aria-label="Recipe filters"><label className="recipe-search"><Search size={17} /><span className="sr-only">Search recipes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your recipes" /></label></section>
      {recipes.isLoading && <LoadingState label="Loading your recipes…" />}
      {recipes.isError && <ErrorState error={recipes.error} onRetry={() => void recipes.refetch()} />}
      {recipes.isSuccess && !filtered.length && <EmptyState title="No recipe matches" message="Add a backend-synced recipe or try another search." action={<Link className="primary-action" to="/saved/recipes/new">Add recipe</Link>} />}
      <section className="recipe-grid">{filtered.map((recipe, index) => <RecipeCard recipe={recipe} index={index} key={recipe.id} onRemove={() => remove.mutate(recipe)} />)}</section>
      {remove.isError && <div className="form-alert" role="alert">{errorMessage(remove.error)}</div>}
    </div>
  )
}

export function RecipeEditorPage() {
  const { recipeId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const recipe = useQuery({
    queryKey: queryKeys.recipes.detail(recipeId || 'new'),
    queryFn: async () => dataOrThrow<Schema<'UserRecipeResponse'>>(await api.GET('/recipes/{id}', { params: { path: { id: recipeId! } } })),
    enabled: Boolean(recipeId),
  })

  if (recipeId && recipe.isLoading) return <div className="page"><LoadingState label="Opening recipe…" /></div>
  if (recipeId && recipe.isError) return <div className="page"><ErrorState error={recipe.error} onRetry={() => void recipe.refetch()} /></div>
  return <RecipeEditorForm key={recipe.data?.updatedAt || 'new'} existing={recipe.data} onError={setFormError} formError={formError} onSaved={(saved) => {
    queryClient.setQueryData(queryKeys.recipes.detail(saved.id), saved)
    void queryClient.invalidateQueries({ queryKey: queryKeys.recipes.list() })
    showToast(recipeId ? 'Recipe updated.' : 'Recipe created.')
    navigate('/saved/recipes')
  }} />
}

function RecipeEditorForm({ existing, formError, onError, onSaved }: {
  existing?: Schema<'UserRecipeResponse'>
  formError: string | null
  onError: (message: string | null) => void
  onSaved: (recipe: Schema<'UserRecipeResponse'>) => void
}) {
  const { control, register, handleSubmit, formState: { errors } } = useForm<RecipeForm>({
    defaultValues: existing ? {
      name: existing.name,
      servings: String(existing.servings),
      imageUrl: existing.imageUrl || '',
      tags: (existing.tags || []).join(', '),
      allergenHints: (existing.allergenHints || []).join(', '),
      ingredients: existing.ingredients.map((value) => ({ value })),
      steps: existing.steps.map((value) => ({ value })),
    } : { name: '', servings: '4', imageUrl: '', tags: '', allergenHints: '', ingredients: [{ value: '' }], steps: [{ value: '' }] },
  })
  const ingredients = useFieldArray({ control, name: 'ingredients' })
  const steps = useFieldArray({ control, name: 'steps' })
  const save = useMutation({
    mutationFn: async (body: Schema<'UserRecipeRequest'>) => existing
      ? dataOrThrow<Schema<'UserRecipeResponse'>>(await api.PUT('/recipes/{id}', { params: { path: { id: existing.id }, header: { 'If-Match': `"${existing.version}"` } }, body }))
      : dataOrThrow<Schema<'UserRecipeResponse'>>(await api.POST('/recipes', { body })),
    onSuccess: onSaved,
    onError: (error) => onError(errorMessage(error)),
  })
  const submit = handleSubmit((values) => {
    onError(null)
    const body = recipeBody(values)
    if (!Number.isInteger(body.servings) || body.servings < 1 || body.servings > 50) return onError('Servings must be between 1 and 50.')
    if (!body.ingredients.length || !body.steps.length) return onError('Add at least one ingredient and one instruction.')
    save.mutate(body)
  })

  return (
    <div className="page section-page recipe-editor-page">
      <Link className="back-link" to="/saved/recipes"><ArrowLeft size={16} /> My recipes</Link>
      <header className="section-page-heading"><div><p className="eyebrow">Backend recipe</p><h1>{existing ? 'Edit your recipe.' : 'Add a recipe you know.'}</h1><p>Write quantity-first ingredient lines such as “300 g firm tofu” so the Cooking Agent can parse them reliably.</p></div><span className="cooking-mark"><NotebookTabs /></span></header>
      <form className="recipe-editor-form" onSubmit={submit} noValidate>
        {formError && <div className="form-alert" role="alert">{formError}</div>}
        <section className="recipe-editor-basics"><div className="section-topline"><div><p className="eyebrow">The basics</p><h2>Name the recipe</h2></div></div><div className="form-grid"><label>Recipe name<input maxLength={160} {...register('name', { required: 'Enter a recipe name.' })} />{errors.name && <small>{errors.name.message}</small>}</label><label>Servings<input type="number" min="1" max="50" {...register('servings')} /></label><label>Tags<input maxLength={500} placeholder="Weeknight, Vegetarian" {...register('tags')} /></label><label>Allergen hints<input maxLength={500} placeholder="Soy, Egg" {...register('allergenHints')} /></label><label>Image URL<input maxLength={2048} placeholder="https://…" {...register('imageUrl')} /></label></div></section>
        <section className="recipe-editor-section"><div className="section-topline"><div><p className="eyebrow">Ingredients</p><h2>What goes in</h2></div><button className="secondary-action" type="button" disabled={ingredients.fields.length >= 100} onClick={() => ingredients.append({ value: '' })}><Plus size={15} /> Add ingredient</button></div><div className="recipe-line-list">{ingredients.fields.map((field, index) => <div className="recipe-ingredient-line" key={field.id}><label><span>Ingredient {index + 1}</span><input maxLength={500} placeholder="300 g firm tofu" {...register(`ingredients.${index}.value`)} /></label><button className="icon-button" type="button" aria-label={`Remove ingredient ${index + 1}`} disabled={ingredients.fields.length === 1} onClick={() => ingredients.remove(index)}><Minus size={16} /></button></div>)}</div></section>
        <section className="recipe-editor-section"><div className="section-topline"><div><p className="eyebrow">Method</p><h2>How it comes together</h2></div><button className="secondary-action" type="button" disabled={steps.fields.length >= 100} onClick={() => steps.append({ value: '' })}><Plus size={15} /> Add step</button></div><div className="recipe-step-list">{steps.fields.map((field, index) => <label key={field.id}><span>{index + 1}</span><textarea aria-label={`Step ${index + 1}`} rows={2} maxLength={1_000} placeholder="Write one clear cooking instruction" {...register(`steps.${index}.value`)} /><button className="icon-button" type="button" aria-label={`Remove step ${index + 1}`} disabled={steps.fields.length === 1} onClick={() => steps.remove(index)}><Minus size={16} /></button></label>)}</div></section>
        <div className="recipe-editor-actions"><span><Server size={16} /> Changes are stored after you select Save recipe.</span><Link className="secondary-action" to="/saved/recipes">Cancel</Link><button className="primary-action" type="submit" disabled={save.isPending}><Check size={17} /> {save.isPending ? 'Saving…' : 'Save recipe'}</button></div>
      </form>
    </div>
  )
}
