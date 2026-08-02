import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, ChefHat, Clock3, Edit3, ListChecks, Minus, NotebookTabs, Plus, Search, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'
import { SavedSectionTabs } from '../components/saved/SavedSectionTabs'
import { EmptyState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { prepareCommand, type PendingCommand } from '../lib/commands'
import { deleteRecipeDraft, loadRecipeDrafts, RECIPE_DRAFTS_EVENT, saveRecipeDraft, scaledRecipeIngredients, type RecipeDraft, type RecipeDraftInput } from '../lib/recipe-drafts'

function useRecipeDrafts() {
  const { user } = useAuth()
  const ownerId = user?.id || 'anonymous'
  const [drafts, setDrafts] = useState<RecipeDraft[]>(() => loadRecipeDrafts(ownerId))
  const refresh = useCallback(() => setDrafts(loadRecipeDrafts(ownerId)), [ownerId])

  useEffect(() => {
    refresh()
    const onChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail === ownerId) refresh()
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith('foodmind.recipe-drafts.')) refresh()
    }
    window.addEventListener(RECIPE_DRAFTS_EVENT, onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(RECIPE_DRAFTS_EVENT, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [ownerId, refresh])

  return { drafts, ownerId, refresh }
}

function recipeTone(index: number) {
  return ['recipe-sage', 'recipe-coral', 'recipe-lime', 'recipe-plum'][index % 4]
}

function RecipeCard({ recipe, index, selected, onToggle, actions }: {
  recipe: RecipeDraft
  index: number
  selected?: boolean
  onToggle?: () => void
  actions?: React.ReactNode
}) {
  const content = <>
    <div className={`recipe-card-visual ${recipeTone(index)}`} aria-hidden="true"><span>{recipe.name.slice(0, 1)}</span><small>{recipe.category}</small>{selected && <i><Check size={16} /></i>}</div>
    <div className="recipe-card-copy"><p className="eyebrow">{recipe.ingredients.length} ingredients · {recipe.steps.length} steps</p><h2>{recipe.name}</h2><div className="recipe-card-meta"><span><Clock3 size={14} /> {recipe.minutes} min</span><span><Users size={14} /> {recipe.servings} servings</span></div>{actions}</div>
  </>
  if (!onToggle) return <article className="recipe-card">{content}</article>
  return <button className={`recipe-card selectable${selected ? ' selected' : ''}`} type="button" aria-pressed={selected} onClick={onToggle}>{content}</button>
}

export function RecipeLibraryPage() {
  const { drafts, ownerId } = useRecipeDrafts()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const categories = useMemo(() => ['All', ...new Set(drafts.map((draft) => draft.category))], [drafts])
  const filtered = drafts.filter((draft) => (category === 'All' || draft.category === category) && draft.name.toLowerCase().includes(query.trim().toLowerCase()))

  const remove = (recipe: RecipeDraft) => {
    deleteRecipeDraft(ownerId, recipe.id)
    setConfirmingId(null)
    showToast(`${recipe.name} was removed from this device.`)
  }

  return (
    <div className="page section-page recipe-library-page">
      <header className="section-page-heading"><div><p className="eyebrow">Your cooking shelf</p><h1>Recipes you can actually cook.</h1><p>Keep lightweight recipe drafts on this device, then turn their ingredient lines into a real FoodMind cooking plan.</p></div><Link className="primary-action" to="/saved/recipes/new"><Plus size={17} /> Add recipe</Link></header>
      <SavedSectionTabs />
      <div className="local-draft-note"><ShieldCheck size={17} /><span><strong>Private to this browser.</strong> Recipe drafts are separated by FoodMind account and are not presented as backend-saved records.</span></div>
      <section className="recipe-toolbar" aria-label="Recipe filters">
        <label className="recipe-search"><Search size={17} /><span className="sr-only">Search recipes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your recipes" /></label>
        <div className="recipe-categories">{categories.map((value) => <button className={category === value ? 'active' : ''} type="button" onClick={() => setCategory(value)} key={value}>{value}</button>)}</div>
      </section>
      {!filtered.length && <EmptyState title="No recipe matches" message="Try another filter or add a recipe with the ingredients you usually keep around." action={<Link className="primary-action" to="/saved/recipes/new">Add recipe</Link>} />}
      <section className="recipe-grid">{filtered.map((recipe, index) => <RecipeCard recipe={recipe} index={index} key={recipe.id} actions={<div className="recipe-card-actions">{confirmingId === recipe.id ? <><span>Remove this local draft?</span><button className="text-button" type="button" onClick={() => setConfirmingId(null)}>Keep</button><button className="text-button danger-text" type="button" onClick={() => remove(recipe)}>Remove</button></> : <><Link className="text-button" to={`/saved/recipes/${recipe.id}/edit`}><Edit3 size={14} /> Edit</Link><button className="icon-button" type="button" aria-label={`Remove ${recipe.name}`} onClick={() => setConfirmingId(recipe.id)}><Trash2 size={16} /></button><Link className="recipe-cook-action" to={`/cooking/recipes?selected=${encodeURIComponent(recipe.id)}`}><ChefHat size={15} /> Cook</Link></>}</div>} />)}</section>
    </div>
  )
}

type RecipeForm = {
  name: string
  category: string
  servings: string
  minutes: string
  ingredients: Array<{ name: string; quantity: string; unit: string }>
  steps: Array<{ instruction: string }>
}

export function RecipeEditorPage() {
  const { recipeId } = useParams()
  const { drafts, ownerId } = useRecipeDrafts()
  const existing = recipeId ? drafts.find((draft) => draft.id === recipeId) : undefined
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const { control, register, handleSubmit, formState: { errors } } = useForm<RecipeForm>({
    defaultValues: existing ? {
      name: existing.name,
      category: existing.category,
      servings: String(existing.servings),
      minutes: String(existing.minutes),
      ingredients: existing.ingredients.map((ingredient) => ({ name: ingredient.name, quantity: ingredient.quantity === null ? '' : String(ingredient.quantity), unit: ingredient.unit })),
      steps: existing.steps.map((instruction) => ({ instruction })),
    } : {
      name: '', category: 'Weeknight', servings: '2', minutes: '30',
      ingredients: [{ name: '', quantity: '', unit: '' }], steps: [{ instruction: '' }],
    },
  })
  const ingredients = useFieldArray({ control, name: 'ingredients' })
  const steps = useFieldArray({ control, name: 'steps' })

  const submit = handleSubmit((values) => {
    setFormError(null)
    const cleanedIngredients = values.ingredients.filter((ingredient) => ingredient.name.trim()).map((ingredient) => ({
      name: ingredient.name.trim(), quantity: ingredient.quantity.trim() ? Number(ingredient.quantity) : null, unit: ingredient.unit.trim(),
    }))
    const cleanedSteps = values.steps.map((step) => step.instruction.trim()).filter(Boolean)
    const servings = Number(values.servings)
    const minutes = Number(values.minutes)
    if (!cleanedIngredients.length || !cleanedSteps.length) { setFormError('Add at least one ingredient and one instruction.'); return }
    if (!Number.isInteger(servings) || servings < 1 || servings > 24) { setFormError('Servings must be between 1 and 24.'); return }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) { setFormError('Time must be between 1 and 1,440 minutes.'); return }
    if (cleanedIngredients.some((ingredient) => ingredient.quantity !== null && (!Number.isFinite(ingredient.quantity) || ingredient.quantity < 0))) { setFormError('Ingredient quantities must be zero or greater.'); return }
    const input: RecipeDraftInput = { name: values.name.trim(), category: values.category.trim(), servings, minutes, ingredients: cleanedIngredients, steps: cleanedSteps }
    saveRecipeDraft(ownerId, input, recipeId)
    showToast(recipeId ? 'Recipe updated on this device.' : 'Recipe added on this device.')
    navigate('/saved/recipes')
  })

  if (recipeId && !existing) return <div className="page section-page narrow-page"><Link className="back-link" to="/saved/recipes"><ArrowLeft size={16} /> My recipes</Link><EmptyState title="Recipe draft not found" message="It may have been removed from this browser or belongs to another FoodMind account." /></div>

  return (
    <div className="page section-page recipe-editor-page">
      <Link className="back-link" to="/saved/recipes"><ArrowLeft size={16} /> My recipes</Link>
      <header className="section-page-heading"><div><p className="eyebrow">Device-local draft</p><h1>{recipeId ? 'Edit your recipe.' : 'Add a recipe you know.'}</h1><p>FoodMind uses these ingredient lines as manual input when you ask the existing cooking-plan API to build a plan.</p></div><span className="cooking-mark"><NotebookTabs /></span></header>
      <form className="recipe-editor-form" onSubmit={submit} noValidate>
        {formError && <div className="form-alert" role="alert">{formError}</div>}
        <section className="recipe-editor-basics"><div className="section-topline"><div><p className="eyebrow">The basics</p><h2>Name the recipe</h2></div></div><div className="form-grid"><label>Recipe name<input maxLength={140} {...register('name', { required: 'Enter a recipe name.' })} />{errors.name && <small>{errors.name.message}</small>}</label><label>Category<input maxLength={60} {...register('category', { required: 'Enter a category.' })} /></label><label>Servings<input type="number" min="1" max="24" {...register('servings')} /></label><label>Estimated minutes<input type="number" min="1" max="1440" {...register('minutes')} /></label></div></section>
        <section className="recipe-editor-section"><div className="section-topline"><div><p className="eyebrow">Ingredients</p><h2>What goes in</h2></div><button className="secondary-action" type="button" disabled={ingredients.fields.length >= 30} onClick={() => ingredients.append({ name: '', quantity: '', unit: '' })}><Plus size={15} /> Add ingredient</button></div><div className="recipe-line-list">{ingredients.fields.map((field, index) => <div className="recipe-ingredient-line" key={field.id}><label><span>Ingredient {index + 1}</span><input maxLength={160} placeholder="e.g. firm tofu" {...register(`ingredients.${index}.name`)} /></label><label><span>Quantity</span><input type="number" min="0" step="0.01" {...register(`ingredients.${index}.quantity`)} /></label><label><span>Unit</span><input maxLength={40} placeholder="g, cups…" {...register(`ingredients.${index}.unit`)} /></label><button className="icon-button" type="button" aria-label={`Remove ingredient ${index + 1}`} disabled={ingredients.fields.length === 1} onClick={() => ingredients.remove(index)}><Minus size={16} /></button></div>)}</div></section>
        <section className="recipe-editor-section"><div className="section-topline"><div><p className="eyebrow">Method</p><h2>How it comes together</h2></div><button className="secondary-action" type="button" onClick={() => steps.append({ instruction: '' })}><Plus size={15} /> Add step</button></div><div className="recipe-step-list">{steps.fields.map((field, index) => <label key={field.id}><span>{index + 1}</span><textarea rows={2} maxLength={1_000} placeholder="Write one clear cooking instruction" {...register(`steps.${index}.instruction`)} /><button className="icon-button" type="button" aria-label={`Remove step ${index + 1}`} disabled={steps.fields.length === 1} onClick={() => steps.remove(index)}><Minus size={16} /></button></label>)}</div></section>
        <div className="recipe-editor-actions"><span><ShieldCheck size={16} /> Saved only in this browser for the signed-in account.</span><Link className="secondary-action" to="/saved/recipes">Cancel</Link><button className="primary-action" type="submit"><Check size={17} /> Save recipe</button></div>
      </form>
    </div>
  )
}

