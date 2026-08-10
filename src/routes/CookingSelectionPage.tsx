import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Bot, Check, Clock3, ListChecks, NotebookTabs, Search, Settings, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { prepareCommand, type PendingCommand } from '../lib/commands'
import { loadCookingPreferences } from '../lib/cooking-preferences'

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : null
}

function RecipeCard({ recipe, selected, onToggle }: {
  recipe: Schema<'UserRecipeResponse'>
  selected: boolean
  onToggle: () => void
}) {
  return (
    <article className={`recipe-card selectable${selected ? ' selected' : ''}`}>
      <button className="recipe-card-toggle" type="button" aria-label={`${selected ? 'Remove' : 'Select'} ${recipe.name}`} aria-pressed={selected} onClick={onToggle}>
        <div className="recipe-card-photo">
          {recipe.imageUrl ? <img src={recipe.imageUrl} alt="" loading="lazy" /> : <span className="recipe-image-fallback">{recipe.name.slice(0, 1)}</span>}
          <small>{recipe.tags?.[0] || 'Recipe'}</small>
          {selected && <i><Check size={16} /></i>}
        </div>
        <div className="recipe-card-copy">
          <p className="eyebrow">{recipe.ingredients.length} ingredients · {recipe.steps.length} steps</p>
          <h2>{recipe.name}</h2>
          <div className="recipe-card-meta"><span><Users size={14} /> Base {recipe.servings} servings</span><span><Clock3 size={14} /> Backend recipe</span></div>
          <p className="recipe-card-note">{recipe.ingredients.slice(0, 3).join(' · ')}</p>
        </div>
      </button>
      <Link className="recipe-card-edit" to={`/saved/recipes/${recipe.id}/edit`}>Edit</Link>
    </article>
  )
}

