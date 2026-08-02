import { useFieldArray, useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, ChefHat, Check, Clock3, Plus, ShoppingBasket, Trash2, Users, WalletCards } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, FallbackBanner, LoadingState } from '../components/feedback/States'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { prepareCommand, type PendingCommand } from '../lib/commands'
import { formatDateTime, sentenceCase } from '../lib/format'

type CookingForm = {
  ingredients: Array<{ ingredientName: string; quantity: string; unit: string }>
  servings: string
  maxMinutes: string
  maxBudget: string
  currency: string
  requiredDietaryTagCodes: string[]
  avoidAllergenCodes: string[]
}

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : null
}

export function CookingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const command = useRef<PendingCommand | null>(null)
  const reference = useQuery({ queryKey: queryKeys.catalogue.reference(), staleTime: Infinity, queryFn: async () => dataOrThrow<Schema<'CatalogueReferenceDataResponse'>>(await api.GET('/catalogue/reference-data')) })
  const history = useQuery({ queryKey: queryKeys.cooking.history(), queryFn: async () => dataOrThrow<Schema<'CookingPlanHistoryResponse'>>(await api.GET('/cooking-plans/history', { params: { query: { page: 0, size: 8 } } })) })
  const historyItems = (history.data?.items || []) as Schema<'CookingPlanSummary'>[]
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<CookingForm>({ defaultValues: { ingredients: [{ ingredientName: '', quantity: '', unit: '' }], servings: '2', maxMinutes: '', maxBudget: '', currency: 'SGD', requiredDietaryTagCodes: [], avoidAllergenCodes: [] } })
  const ingredients = useFieldArray({ control, name: 'ingredients' })
  const generate = useMutation({
    mutationFn: async (input: { body: Schema<'GenerateCookingPlanRequest'>; key: string }) => dataOrThrow<Schema<'CookingPlanResponse'>>(await api.POST('/cooking-plans/generate', { body: input.body, params: { header: { 'Idempotency-Key': input.key } } })),
    onSuccess: (plan) => { command.current = null; queryClient.setQueryData(queryKeys.cooking.detail(plan.planId), plan); void queryClient.invalidateQueries({ queryKey: queryKeys.cooking.history() }); navigate(`/cooking/${plan.planId}`) },
  })
  const submit = handleSubmit((values) => {
    const nonEmpty = values.ingredients.filter((item) => item.ingredientName.trim())
    if (!nonEmpty.length) { setError('ingredients', { message: 'Add at least one ingredient.' }); return }
    const body: Schema<'GenerateCookingPlanRequest'> = {
      ingredients: nonEmpty.map((item) => ({ ingredientName: item.ingredientName.trim(), quantity: optionalNumber(item.quantity), unit: item.unit || null, source: 'MANUAL' })),
      servings: Number(values.servings), maxMinutes: optionalNumber(values.maxMinutes), maxBudget: optionalNumber(values.maxBudget), currency: values.maxBudget ? values.currency.toUpperCase() : null,
      requiredDietaryTagCodes: values.requiredDietaryTagCodes, avoidAllergenCodes: values.avoidAllergenCodes,
    }
    command.current = prepareCommand(command.current, body)
    generate.mutate({ body, key: command.current.key })
  })

  return (
    <div className="page section-page cooking-page">
      <header className="section-page-heading"><div><p className="eyebrow">Manual ingredients · no pantry claims</p><h1>Cook with what you know you have.</h1><p>Give FoodMind 1–30 ingredients. It will return a structured plan or an honest fallback.</p></div><span className="cooking-mark"><ChefHat /></span></header>
      <nav className="cooking-path-tabs" aria-label="Cooking input method"><Link to="/cooking/recipes"><ChefHat size={16} /> Choose recipes</Link><Link className="active" to="/cooking"><ShoppingBasket size={16} /> Enter ingredients</Link></nav>
      <form className="cooking-builder" onSubmit={submit}>
        <section className="ingredient-panel"><div className="section-topline"><div><p className="eyebrow">Step 1</p><h2>What's available?</h2></div><button className="secondary-action" type="button" disabled={ingredients.fields.length >= 30} onClick={() => ingredients.append({ ingredientName: '', quantity: '', unit: '' })}><Plus size={16} /> Add ingredient</button></div>{errors.ingredients?.message && <div className="form-alert">{errors.ingredients.message}</div>}<div className="ingredient-list">{ingredients.fields.map((field, index) => <div className="ingredient-row" key={field.id}><label><span>Ingredient {index + 1}</span><input placeholder="e.g. firm tofu" {...register(`ingredients.${index}.ingredientName`)} /></label><label><span>Quantity</span><input type="number" min="0" step="0.01" {...register(`ingredients.${index}.quantity`)} /></label><label><span>Unit</span><input placeholder="g, cups…" {...register(`ingredients.${index}.unit`)} /></label><button className="icon-button" type="button" aria-label={`Remove ingredient ${index + 1}`} disabled={ingredients.fields.length === 1} onClick={() => ingredients.remove(index)}><Trash2 size={17} /></button></div>)}</div></section>
        <section className="cooking-context"><div><p className="eyebrow">Step 2</p><h2>Shape the plan</h2></div><div className="form-grid"><label><Users size={16} /> Servings<input type="number" min="1" max="20" {...register('servings')} /></label><label><Clock3 size={16} /> Maximum minutes<input type="number" min="1" {...register('maxMinutes')} /></label><label><WalletCards size={16} /> Extra budget<input type="number" min="0" step="0.01" {...register('maxBudget')} /></label><label>Currency<input maxLength={3} {...register('currency')} /></label></div><fieldset><legend>Dietary requirements</legend><div className="check-grid">{reference.data?.dietaryTags.map((item) => <label className="check-control" key={item.code}><input type="checkbox" value={item.code} {...register('requiredDietaryTagCodes')} /><span>{item.name}</span></label>)}</div></fieldset><fieldset><legend>Allergens to avoid</legend><div className="check-grid">{reference.data?.allergens.map((item) => <label className="check-control" key={item.code}><input type="checkbox" value={item.code} {...register('avoidAllergenCodes')} /><span>{item.name}</span></label>)}</div></fieldset>{generate.isError && <div className="form-alert" role="alert">{errorMessage(generate.error)}</div>}<button className="generate-button" type="submit" disabled={generate.isPending}>{generate.isPending ? 'Building your plan…' : <><ChefHat size={19} /> Generate cooking plan <ArrowRight size={17} /></>}</button></section>
      </form>
      <section className="history-strip"><div className="section-topline"><div><p className="eyebrow">Recent plans</p><h2>Cooking history</h2></div></div>{history.isLoading && <LoadingState label="Loading cooking history…" />}{history.isError && <ErrorState error={history.error} onRetry={() => void history.refetch()} />}{history.isSuccess && !historyItems.length && <EmptyState title="No cooking plans yet" message="Your first generated plan will appear here." />}<div className="mini-card-grid">{historyItems.map((plan) => <Link className="mini-card" to={`/cooking/${plan.planId}`} key={plan.planId}><span><ChefHat /></span><div><p className="eyebrow">{sentenceCase(plan.status)}</p><h3>{plan.inputCount || 0} ingredients · {plan.stepCount || 0} steps</h3><small>{formatDateTime(plan.createdAt)}</small></div><ArrowRight size={16} /></Link>)}</div></section>
    </div>
  )
}

