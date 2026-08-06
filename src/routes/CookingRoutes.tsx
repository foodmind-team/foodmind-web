import { useFieldArray, useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Ban, Check, ChefHat, Clock3, Plus, ShoppingBasket, Trash2, Users, WalletCards } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { ApiError, api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
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

const NODE_LABELS: Record<string, string> = {
  assemble_request: 'Assembling your cooking request…',
  solve_schedule: 'Solving the cooking schedule…',
  validate_result: 'Validating the generated plan…',
  materialise: 'Saving your plan…',
}

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : null
}

function errorStatus(error: unknown) {
  return error instanceof ApiError ? error.status : undefined
}

function progressCopy(progress: Schema<'CookingPlanTaskProgressResponse'> | undefined) {
  if (progress?.message) return progress.message
  if (progress?.node && NODE_LABELS[progress.node]) return NODE_LABELS[progress.node]
  return 'Working on your cooking plan…'
}

function formatMinute(minute?: number) {
  if (minute === undefined || minute === null) return ''
  return `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`
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
  const generateAsync = useMutation({
    mutationFn: async (input: { body: Schema<'GenerateCookingPlanRequest'>; key: string }) => dataOrThrow(await api.POST('/cooking-plans/generate-async', { body: input.body, params: { header: { 'Idempotency-Key': input.key } } })),
    onSuccess: (result) => {
      command.current = null
      queryClient.setQueryData(queryKeys.cooking.detail(result.planId), result.status === 'PROCESSING' ? { planId: result.planId, status: 'PROCESSING' as const } : result)
      void queryClient.invalidateQueries({ queryKey: queryKeys.cooking.history() })
      navigate(`/cooking/${result.planId}`)
    },
  })
  const buildBody = (values: CookingForm): Schema<'GenerateCookingPlanRequest'> => {
    const nonEmpty = values.ingredients.filter((item) => item.ingredientName.trim())
    return {
      ingredients: nonEmpty.map((item) => ({ ingredientName: item.ingredientName.trim(), quantity: optionalNumber(item.quantity), unit: item.unit || null, source: 'MANUAL' })),
      servings: Number(values.servings), maxMinutes: optionalNumber(values.maxMinutes), maxBudget: optionalNumber(values.maxBudget), currency: values.maxBudget ? values.currency.toUpperCase() : null,
      requiredDietaryTagCodes: values.requiredDietaryTagCodes, avoidAllergenCodes: values.avoidAllergenCodes,
    }
  }
  const requireIngredients = (values: CookingForm) => {
    if (!values.ingredients.some((item) => item.ingredientName.trim())) { setError('ingredients', { message: 'Add at least one ingredient.' }); return null }
    return buildBody(values)
  }
  const submit = handleSubmit((values) => { const body = requireIngredients(values); if (!body) return; command.current = prepareCommand(command.current, body); generate.mutate({ body, key: command.current.key }) })
  const submitAsync = handleSubmit((values) => { const body = requireIngredients(values); if (!body) return; command.current = prepareCommand(command.current, body); generateAsync.mutate({ body, key: command.current.key }) })

  return (
    <div className="page section-page cooking-page">
      <header className="section-page-heading"><div><p className="eyebrow">Manual ingredients · no pantry claims</p><h1>Cook with what you know you have.</h1><p>Give FoodMind 1–30 ingredients. It will return a structured plan or an honest fallback.</p></div><span className="cooking-mark"><ChefHat /></span></header>
      <nav className="cooking-path-tabs" aria-label="Cooking input method"><Link to="/cooking/recipes"><ChefHat size={16} /> Choose recipes</Link><Link className="active" to="/cooking"><ShoppingBasket size={16} /> Enter ingredients</Link></nav>
      <form className="cooking-builder" onSubmit={submit}>
        <section className="ingredient-panel"><div className="section-topline"><div><p className="eyebrow">Step 1</p><h2>What's available?</h2></div><button className="secondary-action" type="button" disabled={ingredients.fields.length >= 30} onClick={() => ingredients.append({ ingredientName: '', quantity: '', unit: '' })}><Plus size={16} /> Add ingredient</button></div>{errors.ingredients?.message && <div className="form-alert">{errors.ingredients.message}</div>}<div className="ingredient-list">{ingredients.fields.map((field, index) => <div className="ingredient-row" key={field.id}><label><span>Ingredient {index + 1}</span><input placeholder="e.g. firm tofu" {...register(`ingredients.${index}.ingredientName`)} /></label><label><span>Quantity</span><input type="number" min="0" step="0.01" {...register(`ingredients.${index}.quantity`)} /></label><label><span>Unit</span><input placeholder="g, cups…" {...register(`ingredients.${index}.unit`)} /></label><button className="icon-button" type="button" aria-label={`Remove ingredient ${index + 1}`} disabled={ingredients.fields.length === 1} onClick={() => ingredients.remove(index)}><Trash2 size={17} /></button></div>)}</div></section>
        <section className="cooking-context"><div><p className="eyebrow">Step 2</p><h2>Shape the plan</h2></div><div className="form-grid"><label><Users size={16} /> Servings<input type="number" min="1" max="20" {...register('servings')} /></label><label><Clock3 size={16} /> Maximum minutes<input type="number" min="1" {...register('maxMinutes')} /></label><label><WalletCards size={16} /> Extra budget<input type="number" min="0" step="0.01" {...register('maxBudget')} /></label><label>Currency<input maxLength={3} {...register('currency')} /></label></div><fieldset><legend>Dietary requirements</legend><div className="check-grid">{reference.data?.dietaryTags.map((item) => <label className="check-control" key={item.code}><input type="checkbox" value={item.code} {...register('requiredDietaryTagCodes')} /><span>{item.name}</span></label>)}</div></fieldset><fieldset><legend>Allergens to avoid</legend><div className="check-grid">{reference.data?.allergens.map((item) => <label className="check-control" key={item.code}><input type="checkbox" value={item.code} {...register('avoidAllergenCodes')} /><span>{item.name}</span></label>)}</div></fieldset>{generate.isError && <div className="form-alert" role="alert">{errorMessage(generate.error)}</div>}{generateAsync.isError && <div className="form-alert" role="alert">{errorMessage(generateAsync.error)}</div>}<div className="generate-actions"><button className="generate-button" type="submit" disabled={generate.isPending || generateAsync.isPending}>{generate.isPending ? 'Building your plan…' : <><ChefHat size={19} /> Generate cooking plan <ArrowRight size={17} /></>}</button><button className="secondary-action" type="button" disabled={generate.isPending || generateAsync.isPending} onClick={submitAsync}>{generateAsync.isPending ? 'Submitting…' : <><Clock3 size={16} /> Generate in background</>}</button></div></section>
      </form>
      <section className="history-strip"><div className="section-topline"><div><p className="eyebrow">Recent plans</p><h2>Cooking history</h2></div></div>{history.isLoading && <LoadingState label="Loading cooking history…" />}{history.isError && <ErrorState error={history.error} onRetry={() => void history.refetch()} />}{history.isSuccess && !historyItems.length && <EmptyState title="No cooking plans yet" message="Your first generated plan will appear here." />}<div className="mini-card-grid">{historyItems.map((plan) => <Link className="mini-card" to={`/cooking/${plan.planId}`} key={plan.planId}><span><ChefHat /></span><div><p className="eyebrow">{sentenceCase(plan.status)}</p><h3>{plan.sourceCount || 0} sources · {plan.taskCount || 0} tasks</h3><small>{formatDateTime(plan.createdAt)}</small></div><ArrowRight size={16} /></Link>)}</div></section>
    </div>
  )
}

