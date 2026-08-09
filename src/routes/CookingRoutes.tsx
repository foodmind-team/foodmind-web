import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  ChefHat,
  ListChecks,
  Settings,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { ApiError, api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import {
  applyExecutionUpdate,
  computeExecutionSnapshot,
  ExecutionConflictError,
  initExecutionStates,
  type ExecutionSnapshot,
  type LocalTaskState,
} from '../lib/cooking-execution'
import { formatDateTime, sentenceCase } from '../lib/format'

const NODE_LABELS: Record<string, string> = {
  assemble_request: 'Assembling your cooking request…',
  solve_schedule: 'Solving the cooking schedule…',
  validate_result: 'Validating the generated plan…',
  materialise: 'Saving your plan…',
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

type StrategyPurchaseItem = { ingredientName: string; quantity: number | null; unit: string | null }

function strategyPurchaseItems(data: Schema<'CookingPlanResponse'>): StrategyPurchaseItem[] {
  const purchaseDecision = data.decisions?.find((decision) => decision.optionType === 'purchase')
  const items = purchaseDecision?.payload && typeof purchaseDecision.payload === 'object' && 'items' in purchaseDecision.payload
    ? purchaseDecision.payload.items
    : undefined
  if (!Array.isArray(items)) return []
  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      ingredientName: typeof item.ingredient_name === 'string' ? item.ingredient_name : 'Ingredient',
      quantity: typeof item.quantity === 'number' ? item.quantity : null,
      unit: typeof item.unit === 'string' ? item.unit : null,
    }))
}