export function CookingSelectPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const command = useRef<PendingCommand | null>(null)
  const [searchParams] = useSearchParams()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [servings, setServings] = useState(2)
  const [servingsTouched, setServingsTouched] = useState(false)
  const [maxMinutes, setMaxMinutes] = useState('')
  const preferences = useMemo(loadCookingPreferences, [])
  const recipes = useQuery({
    queryKey: queryKeys.recipes.list(),
    queryFn: async () => dataOrThrow<Schema<'UserRecipePageResponse'>>(await api.GET('/recipes', { params: { query: { page: 0, size: 100 } } })),
  })

  useEffect(() => {
    const ids = (searchParams.get('selected') || '').split(',').filter(Boolean)
    if (ids.length) setSelectedIds(new Set(ids))
  }, [searchParams])

  const recipeItems = useMemo(() => (recipes.data?.items || []) as Schema<'UserRecipeResponse'>[], [recipes.data?.items])
  const visible = useMemo(() => recipeItems.filter((recipe) =>
    `${recipe.name} ${(recipe.tags || []).join(' ')} ${recipe.ingredients.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [recipeItems, query])
  const selectedRecipes = recipeItems.filter((recipe) => selectedIds.has(recipe.id))
  const suggestedServings = selectedRecipes.length ? Math.max(...selectedRecipes.map((recipe) => recipe.servings)) : 2
  const effectiveServings = servingsTouched ? servings : suggestedServings
  const body: Schema<'GenerateCookingPlanRequest'> = {
    recipeIds: selectedRecipes.map((recipe) => recipe.id),
    servings: effectiveServings,
    maxMinutes: optionalNumber(maxMinutes),
    region: preferences.region,
    requiredDietaryTagCodes: preferences.requiredDietaryTagCodes,
    avoidAllergenCodes: preferences.avoidAllergenCodes,
  }
  const generate = useMutation({
    mutationFn: async (input: { body: Schema<'GenerateCookingPlanRequest'>; key: string }) => dataOrThrow(await api.POST('/cooking-plans/generate-async', { body: input.body, params: { header: { 'Idempotency-Key': input.key } } })),
    onSuccess: (plan) => {
      command.current = null
      queryClient.setQueryData(queryKeys.cooking.detail(plan.planId), plan.status === 'PROCESSING' ? { planId: plan.planId, status: 'PROCESSING' as const } : plan)
      void queryClient.invalidateQueries({ queryKey: queryKeys.cooking.history() })
      navigate(`/cooking/${plan.planId}`)
    },
  })
  const submit = () => {
    if (!selectedRecipes.length || generate.isPending) return
    command.current = prepareCommand(command.current, body)
    generate.mutate({ body, key: command.current.key })
  }

  return (
    <div className="page section-page cooking-select-page">
      <header className="section-page-heading"><div><p className="eyebrow">Cook mode · recipe selection</p><h1>What do you want to cook tonight?</h1><p>Select backend-owned recipes. FoodMind checks real inventory for the requested servings before it builds a plan.</p></div><div className="heading-actions"><Link className="primary-action" to="/saved/recipes/new"><Bot size={17} /> Add recipes with Agent</Link></div></header>
      <nav className="cooking-path-tabs" aria-label="Cooking pages"><Link className="active" to="/cooking"><NotebookTabs size={16} /> Choose recipes</Link><Link to="/shopping-lists"><ListChecks size={16} /> Shopping lists</Link><Link to="/inventory"><NotebookTabs size={16} /> Inventory</Link><Link to="/cooking/history"><ListChecks size={16} /> History</Link><Link to="/cooking/settings"><Settings size={16} /> Settings</Link></nav>
      <div className="local-draft-note"><NotebookTabs size={17} /><span><strong>Backend-controlled inputs.</strong> The request sends exact recipe IDs; Backend reloads the recipe ingredients and current inventory for the Agent.</span></div>
      <section className="recipe-toolbar" aria-label="Recipe selection filters"><label className="recipe-search"><Search size={17} /><span className="sr-only">Search recipes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes" /></label></section>
      {recipes.isLoading && <LoadingState label="Loading recipes…" />}
      {recipes.isError && <ErrorState error={recipes.error} onRetry={() => void recipes.refetch()} />}
      {recipes.isSuccess && !visible.length && <EmptyState title="No recipes available" message="Create a backend recipe before generating a Cooking Plan." action={<Link className="primary-action" to="/saved/recipes/new">Add recipe</Link>} />}
      <section className="recipe-grid cooking-recipe-grid">{visible.map((recipe) => <RecipeCard recipe={recipe} selected={selectedIds.has(recipe.id)} onToggle={() => setSelectedIds((current) => { const next = new Set(current); if (!next.delete(recipe.id)) next.add(recipe.id); return next })} key={recipe.id} />)}</section>
      <section className="recipe-selection-dock" aria-label="Selected recipes and plan constraints">
        <div className="selection-summary"><span>{selectedRecipes.length}</span><div><strong>{selectedRecipes.length === 1 ? 'dish selected' : 'dishes selected'}</strong><small>Real inventory will be checked</small></div></div>
        <label><Users size={15} /><span>Servings</span><input type="number" min="1" max="24" value={effectiveServings} onChange={(event) => { setServingsTouched(true); setServings(Math.max(1, Math.min(24, Number(event.target.value) || 1))) }} /></label>
        <label><Clock3 size={15} /><span>Time limit</span><input type="number" min="1" max="1440" value={maxMinutes} onChange={(event) => setMaxMinutes(event.target.value)} placeholder="Any" /></label>
        <button className="generate-button" type="button" disabled={!selectedRecipes.length || generate.isPending} onClick={submit}>{generate.isPending ? 'Submitting to Cooking Agent…' : <>Generate plan <ArrowRight size={17} /></>}</button>
      </section>
      {generate.isError && <div className="form-alert selection-error" role="alert">{errorMessage(generate.error)}</div>}
    </div>
  )
}