export function CookingDetailPage() {
  const { planId = '' } = useParams()
  const queryClient = useQueryClient()
  const progressKey = `foodmind.cooking-tasks.v1:${planId}`
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(() => {
    try {
      const stored = window.sessionStorage.getItem(progressKey)
      return new Set(stored ? JSON.parse(stored) as string[] : [])
    } catch { return new Set() }
  })
  useEffect(() => {
    try { window.sessionStorage.setItem(progressKey, JSON.stringify([...completedTasks])) } catch { /* execution progress remains optional session state */ }
  }, [completedTasks, progressKey])
  const plan = useQuery({ queryKey: queryKeys.cooking.detail(planId), queryFn: async () => dataOrThrow<Schema<'CookingPlanResponse'>>(await api.GET('/cooking-plans/{planId}', { params: { path: { planId } } })) })
  const isProcessing = plan.data?.status === 'PROCESSING'
  const task = useQuery({
    queryKey: queryKeys.cooking.task(planId),
    queryFn: async () => dataOrThrow<Schema<'CookingPlanTaskResponse'>>(await api.GET('/cooking-plans/{planId}/task', { params: { path: { planId } } })),
    enabled: isProcessing,
    retry: false,
    refetchInterval: (query) => (errorStatus(query.state.error) === 404 ? false : 2000),
  })
  const taskEnded = useRef(false)
  useEffect(() => {
    if (errorStatus(task.error) === 404 && !taskEnded.current) {
      taskEnded.current = true
      void plan.refetch()
    }
  }, [task.error, plan])
  const cancel = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'CookingPlanResponse'>>(await api.POST('/cooking-plans/{planId}/cancel', { params: { path: { planId } } })),
    onSuccess: (result) => { queryClient.setQueryData(queryKeys.cooking.detail(planId), result); void plan.refetch() },
    onError: (error) => { if (errorStatus(error) === 409) void plan.refetch() },
  })
  if (plan.isLoading) return <div className="page"><LoadingState label="Opening your cooking plan…" /></div>
  if (plan.isError) return <div className="page"><ErrorState error={plan.error} onRetry={() => void plan.refetch()} /></div>
  const data = plan.data!
  if (data.status === 'PROCESSING') {
    const progress = task.data?.progress
    return (
      <div className="page section-page cooking-result-page">
        <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
        <header className="section-page-heading"><div><p className="eyebrow">PROCESSING · submitted {formatDateTime(data.createdAt)}</p><h1>Building your cooking plan</h1><p>The Cooking Agent is working in the background. Progress updates automatically.</p></div><span className="cooking-mark"><ChefHat /></span></header>
        <section className="cooking-progress-card" aria-busy="true"><div><p className="eyebrow">Agent progress</p><h2>{progressCopy(progress)}</h2></div><strong>{progress?.completedSteps ?? 0} steps completed</strong><small>{task.data ? `Task ${task.data.taskId} · ${task.data.syncState === 'PENDING' ? 'queued' : 'polling'}` : 'Starting the background task…'}</small></section>
        {cancel.isError && errorStatus(cancel.error) !== 409 && <div className="form-alert" role="alert">{errorMessage(cancel.error)}</div>}
        <div className="generate-actions"><button className="secondary-action" type="button" disabled={cancel.isPending} onClick={() => cancel.mutate()}><Ban size={16} /> {cancel.isPending ? 'Cancelling…' : 'Cancel this generation'}</button></div>
      </div>
    )
  }
  if (data.status === 'FAILED') {
    const cancelled = data.errorCode === 'TASK_CANCELLED'
    return (
      <div className="page section-page">
        <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
        <EmptyState title={cancelled ? 'Cooking plan cancelled' : 'A plan could not be completed'} message={cancelled ? 'You cancelled this generation before it finished. Nothing was saved.' : (data.errorMessage || sentenceCase(data.errorCode || 'FAILED'))} action={<Link className="primary-action" to="/cooking">Edit ingredients</Link>} />
      </div>
    )
  }
  if (data.status === 'INFEASIBLE') {
    return (
      <div className="page section-page">
        <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
        <header className="section-page-heading"><div><p className="eyebrow">{sentenceCase(data.status)} · {formatDateTime(data.completedAt)}</p><h1>No feasible cooking plan</h1><p>{data.explanation || 'Your constraints could not all be met. Review the reasons and adjust the inputs.'}</p></div><span className="cooking-mark"><ChefHat /></span></header>
        {data.reasons && data.reasons.length > 0 && <section className="warning-list"><p className="eyebrow">Why it did not fit</p><h2>Reasons</h2>{data.reasons.map((reason, index) => <div key={index}><p>{reason}</p></div>)}</section>}
        {data.safeAlternatives && data.safeAlternatives.length > 0 && <section className="detail-card"><p className="eyebrow">Safe alternatives</p><h2>You could still cook</h2><ul className="cooking-steps">{data.safeAlternatives.map((item, index) => <li key={index}><p>{item}</p></li>)}</ul></section>}
        <Link className="primary-action" to="/cooking">Edit ingredients</Link>
      </div>
    )
  }
  if (data.status === 'NEEDS_CONFIRMATION') {
    const questions = data.confirmationQuestions || []
    return (
      <div className="page section-page cooking-result-page">
        <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
        <header className="section-page-heading"><div><p className="eyebrow">{sentenceCase(data.status)} · {formatDateTime(data.createdAt)}</p><h1>Your plan needs a decision</h1><p>{data.explanation || 'The Cooking Agent produced a plan but needs a few answers before it can finish.'}</p></div><span className="cooking-mark"><ChefHat /></span></header>
        {questions.map((question) => <section className="detail-card" key={question.questionId || question.fieldPath || question.prompt || 'question'}><p className="eyebrow">{question.fieldPath ? sentenceCase(question.fieldPath) : 'Question'}</p><h2>{question.prompt}</h2>{question.options && question.options.map((option) => <label className="check-control" key={option.value}><input type="radio" name={`question-${question.questionId}`} disabled /><span>{option.label}{option.suggested ? ' · suggested' : ''}</span></label>)}<small>{question.required ? 'Required' : 'Optional'} answer{question.suggestedValue ? ` · suggested: ${question.suggestedValue}` : ''}</small></section>)}
        {!questions.length && <EmptyState title="Awaiting confirmation" message="This plan is waiting for decisions that are not available on this device yet." />}
        <p className="field-note">Submitting confirmation decisions from this device is not implemented yet. The plan stays pending until answered elsewhere.</p>
      </div>
    )
  }
  const tasks = [...(data.timeline || [])].sort((a, b) => (a.startMinute || 0) - (b.startMinute || 0))
  return (
    <div className="page section-page cooking-result-page">
      <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
      <header className="section-page-heading"><div><p className="eyebrow">{sentenceCase(data.status)} · {formatDateTime(data.completedAt)}</p><h1>Your FoodMind cooking plan</h1><p>{data.explanation || `${tasks.length} ordered tasks across the dishes you picked.`}</p></div><span className="cooking-mark"><ChefHat /></span></header>
      {data.solverStatus && <p className="field-note">Solver {sentenceCase(data.solverStatus)}{data.makespanMinutes != null ? ` · ${data.makespanMinutes} minute makespan` : ''}{data.region ? ` · region ${data.region}` : ''}</p>}
      <section className="cooking-progress-card"><div><p className="eyebrow">Session progress</p><h2>{completedTasks.size} of {tasks.length} tasks complete</h2></div><strong>{tasks.length ? Math.round(completedTasks.size / tasks.length * 100) : 0}%</strong><div className="cooking-progress-track" role="progressbar" aria-label="Cooking plan completion" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={completedTasks.size}><span style={{ width: `${tasks.length ? completedTasks.size / tasks.length * 100 : 0}%` }} /></div>{completedTasks.size > 0 && <button className="text-button" type="button" onClick={() => setCompletedTasks(new Set())}>Reset progress</button>}<small>Checkmarks stay in this browser session and do not claim backend completion or inventory changes.</small></section>
      <div className="cooking-result-grid">
        <section className="detail-card"><p className="eyebrow">Dishes</p><h2>Use what is available. Note what to buy.</h2><div className="ingredient-result-list">{data.sources && data.sources.map((source, index) => <div className="ingredient-result" key={`${source.sequenceNo}-${index}`}><span className={source.sourceType === 'OWNER' ? 'to-buy' : 'available'}>{source.sourceType === 'OWNER' ? <Users size={15} /> : <Check size={15} />}{sentenceCase(source.sourceType)}</span><strong>{source.dishName || 'Source dish'}</strong><small>{source.targetServings != null ? `${source.targetServings} servings` : ''}</small></div>)}</div></section>
        <section className="detail-card steps-card"><p className="eyebrow">Ordered method</p><h2>Cook step by step.</h2><ol className="cooking-steps interactive-steps">{tasks.map((taskItem, index) => { const taskId = taskItem.taskId || `${index}`; const done = completedTasks.has(taskId); return <li className={done ? 'complete' : ''} key={`${taskItem.taskId}-${index}`}><button type="button" aria-pressed={done} aria-label={`${done ? 'Mark incomplete' : 'Mark complete'}: ${taskItem.instruction || `task ${index + 1}`}`} onClick={() => setCompletedTasks((current) => { const next = new Set(current); if (!next.delete(taskId)) next.add(taskId); return next })}>{done ? <Check size={17} /> : index + 1}</button><p>{taskItem.instruction}</p>{taskItem.durationMinutes != null && <small>{taskItem.durationMinutes} min · starts {formatMinute(taskItem.startMinute)}{taskItem.workMode === 'PASSIVE' ? ' · passive' : ''}</small>}</li> })}</ol></section>
      </div>
      {data.miseEnPlace && data.miseEnPlace.length > 0 && <section className="detail-card"><p className="eyebrow">Mise en place</p><h2>Prep before cooking.</h2><ul className="cooking-steps">{data.miseEnPlace.map((item, index) => <li key={`${item.sequenceNo}-${index}`}><p>{item.instruction}</p><small>{[item.ingredient, item.operation, item.durationMinutes != null ? `${item.durationMinutes} min` : null, item.whenNeeded].filter(Boolean).join(' · ')}</small></li>)}</ul></section>}
      {data.dishCompletions && data.dishCompletions.length > 0 && <section className="detail-card"><p className="eyebrow">Completion</p><h2>When each dish is ready.</h2><div className="ingredient-result-list">{data.dishCompletions.map((dish, index) => <div className="ingredient-result" key={index}><span className={dish.isShared ? 'to-buy' : 'available'}>{dish.isShared ? <Users size={15} /> : <Check size={15} />}{dish.isShared ? 'Shared' : 'Solo'}</span><strong>{dish.dishId || 'Dish'}</strong><small>{formatMinute(dish.completionMinute)}{dish.taskCount != null ? ` · ${dish.taskCount} tasks` : ''}</small></div>)}</div></section>}
      {data.completionChecklist && data.completionChecklist.length > 0 && <section className="detail-card"><p className="eyebrow">Checklist</p><h2>What to buy and portion.</h2><ul className="cooking-steps">{data.completionChecklist.map((item, index) => <li key={`${item.completionItemId}-${index}`}><p>{item.ingredientName || 'Ingredient'}</p><small>{item.allocations && item.allocations.length ? item.allocations.map((allocation) => `${allocation.quantity} ${allocation.unit || ''}`).join(', ') : 'No lot allocated'}</small></li>)}</ul></section>}
      {data.assumptions && data.assumptions.length > 0 && <section className="warning-list"><p className="eyebrow">Plan notes</p><h2>Assumptions used</h2>{data.assumptions.map((assumption, index) => <div key={index}><strong>{assumption.sourceType ? sentenceCase(assumption.sourceType) : 'Assumption'}</strong><p>{assumption.text}</p></div>)}</section>}
      {data.repairOptions && data.repairOptions.length > 0 && <section className="warning-list"><p className="eyebrow">Plan notes</p><h2>Repair options</h2>{data.repairOptions.map((option, index) => <div key={`${option.optionId}-${index}`}><strong>{sentenceCase(option.optionType || 'Option')}</strong><p>{option.description}</p></div>)}</section>}
      <p className="field-note">The current backend response does not expose a recipe title or a per-serving summary beyond what is shown. FoodMind renders only the structured plan fields it actually returned.</p>
    </div>
  )
}