function strategyReduceServings(data: Schema<'CookingPlanResponse'>) {
  const decision = data.decisions?.find((entry) => entry.optionType === 'reduce_servings')
  const servings = decision?.payload && typeof decision.payload === 'object' && 'servings' in decision.payload
    ? decision.payload.servings
    : undefined
  return typeof servings === 'number' ? servings : null
}
export function CookingDetailPage() {
  const { planId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const plan = useQuery({
    queryKey: queryKeys.cooking.detail(planId),
    queryFn: async () => dataOrThrow<Schema<'CookingPlanResponse'>>(await api.GET('/cooking-plans/{planId}', { params: { path: { planId } } })),
    refetchInterval: (query) => query.state.data?.status === 'PROCESSING' ? 2000 : false,
  })
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
  const createShoppingList = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'ShoppingListResponse'>>(await api.POST('/cooking-plans/{planId}/shopping-list', { params: { path: { planId } } })),
    onSuccess: (shoppingList) => {
      queryClient.setQueryData(queryKeys.shopping.detail(shoppingList.shoppingListId), shoppingList)
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopping.list() })
      navigate(`/shopping-lists/${shoppingList.shoppingListId}`)
    },
  })
  const submitDecisions = useMutation({
    mutationFn: async () => dataOrThrow(await api.POST('/cooking-plans/{planId}/decisions-async', {
      params: { path: { planId }, header: { 'Idempotency-Key': crypto.randomUUID() } },
      body: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
    })),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.cooking.detail(result.planId), result)
      void queryClient.invalidateQueries({ queryKey: queryKeys.cooking.history() })
      navigate(`/cooking/${result.planId}`)
    },
  })
  const autoShoppingPlan = useRef<string | null>(null)
  useEffect(() => {
    const data = plan.data
    if (data?.status !== 'NEEDS_CONFIRMATION' || autoShoppingPlan.current === data.planId) return
    const hasPurchase = data.decisions?.some((decision) => decision.optionType === 'purchase')
    const hasReduction = data.decisions?.some((decision) => decision.optionType === 'reduce_servings')
    if (hasPurchase && !hasReduction) {
      autoShoppingPlan.current = data.planId
      createShoppingList.mutate()
    }
  }, [plan.data, createShoppingList])

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
        <EmptyState title={cancelled ? 'Cooking plan cancelled' : 'A plan could not be completed'} message={cancelled ? 'You cancelled this generation before it finished. Nothing was saved.' : (data.errorMessage || sentenceCase(data.errorCode || 'FAILED'))} action={<Link className="primary-action" to="/cooking">Choose recipes</Link>} />
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
        <Link className="primary-action" to="/cooking">Choose recipes</Link>
      </div>
    )
  }
  if (data.status === 'NEEDS_CONFIRMATION') {
    const questions = data.confirmationQuestions || []
    const strategyQuestion = questions.find((question) => question.fieldPath === 'repair_strategy' && question.questionId)
    // When a strategy question exists, the user chooses exactly one
    // inventory recovery path: reduce portions or buy the missing items.
    const remainingQuestions = strategyQuestion ? [] : questions
    const reduceServings = strategyReduceServings(data)
    // Only the questions actually rendered gate the submit button: when a
    // strategy question exists, gap/assumption questions are hidden and
    // don't block submission.
    const gatingQuestions = strategyQuestion ? [strategyQuestion] : questions
    const requiredMissing = gatingQuestions.some((question) => question.required && !answers[question.questionId || ''])
    const onlyPurchase = data.decisions?.some((decision) => decision.optionType === 'purchase') && reduceServings == null
    if (onlyPurchase && createShoppingList.isPending) return <div className="page"><LoadingState label="Opening your shopping list…" /></div>
    return (
      <div className="page section-page cooking-result-page">
        <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
        <header className="section-page-heading"><div><p className="eyebrow">{sentenceCase(data.status)} · {formatDateTime(data.createdAt)}</p><h1>Your plan needs a decision</h1><p>{data.explanation || 'The Cooking Agent produced a plan but needs a few answers before it can finish.'}</p></div><span className="cooking-mark"><ChefHat /></span></header>
        {strategyQuestion && <section className="detail-card"><p className="eyebrow">Inventory shortage</p><h2>{strategyQuestion.prompt}</h2><p>Reducing portions triggers a fresh inventory check. Buying opens a persisted list immediately.</p><div className="strategy-actions">{strategyQuestion.options?.map((option) => { const optionType = data.decisions?.find((decision) => decision.optionId === option.value)?.optionType; const buying = optionType === 'purchase'; return <button className={!buying && answers[strategyQuestion.questionId || ''] === option.value ? 'primary-action' : 'secondary-action'} type="button" disabled={createShoppingList.isPending || submitDecisions.isPending} key={option.value} onClick={() => { if (buying) createShoppingList.mutate(); else if (strategyQuestion.questionId) setAnswers((current) => ({ ...current, [strategyQuestion.questionId!]: option.value || '' })) }}>{buying && createShoppingList.isPending ? 'Opening shopping list…' : option.label}</button> })}</div>{reduceServings != null && <p className="field-note">Reduce servings: recheck the plan at {reduceServings} {reduceServings === 1 ? 'serving' : 'servings'}. If stock is still short, FoodMind opens a shopping list for the original servings.</p>}<small>{strategyQuestion.required ? 'Choose one option' : 'Optional'}</small></section>}
        {remainingQuestions.map((question) => <section className="detail-card" key={question.questionId || question.fieldPath || question.prompt || 'question'}><p className="eyebrow">{question.fieldPath ? sentenceCase(question.fieldPath) : 'Question'}</p><h2>{question.prompt}</h2>{question.options && question.options.map((option) => <label className="check-control" key={option.value}><input type="radio" name={`question-${question.questionId}`} value={option.value || ''} checked={answers[question.questionId || ''] === option.value} onChange={() => question.questionId && setAnswers((current) => ({ ...current, [question.questionId!]: option.value || '' }))} /><span>{option.label}{option.suggested ? ' · suggested' : ''}</span></label>)}<small>{question.required ? 'Required' : 'Optional'} answer{question.suggestedValue ? ` · suggested: ${question.suggestedValue}` : ''}</small></section>)}
        {!questions.length && <EmptyState title="Awaiting confirmation" message="This plan is waiting for decisions that are not available on this device yet." />}
        {(submitDecisions.isError || createShoppingList.isError) && <div className="form-alert" role="alert">{errorMessage(submitDecisions.error || createShoppingList.error)}</div>}
        {questions.length > 0 && !onlyPurchase && <button className="primary-action" type="button" disabled={requiredMissing || submitDecisions.isPending} onClick={() => submitDecisions.mutate()}>{submitDecisions.isPending ? 'Rechecking inventory…' : 'Reduce portions and recheck'}</button>}
      </div>
    )
  }
  return <ReadyPlanBoard data={data} />
}