export function CookingDetailPage() {
  const { planId = '' } = useParams()
  const progressKey = `foodmind.cooking-progress.v1:${planId}`
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    try {
      const stored = window.sessionStorage.getItem(progressKey)
      return new Set(stored ? JSON.parse(stored) as number[] : [])
    } catch { return new Set() }
  })
  useEffect(() => {
    try { window.sessionStorage.setItem(progressKey, JSON.stringify([...completedSteps])) } catch { /* execution progress remains optional session state */ }
  }, [completedSteps, progressKey])
  const plan = useQuery({ queryKey: queryKeys.cooking.detail(planId), queryFn: async () => dataOrThrow<Schema<'CookingPlanResponse'>>(await api.GET('/cooking-plans/{planId}', { params: { path: { planId } } })) })
  if (plan.isLoading) return <div className="page"><LoadingState label="Opening your cooking plan…" /></div>
  if (plan.isError) return <div className="page"><ErrorState error={plan.error} onRetry={() => void plan.refetch()} /></div>
  const data = plan.data!
  if (data.status === 'NO_VALID_RECIPE' || data.status === 'FAILED') return <div className="page section-page"><Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link><EmptyState title={data.status === 'NO_VALID_RECIPE' ? 'No valid recipe matched' : 'A plan could not be completed'} message="Your dietary and allergen rules stayed in place. Adjust the manual ingredients or constraints and try again." action={<Link className="primary-action" to="/cooking">Edit ingredients</Link>} /></div>
  return (
    <div className="page section-page cooking-result-page"><Link className="back-link" to="/cooking/recipes"><ArrowLeft size={16} /> Cook mode</Link><header className="section-page-heading"><div><p className="eyebrow">{sentenceCase(data.status)} · {formatDateTime(data.completedAt)}</p><h1>Your FoodMind cooking plan</h1><p>{data.ingredients.length} ingredients and {data.steps.length} ordered steps, grounded in the inputs you supplied.</p></div><span className="cooking-mark"><ChefHat /></span></header>{data.status === 'FALLBACK_SUCCEEDED' && <FallbackBanner message="The Cooking Agent path was unavailable or invalid, so FoodMind used its deterministic fallback plan." />}
      <section className="cooking-progress-card"><div><p className="eyebrow">Session progress</p><h2>{completedSteps.size} of {data.steps.length} steps complete</h2></div><strong>{data.steps.length ? Math.round(completedSteps.size / data.steps.length * 100) : 0}%</strong><div className="cooking-progress-track" role="progressbar" aria-label="Cooking plan completion" aria-valuemin={0} aria-valuemax={data.steps.length} aria-valuenow={completedSteps.size}><span style={{ width: `${data.steps.length ? completedSteps.size / data.steps.length * 100 : 0}%` }} /></div>{completedSteps.size > 0 && <button className="text-button" type="button" onClick={() => setCompletedSteps(new Set())}>Reset progress</button>}<small>Checkmarks stay in this browser session and do not claim backend completion or inventory changes.</small></section>
      <div className="cooking-result-grid"><section className="detail-card"><p className="eyebrow">Ingredient plan</p><h2>Use what is available. Note what to buy.</h2><div className="ingredient-result-list">{data.ingredients.map((item, index) => <div className="ingredient-result" key={`${item.sequenceNo}-${index}`}><span className={item.availability === 'AVAILABLE' ? 'available' : 'to-buy'}>{item.availability === 'AVAILABLE' ? <Check size={15} /> : <ShoppingBasket size={15} />}{sentenceCase(item.availability)}</span><strong>{item.ingredientName || 'Ingredient'}</strong><small>{item.quantity ?? ''} {item.unit || ''}</small></div>)}</div></section><section className="detail-card steps-card"><p className="eyebrow">Ordered method</p><h2>Cook step by step.</h2><ol className="cooking-steps interactive-steps">{[...data.steps].sort((a, b) => (a.stepNo || 0) - (b.stepNo || 0)).map((step, index) => { const stepNumber = step.stepNo || index + 1; const done = completedSteps.has(stepNumber); return <li className={done ? 'complete' : ''} key={`${step.stepNo}-${index}`}><button type="button" aria-pressed={done} aria-label={`${done ? 'Mark incomplete' : 'Mark complete'}: step ${stepNumber}`} onClick={() => setCompletedSteps((current) => { const next = new Set(current); if (!next.delete(stepNumber)) next.add(stepNumber); return next })}>{done ? <Check size={17} /> : stepNumber}</button><p>{step.instruction}</p></li> })}</ol></section></div>
      {data.warnings.length > 0 && <section className="warning-list"><p className="eyebrow">Plan notes</p><h2>Keep these in mind</h2>{data.warnings.map((warning, index) => <div key={`${warning.sequenceNo}-${index}`}><strong>{sentenceCase(warning.warningCode)}</strong><p>{warning.message}</p></div>)}</section>}
      <p className="field-note">The current backend response does not expose a recipe title, explanation, serving summary, or total time. FoodMind shows only the structured plan fields it actually returned.</p>
    </div>
  )
}