export function CookingRecipeSelectPage() {
  const { drafts } = useRecipeDrafts()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const command = useRef<PendingCommand | null>(null)
  const initialSelection = useMemo(() => new Set((searchParams.get('selected') || '').split(',').filter((id) => drafts.some((draft) => draft.id === id))), [drafts, searchParams])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelection)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [servings, setServings] = useState(2)
  const [maxMinutes, setMaxMinutes] = useState('')
  const categories = useMemo(() => ['All', ...new Set(drafts.map((draft) => draft.category))], [drafts])
  const recipes = drafts.filter((draft) => (category === 'All' || draft.category === category) && draft.name.toLowerCase().includes(query.trim().toLowerCase()))
  const selectedRecipes = drafts.filter((draft) => selectedIds.has(draft.id))
  const requestIngredients = scaledRecipeIngredients(selectedRecipes, servings)
  const tooManyIngredients = requestIngredients.length > 30
  const generate = useMutation({
    mutationFn: async (input: { body: Schema<'GenerateCookingPlanRequest'>; key: string }) => dataOrThrow<Schema<'CookingPlanResponse'>>(await api.POST('/cooking-plans/generate', { body: input.body, params: { header: { 'Idempotency-Key': input.key } } })),
    onSuccess: (plan) => {
      command.current = null
      queryClient.setQueryData(queryKeys.cooking.detail(plan.planId), plan)
      void queryClient.invalidateQueries({ queryKey: queryKeys.cooking.history() })
      navigate(`/cooking/${plan.planId}`)
    },
  })
  const toggle = (id: string) => setSelectedIds((current) => {
    const next = new Set(current)
    if (!next.delete(id)) next.add(id)
    return next
  })
  const submit = () => {
    if (!selectedRecipes.length || tooManyIngredients || requestIngredients.length === 0) return
    const body: Schema<'GenerateCookingPlanRequest'> = { ingredients: requestIngredients, servings, maxMinutes: maxMinutes ? Number(maxMinutes) : null }
    command.current = prepareCommand(command.current, body)
    generate.mutate({ body, key: command.current.key })
  }

  return (
    <div className="page section-page cooking-select-page">
      <header className="section-page-heading"><div><p className="eyebrow">Cook mode · recipe selection</p><h1>Choose what you want to cook.</h1><p>Select one or more local recipe drafts. FoodMind scales their ingredient lines and asks the real backend for one safe, ordered plan.</p></div><Link className="secondary-action" to="/saved/recipes"><ListChecks size={17} /> Manage recipes</Link></header>
      <nav className="cooking-path-tabs" aria-label="Cooking input method"><Link className="active" to="/cooking/recipes"><NotebookTabs size={16} /> Choose recipes</Link><Link to="/cooking"><ChefHat size={16} /> Enter ingredients</Link></nav>
      <div className="local-draft-note"><ShieldCheck size={17} /><span>Recipes stay on this device. Only the selected ingredient lines and plan constraints are sent to FoodMind.</span></div>
      <section className="recipe-toolbar" aria-label="Recipe selection filters"><label className="recipe-search"><Search size={17} /><span className="sr-only">Search recipes to cook</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes" /></label><div className="recipe-categories">{categories.map((value) => <button className={category === value ? 'active' : ''} type="button" onClick={() => setCategory(value)} key={value}>{value}</button>)}</div></section>
      {!recipes.length && <EmptyState title="No recipe matches" message="Change the filters or add a local recipe draft first." action={<Link className="primary-action" to="/saved/recipes/new">Add recipe</Link>} />}
      <section className="recipe-grid cooking-recipe-grid">{recipes.map((recipe, index) => <RecipeCard recipe={recipe} index={index} selected={selectedIds.has(recipe.id)} onToggle={() => toggle(recipe.id)} key={recipe.id} />)}</section>
      <section className="recipe-selection-dock" aria-label="Selected recipes and plan constraints">
        <div className="selection-summary"><span>{selectedRecipes.length}</span><div><strong>{selectedRecipes.length === 1 ? 'recipe selected' : 'recipes selected'}</strong><small>{requestIngredients.length} ingredient lines will be sent</small></div></div>
        <label><Users size={15} /><span>Servings</span><input type="number" min="1" max="24" value={servings} onChange={(event) => setServings(Math.max(1, Math.min(24, Number(event.target.value) || 1)))} /></label>
        <label><Clock3 size={15} /><span>Time limit</span><input type="number" min="1" max="1440" value={maxMinutes} onChange={(event) => setMaxMinutes(event.target.value)} placeholder="Any" /></label>
        <button className="generate-button" type="button" disabled={!selectedRecipes.length || tooManyIngredients || generate.isPending} onClick={submit}>{generate.isPending ? 'Building your plan…' : <>Generate plan <ArrowRight size={17} /></>}</button>
      </section>
      {tooManyIngredients && <div className="form-alert selection-error" role="alert">This selection has {requestIngredients.length} ingredient lines. Choose fewer recipes so the existing API limit of 30 is respected.</div>}
      {generate.isError && <div className="form-alert selection-error" role="alert">{errorMessage(generate.error)}</div>}
    </div>
  )
}