function ReadyPlanBoard({ data }: { data: Schema<'CookingPlanResponse'> }) {
  const { showToast } = useToast()
  const tasks = useMemo(() => [...(data.timeline || [])].sort((a, b) => (a.startMinute || 0) - (b.startMinute || 0)), [data.timeline])
  const purchaseItems = strategyPurchaseItems(data)
  const timelineKey = tasks.map((task) => task.taskId || 'x').join('|')
  const [execStates, setExecStates] = useState<Record<string, LocalTaskState>>(() => initExecutionStates(tasks))
  const [execEventId, setExecEventId] = useState(0)
  useEffect(() => {
    setExecStates(initExecutionStates(tasks))
    setExecEventId(0)
  }, [timelineKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const snapshot = useMemo<ExecutionSnapshot>(() => computeExecutionSnapshot(tasks, execStates, execEventId), [tasks, execStates, execEventId])
  const total = tasks.length
  const done = snapshot.completed.length
  const percent = total ? Math.round(done / total * 100) : 0

  const submit = (taskId: string, status: 'IN_PROGRESS' | 'COMPLETED') => {
    try {
      const next = applyExecutionUpdate(tasks, execStates, execEventId, { cookingTaskId: taskId, status, expectedEventId: snapshot.expectedEventId })
      setExecStates(next.states)
      setExecEventId(next.eventId)
    } catch (error) {
      if (error instanceof ExecutionConflictError) {
        showToast('Execution state changed elsewhere. Refreshing the board…', 'error')
      } else {
        showToast((error as Error).message || 'That step is not available yet.', 'error')
      }
    }
  }

  return (
    <div className="page section-page cooking-result-page">
      <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
      <header className="section-page-heading"><div><p className="eyebrow">{sentenceCase(data.status)} · {formatDateTime(data.completedAt)}</p><h1>Your FoodMind cooking plan</h1><p>{data.explanation || `${tasks.length} ordered tasks across the dishes you picked.`}</p></div><span className="cooking-mark"><ChefHat /></span></header>
      {data.solverStatus && <p className="field-note">Solver {sentenceCase(data.solverStatus)}{data.makespanMinutes != null ? ` · ${data.makespanMinutes} minute makespan` : ''}{data.region ? ` · region ${data.region}` : ''}</p>}

      <section className="cooking-progress-card"><div><p className="eyebrow">Execution progress</p><h2>{done} of {total} tasks complete</h2></div><strong>{percent}%</strong><div className="cooking-progress-track" role="progressbar" aria-label="Cooking plan completion" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}><span style={{ width: `${percent}%` }} /></div>{done > 0 && <button className="text-button" type="button" onClick={() => { setExecStates(initExecutionStates(tasks)); setExecEventId(0) }}>Reset progress</button>}<small>The board is simulated on this device; it does not claim backend completion or inventory changes.</small></section>

      <div className="execution-lanes">
        {snapshot.inProgress.length > 0 && <ExecutionLane title="In progress" tone="progress" tasks={snapshot.inProgress} action={(task) => <button className="lane-action" type="button" onClick={() => submit(task.taskId || '', 'COMPLETED')}><Check size={15} /> Complete</button>} />}
        {snapshot.available.length > 0 && <ExecutionLane title="Ready to start" tone="available" tasks={snapshot.available} action={(task) => <button className="lane-action" type="button" onClick={() => submit(task.taskId || '', 'IN_PROGRESS')}><ArrowRight size={15} /> Start</button>} />}
        {snapshot.blocked.length > 0 && <ExecutionLane title="Blocked" tone="blocked" tasks={snapshot.blocked} blocked />}
        {snapshot.completed.length > 0 && <ExecutionLane title="Completed" tone="done" tasks={snapshot.completed} completed />}
      </div>

      {total > 0 && <details className="detail-card all-steps-details"><summary><p className="eyebrow">Ordered method</p><h2>All steps</h2></summary><ol className="cooking-steps">{tasks.map((taskItem, index) => { const taskId = taskItem.taskId || `task-${index}`; const state = execStates[taskId] || 'PENDING'; return <li className={state === 'COMPLETED' ? 'complete' : ''} key={`${taskItem.taskId}-${index}`}><span className={`step-badge ${state.toLowerCase()}`} aria-label={sentenceCase(state)}>{state === 'COMPLETED' ? <Check size={14} /> : index + 1}</span><p>{taskItem.instruction}</p>{taskItem.durationMinutes != null && <small>{taskItem.durationMinutes} min · starts {formatMinute(taskItem.startMinute)}{taskItem.workMode === 'PASSIVE' ? ' · passive' : ''}</small>}</li> })}</ol></details>}

      {data.miseEnPlace && data.miseEnPlace.length > 0 && <section className="detail-card"><p className="eyebrow">Mise en place</p><h2>Prep before cooking.</h2><ul className="cooking-steps">{data.miseEnPlace.map((item, index) => <li key={`${item.sequenceNo}-${index}`}><p>{item.instruction}</p><small>{[item.ingredient, item.operation, item.durationMinutes != null ? `${item.durationMinutes} min` : null, item.whenNeeded].filter(Boolean).join(' · ')}</small></li>)}</ul></section>}
      {data.completionChecklist && data.completionChecklist.length > 0 && <section className="detail-card"><p className="eyebrow">Checklist</p><h2>What to buy and portion.</h2><ul className="cooking-steps">{data.completionChecklist.map((item, index) => <li key={`${item.completionItemId}-${index}`}><p>{item.ingredientName || 'Ingredient'}</p><small>{item.allocations && item.allocations.length ? item.allocations.map((allocation) => `${allocation.quantity} ${allocation.unit || ''}`).join(', ') : 'No lot allocated'}</small></li>)}</ul></section>}
      {purchaseItems.length > 0 && <section className="detail-card"><p className="eyebrow">Shopping list</p><h2>Missing ingredients to buy.</h2><ul className="cooking-steps">{purchaseItems.map((item) => <li key={`${item.ingredientName}-${item.unit || 'unit'}`}><p>{item.ingredientName}</p><small>{item.quantity != null ? `${item.quantity} ${item.unit || ''}`.trim() : (item.unit || 'As needed')}</small></li>)}</ul></section>}
      {data.dishCompletions && data.dishCompletions.length > 0 && <section className="detail-card"><p className="eyebrow">Completion</p><h2>When each dish is ready.</h2><div className="ingredient-result-list">{data.dishCompletions.map((dish, index) => <div className="ingredient-result" key={index}><span className={dish.isShared ? 'to-buy' : 'available'}>{dish.isShared ? <Users size={15} /> : <Check size={15} />}{dish.isShared ? 'Shared' : 'Solo'}</span><strong>{dish.dishId || 'Dish'}</strong><small>{formatMinute(dish.completionMinute)}{dish.taskCount != null ? ` · ${dish.taskCount} tasks` : ''}</small></div>)}</div></section>}
      {data.assumptions && data.assumptions.length > 0 && <section className="warning-list"><p className="eyebrow">Plan notes</p><h2>Assumptions used</h2>{data.assumptions.map((assumption, index) => <div key={index}><strong>{assumption.sourceType ? sentenceCase(assumption.sourceType) : 'Assumption'}</strong><p>{assumption.text}</p></div>)}</section>}
    </div>
  )
}

function ExecutionLane({ title, tone, tasks, action, blocked, completed }: {
  title: string
  tone: string
  tasks: Array<Schema<'CookingPlanTimelineTask'> & { reason?: string }>
  action?: (task: Schema<'CookingPlanTimelineTask'>) => React.ReactNode
  blocked?: boolean
  completed?: boolean
}) {
  return (
    <section className={`execution-lane ${tone}`}>
      <div className="lane-head"><span className="lane-dot" /><h3>{title} <small>{tasks.length}</small></h3></div>
      <div className="lane-list">
        {tasks.map((task, index) => (
          <div className={`task-card${blocked ? ' block' : ''}${completed ? ' done' : ''}`} key={`${task.taskId}-${index}`}>
            <p>{task.instruction}</p>
            {task.durationMinutes != null && <small>{task.durationMinutes} min · starts {formatMinute(task.startMinute)}{task.workMode === 'PASSIVE' ? ' · passive' : ''}</small>}
            {task.reason && <small className="block-reason">{task.reason}</small>}
            {action && action(task)}
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// History page — real /cooking-plans/history endpoint (cooking-app PlansHistory).
// ---------------------------------------------------------------------------

export function CookingHistoryPage() {
  const history = useQuery({ queryKey: queryKeys.cooking.history(), queryFn: async () => dataOrThrow<Schema<'CookingPlanHistoryResponse'>>(await api.GET('/cooking-plans/history', { params: { query: { page: 0, size: 20 } } })) })
  const items = (history.data?.items || []) as Schema<'CookingPlanSummary'>[]
  return (
    <div className="page section-page">
      <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
      <header className="section-page-heading"><div><p className="eyebrow">Cooking history</p><h1>Plans you have generated.</h1><p>Every cooking plan that the backend accepted for this account, newest first.</p></div><span className="cooking-mark"><ListChecks /></span></header>
      {history.isLoading && <LoadingState label="Loading cooking history…" />}
      {history.isError && <ErrorState error={history.error} onRetry={() => void history.refetch()} />}
      {history.isSuccess && !items.length && <EmptyState title="No cooking plans yet" message="Generate your first plan from the recipe selection page." action={<Link className="primary-action" to="/cooking">Choose recipes</Link>} />}
      {items.length > 0 && <section className="history-strip"><div className="mini-card-grid">{items.map((plan) => <Link className="mini-card" to={`/cooking/${plan.planId}`} key={plan.planId}><span><ChefHat /></span><div><p className="eyebrow">{sentenceCase(plan.status || '')}</p><h3>{plan.sourceCount || 0} sources · {plan.taskCount || 0} tasks</h3><small>{formatDateTime(plan.createdAt)}</small></div><ArrowRight size={16} /></Link>)}</div></section>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings page — region / dietary / allergen preferences + scenario help
// (cooking-app SettingsPage, adapted to real reference data).
// ---------------------------------------------------------------------------

export function CookingSettingsPage() {
  const reference = useQuery({ queryKey: queryKeys.catalogue.reference(), staleTime: Infinity, queryFn: async () => dataOrThrow<Schema<'CatalogueReferenceDataResponse'>>(await api.GET('/catalogue/reference-data')) })
  const [region, setRegion] = useState('SG')
  const [dietary, setDietary] = useState<Set<string>>(new Set())
  const [allergens, setAllergens] = useState<Set<string>>(new Set())
  const REGIONS = [{ code: 'SG', name: 'Singapore' }, { code: 'US', name: 'United States' }, { code: 'CN', name: 'Mainland China' }]
  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => setter((current) => {
    const next = new Set(current)
    if (!next.delete(value)) next.add(value)
    return next
  })
  return (
    <div className="page section-page">
      <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
      <header className="section-page-heading"><div><p className="eyebrow">Cook preferences</p><h1>Plan preferences.</h1><p>Reference data comes from the backend catalogue. Preferences shape the demo scenarios you can try.</p></div><span className="cooking-mark"><Settings /></span></header>
      <section className="detail-card"><p className="eyebrow">Region</p><h2>Where are you cooking?</h2><div className="settings-chips">{REGIONS.map((item) => <button className={region === item.code ? 'active' : ''} type="button" onClick={() => setRegion(item.code)} key={item.code}>{item.name}</button>)}</div></section>
      <section className="detail-card"><p className="eyebrow">Dietary requirements</p><h2>Tags to honour when the backend can.</h2>{reference.isLoading ? <LoadingState label="Loading reference data…" /> : <div className="settings-chips">{(reference.data?.dietaryTags || []).map((item) => <button className={dietary.has(item.code) ? 'active' : ''} type="button" onClick={() => toggle(setDietary, item.code)} key={item.code}>{item.name}</button>)}</div>}</section>
      <section className="detail-card"><p className="eyebrow">Allergens to avoid</p><h2>Flags to pass along as constraints.</h2><div className="settings-chips">{(reference.data?.allergens || []).map((item) => <button className={allergens.has(item.code) ? 'active' : ''} type="button" onClick={() => toggle(setAllergens, item.code)} key={item.code}>{item.name}</button>)}</div></section>
      <section className="warning-list"><p className="eyebrow">How to trigger each outcome</p><h2>Demo scenarios</h2>
        <div><strong>Ready</strong><p>Select two quick dishes and generate a plan with no time pressure.</p></div>
        <div><strong>Needs confirmation</strong><p>Select a dish whose pantry line runs short; the backend asks how to proceed.</p></div>
        <div><strong>Infeasible</strong><p>Select the slow soup and set a time limit below its cooking span.</p></div>
        <div><strong>Failed</strong><p>Ask the backend with constraints it cannot honour; it returns a retryable failure.</p></div>
      </section>
    </div>
  )
}
