import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Bookmark,
  BookmarkCheck,
  Check,
  ChefHat,
  ListChecks,
  Settings,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { SavedSectionTabs } from '../components/saved/SavedSectionTabs'
import { useToast } from '../components/feedback/ToastProvider'
import { ApiError, api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { buildExecutionTimeline, computeExecutionSnapshot, initExecutionStates, type ExecutionSnapshot } from '../lib/cooking-execution'
import { formatDateTime, sentenceCase } from '../lib/format'

const PLAN_STAGES = [
  { label: 'Preparing recipes', nodes: ['assemble_request', 'validate_input'] },
  { label: 'Understanding recipes', nodes: ['parse_recipes', 'detect_gaps', 'infer_local', 'research_missing', 'apply_research_evidence', 'validate_recipe_ir'] },
  { label: 'Safety & inventory', nodes: ['validate_safety', 'check_feasibility', 'build_confirmation_response'] },
  { label: 'Preparation plan', nodes: ['merge_preparation', 'build_task_graph'] },
  { label: 'Cooking schedule', nodes: ['solve_schedule', 'verify_schedule', 'repair_schedule', 'agent_controller', 'run_tool'] },
  { label: 'Finalising', nodes: ['apply_confirmation', 'explain_schedule', 'render_ready_response', 'render_infeasible_response', 'render_failed_response', 'validate_result', 'materialise'] },
] as const

const STAGE_PERCENTAGES = [8, 30, 58, 74, 88, 97]

function errorStatus(error: unknown) {
  return error instanceof ApiError ? error.status : undefined
}

function progressCopy(progress: Schema<'CookingPlanTaskProgressResponse'> | undefined) {
  if (progress?.message) return progress.message
  const view = planProgressView(progress)
  return view.index < 0 ? 'Waiting for the Cooking Agent…' : `${view.label}…`
}

function planProgressView(progress: Schema<'CookingPlanTaskProgressResponse'> | undefined) {
  const node = progress?.node || ''
  const index = PLAN_STAGES.findIndex((stage) => stage.nodes.some((candidate) => candidate === node))
  return {
    index,
    label: index >= 0 ? PLAN_STAGES[index].label : 'Starting',
    percent: index >= 0 ? STAGE_PERCENTAGES[index] : 4,
  }
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`
}

function useProgressClock(active: boolean, node?: string | null) {
  const [now, setNow] = useState(() => Date.now())
  const [phaseStartedAt, setPhaseStartedAt] = useState(() => Date.now())
  useEffect(() => {
    if (active) setPhaseStartedAt(Date.now())
  }, [active, node])
  useEffect(() => {
    if (!active) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [active])
  return { now, phaseSeconds: Math.max(0, Math.floor((now - phaseStartedAt) / 1000)) }
}

function formatMinute(minute?: number) {
  if (minute === undefined || minute === null) return ''
  return `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`
}

function strategyReduceServings(data: Schema<'CookingPlanResponse'>) {
  const decision = data.decisions?.find((entry) => entry.optionType === 'reduce_servings')
  const servings = decision?.payload && typeof decision.payload === 'object' && 'servings' in decision.payload
    ? decision.payload.servings
    : undefined
  return typeof servings === 'number' ? servings : null
}

function executionStates(
  tasks: Schema<'CookingPlanTimelineTask'>[],
  execution?: Schema<'CookingPlanExecutionResponse'>,
) {
  const states = initExecutionStates(tasks)
  execution?.steps?.forEach((step) => {
    if (step.stepId in states) states[step.stepId] = step.status
  })
  return states
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
  const localProcessingStartedAt = useRef(Date.now())
  const progressClock = useProgressClock(isProcessing, task.data?.progress?.node)
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
  const submitDecisionsNow = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'CookingPlanResponse'>>(await api.POST('/cooking-plans/{planId}/decisions', {
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
    const hasOtherQuestions = data.confirmationQuestions?.some((question) => question.fieldPath !== 'repair_strategy')
    if (hasPurchase && !hasReduction && !hasOtherQuestions) {
      autoShoppingPlan.current = data.planId
      createShoppingList.mutate()
    }
  }, [plan.data, createShoppingList])

  if (plan.isLoading) return <div className="page"><LoadingState label="Opening your cooking plan…" /></div>
  if (plan.isError) return <div className="page"><ErrorState error={plan.error} onRetry={() => void plan.refetch()} /></div>
  const data = plan.data!
  if (data.status === 'PROCESSING') {
    const progress = task.data?.progress
    const progressView = planProgressView(progress)
    const parsedCreatedAt = Date.parse(data.createdAt || '')
    const createdAt = Number.isNaN(parsedCreatedAt) ? localProcessingStartedAt.current : parsedCreatedAt
    const elapsedSeconds = Math.max(0, Math.floor((progressClock.now - createdAt) / 1000))
    const isTakingLonger = progressClock.phaseSeconds >= 25
    return (
      <div className="page section-page cooking-result-page">
        <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
        <header className="section-page-heading"><div><p className="eyebrow">PROCESSING · submitted {data.createdAt ? formatDateTime(data.createdAt) : 'just now'}</p><h1>Building your cooking plan</h1><p>The Cooking Agent is working in the background. Progress updates automatically.</p></div><span className="cooking-mark"><ChefHat /></span></header>
        <section className="cooking-progress-card generation-progress" aria-busy="true" aria-live="polite">
          <div><p className="eyebrow">Agent progress</p><h2>{progressCopy(progress)}</h2><p className="generation-runtime">Elapsed {formatElapsed(elapsedSeconds)} · Step {Math.max(1, progressView.index + 1)} of {PLAN_STAGES.length}</p></div>
          <strong>{progressView.percent}%</strong>
          <div className="cooking-progress-track" role="progressbar" aria-label="Cooking plan generation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressView.percent}><span style={{ width: `${progressView.percent}%` }} /></div>
          <ol className="generation-stages">
            {PLAN_STAGES.map((stage, index) => <li className={index < progressView.index ? 'complete' : index === Math.max(0, progressView.index) ? 'current' : ''} key={stage.label}><span>{index < progressView.index ? <Check size={13} /> : index + 1}</span>{stage.label}</li>)}
          </ol>
          {isTakingLonger && <p className="generation-delay-note">Still working — AI-assisted detail checks can take a little longer. You can leave this page and return later.</p>}
          <small>{task.data ? `Live · checked ${Math.max(0, Math.floor((progressClock.now - task.dataUpdatedAt) / 1000))}s ago · Task ${task.data.taskId.slice(0, 8)}` : 'Connecting to the background task…'}</small>
        </section>
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
    const regenerationRecipeIds = (data.sources || [])
      .map((source) => source.sourceId)
      .filter((sourceId): sourceId is string => Boolean(sourceId))
    const regenerationHref = regenerationRecipeIds.length
      ? `/cooking?${new URLSearchParams({ selected: regenerationRecipeIds.join(',') })}`
      : '/cooking'
    const strategyQuestion = questions.find((question) => question.fieldPath === 'repair_strategy' && question.questionId)
    // When a strategy question exists, the user chooses exactly one
    // inventory recovery path: reduce portions or buy the missing items.
    const remainingQuestions = strategyQuestion
      ? questions.filter((question) => question.questionId !== strategyQuestion.questionId)
      : questions
    const reduceServings = strategyReduceServings(data)
    const requiredMissing = questions.some((question) => question.required && !answers[question.questionId || '']?.trim())
    const onlyPurchase = data.decisions?.some((decision) => decision.optionType === 'purchase')
      && reduceServings == null
      && remainingQuestions.length === 0
    if (onlyPurchase && createShoppingList.isPending) return <div className="page"><LoadingState label="Opening your shopping list…" /></div>
    return (
      <div className="page section-page cooking-result-page">
        <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
        <header className="section-page-heading"><div><p className="eyebrow">{sentenceCase(data.status)} · {formatDateTime(data.createdAt)}</p><h1>Your plan needs a decision</h1><p>{data.explanation || 'The Cooking Agent produced a plan but needs a few answers before it can finish.'}</p></div><span className="cooking-mark"><ChefHat /></span></header>
        {strategyQuestion && <section className="detail-card"><p className="eyebrow">Inventory shortage</p><h2>{strategyQuestion.prompt}</h2><p>Reducing portions triggers a fresh inventory check. Buying opens a persisted list immediately.</p><div className="strategy-actions">{strategyQuestion.options?.map((option) => { const optionType = data.decisions?.find((decision) => decision.optionId === option.value)?.optionType; const buying = optionType === 'purchase'; return <button className={!buying && answers[strategyQuestion.questionId || ''] === option.value ? 'primary-action' : 'secondary-action'} type="button" disabled={createShoppingList.isPending || submitDecisions.isPending || submitDecisionsNow.isPending} key={option.value} onClick={() => { if (buying) createShoppingList.mutate(); else if (strategyQuestion.questionId) setAnswers((current) => ({ ...current, [strategyQuestion.questionId!]: option.value || '' })) }}>{buying && createShoppingList.isPending ? 'Opening shopping list…' : option.label}</button> })}</div>{reduceServings != null && <p className="field-note">Recheck at {reduceServings} {reduceServings === 1 ? 'serving' : 'servings'}. If ingredients are still missing, the shopping list keeps this reduced serving count.</p>}<small>{strategyQuestion.required ? 'Choose one option' : 'Optional'}</small></section>}
        {remainingQuestions.map((question) => <section className="detail-card" key={question.questionId || question.fieldPath || question.prompt || 'question'}><p className="eyebrow">{question.fieldPath ? sentenceCase(question.fieldPath) : 'Question'}</p><h2>{question.prompt}</h2>{question.responseType === 'TEXT' ? <input aria-label={question.prompt} type="text" value={answers[question.questionId || ''] || ''} placeholder={question.suggestedValue ? `Suggested: ${question.suggestedValue}` : 'Enter your answer'} onChange={(event) => question.questionId && setAnswers((current) => ({ ...current, [question.questionId!]: event.target.value }))} /> : question.options?.map((option) => <label className="check-control" key={option.value}><input type="radio" name={`question-${question.questionId}`} value={option.value || ''} checked={answers[question.questionId || ''] === option.value} onChange={() => question.questionId && setAnswers((current) => ({ ...current, [question.questionId!]: option.value || '' }))} /><span>{option.label}{option.suggested ? ' · suggested' : ''}</span></label>)}<small>{question.required ? 'Required' : 'Optional'} answer{question.suggestedValue ? ` · suggested: ${question.suggestedValue}` : ''}</small></section>)}
        {!questions.length && <EmptyState title="This plan needs to be regenerated" message="FoodMind could not load the decisions required to finish this plan. Retry once, or regenerate it with the same recipes." action={<div className="generate-actions"><button className="secondary-action" type="button" disabled={plan.isFetching} onClick={() => void plan.refetch()}>{plan.isFetching ? 'Loading questions…' : 'Try loading questions again'}</button><Link className="primary-action" to={regenerationHref}>Regenerate this plan</Link></div>} />}
        {(submitDecisions.isError || submitDecisionsNow.isError || createShoppingList.isError) && <div className="form-alert" role="alert">{errorMessage(submitDecisions.error || submitDecisionsNow.error || createShoppingList.error)}</div>}
        {questions.length > 0 && !onlyPurchase && <div className="generate-actions"><button className="primary-action" type="button" disabled={requiredMissing || submitDecisions.isPending || submitDecisionsNow.isPending} onClick={() => submitDecisions.mutate()}>{submitDecisions.isPending ? 'Rechecking inventory…' : reduceServings != null ? 'Reduce portions and recheck' : 'Recheck in background'}</button><button className="secondary-action" type="button" disabled={requiredMissing || submitDecisions.isPending || submitDecisionsNow.isPending} onClick={() => submitDecisionsNow.mutate()}>{submitDecisionsNow.isPending ? 'Rechecking now…' : reduceServings != null ? 'Reduce portions now' : 'Recheck now'}</button></div>}
      </div>
    )
  }
  if (data.status === 'READY' && data.finishedAt) return <FinishedPlanResult data={data} />
  return <ReadyPlanBoard data={data} />
}

function FinishedPlanResult({ data }: { data: Schema<'CookingPlanResponse'> }) {
  const execution = useQuery({
    queryKey: queryKeys.cooking.execution(data.planId),
    queryFn: async () => dataOrThrow<Schema<'CookingPlanExecutionResponse'>>(await api.GET('/cooking-plans/{planId}/execution', { params: { path: { planId: data.planId } } })),
  })
  const recipeIds = (data.sources || []).map((source) => source.sourceId).filter((id): id is string => Boolean(id))
  const cookAgainHref = recipeIds.length ? `/cooking?${new URLSearchParams({ selected: recipeIds.join(',') })}` : '/cooking'
  return (
    <div className="page section-page cooking-result-page">
      <header className="section-page-heading"><div><p className="eyebrow">Plan finished · {formatDateTime(data.finishedAt)}</p><h1>Cooking complete</h1><p>Your allocated ingredients have been deducted from inventory.</p></div><span className="cooking-mark"><Check /></span></header>
      <section className="detail-card cooking-finished-card">
        <p className="eyebrow">Completed result</p>
        <h2>{data.sources?.length || 0} {data.sources?.length === 1 ? 'dish' : 'dishes'} · {data.timeline?.length || 0} cooking steps</h2>
        <p>{data.makespanMinutes != null ? `${data.makespanMinutes} minute planned cook` : 'Cooking plan completed'}{data.reusedFromPlanId ? ' · reused from your previous equivalent plan' : ''}.</p>
        {execution.data && <SavedPlanControls planId={data.planId} execution={execution.data} finished />}
        <div className="generate-actions"><Link className="primary-action" to={cookAgainHref}><ChefHat size={16} /> Cook again</Link><Link className="secondary-action" to="/"><ArrowLeft size={16} /> Back to Home</Link></div>
      </section>
    </div>
  )
}

function ReadyPlanBoard({ data }: { data: Schema<'CookingPlanResponse'> }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const tasks = useMemo(
    () => buildExecutionTimeline(data.timeline || [], data.miseEnPlace || []),
    [data.timeline, data.miseEnPlace],
  )
  const timelineKey = tasks.map((task) => task.taskId || 'x').join('|')
  const execution = useQuery({
    queryKey: queryKeys.cooking.execution(data.planId),
    queryFn: async () => dataOrThrow<Schema<'CookingPlanExecutionResponse'>>(await api.GET('/cooking-plans/{planId}/execution', { params: { path: { planId: data.planId } } })),
    refetchOnWindowFocus: true,
  })
  const execStates = useMemo(() => executionStates(tasks, execution.data), [timelineKey, execution.data]) // eslint-disable-line react-hooks/exhaustive-deps
  const execVersion = execution.data?.version ?? 0
  const snapshot = useMemo<ExecutionSnapshot>(() => computeExecutionSnapshot(tasks, execStates, execVersion), [tasks, execStates, execVersion])
  const total = tasks.length
  const done = snapshot.completed.length
  const percent = total ? Math.round(done / total * 100) : 0
  const allStepsComplete = total > 0 && done === total
  const gatherTask = tasks.find((task) => /gather|collect|set out.+ingredients/i.test(task.instruction || '')) || tasks[0]
  const ingredientsToGather = (data.completionChecklist || []).map((item, index) => ({
    key: item.completionItemId || `${item.ingredientName}-${index}`,
    name: item.ingredientName || 'Ingredient',
    quantity: item.allocations?.length
      ? item.allocations.map((allocation) => `${allocation.quantity} ${allocation.unit || ''}`.trim()).join(', ')
      : 'As needed',
  }))
  const taskSupplement = (task: Schema<'CookingPlanTimelineTask'>) => (
    (task === gatherTask || (gatherTask?.taskId != null && task.taskId === gatherTask.taskId)) && ingredientsToGather.length > 0
      ? <IngredientPullList items={ingredientsToGather} />
      : null
  )

  const updateStep = useMutation({
    mutationFn: async ({ stepId, status }: { stepId: string; status: 'IN_PROGRESS' | 'COMPLETED' }) => dataOrThrow<Schema<'CookingPlanExecutionResponse'>>(await api.PATCH('/cooking-plans/{planId}/execution', {
      params: { path: { planId: data.planId } },
      body: { stepId, status, expectedVersion: execVersion },
    })),
    onSuccess: (updated) => queryClient.setQueryData(queryKeys.cooking.execution(data.planId), updated),
    onError: () => { showToast('Progress changed on another device. The latest account state has been loaded.', 'error'); void execution.refetch() },
  })
  const reset = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'CookingPlanExecutionResponse'>>(await api.POST('/cooking-plans/{planId}/execution/reset', { params: { path: { planId: data.planId }, query: { expectedVersion: execVersion } } })),
    onSuccess: (updated) => queryClient.setQueryData(queryKeys.cooking.execution(data.planId), updated),
    onError: () => { showToast('Progress changed on another device. Refresh and try again.', 'error'); void execution.refetch() },
  })

  const finish = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'CookingPlanResponse'>>(await api.POST('/cooking-plans/{planId}/finish', { params: { path: { planId: data.planId } } })),
    onSuccess: (finished) => {
      queryClient.setQueryData(queryKeys.cooking.detail(data.planId), finished)
      void queryClient.invalidateQueries({ queryKey: queryKeys.cooking.history() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.cooking.saved() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.list() })
    },
  })

  return (
    <div className="page section-page cooking-result-page">
      <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
      <header className="section-page-heading"><div><p className="eyebrow">{sentenceCase(data.status)} · {formatDateTime(data.completedAt)}</p><h1>Your FoodMind cooking plan</h1><p>{data.explanation || `${tasks.length} ordered tasks across the dishes you picked.`}</p></div><span className="cooking-mark"><ChefHat /></span></header>
      {data.solverStatus && <p className="field-note">Solver {sentenceCase(data.solverStatus)}{data.makespanMinutes != null ? ` · ${data.makespanMinutes} minute makespan` : ''}{data.region ? ` · region ${data.region}` : ''}</p>}
      {data.reusedFromPlanId && <p className="field-note">Reused from your previous equivalent plan.</p>}
      {execution.data && <SavedPlanControls planId={data.planId} execution={execution.data} />}

      <section className="cooking-progress-card"><div><p className="eyebrow">Execution progress</p><h2>{done} of {total} tasks complete</h2></div><strong>{percent}%</strong><div className="cooking-progress-track" role="progressbar" aria-label="Cooking plan completion" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}><span style={{ width: `${percent}%` }} /></div>{done > 0 && !allStepsComplete && <button className="text-button" type="button" disabled={reset.isPending} onClick={() => reset.mutate()}>{reset.isPending ? 'Resetting…' : 'Reset progress'}</button>}<small>Progress is saved to your FoodMind account and shared with Android. Inventory is deducted when you finish the plan.</small><button className="primary-action finish-plan-action" type="button" disabled={!execution.isSuccess || !allStepsComplete || finish.isPending} onClick={() => finish.mutate()}><Check size={16} /> {finish.isPending ? 'Finishing plan…' : 'Finish plan'}</button></section>

      {(execution.isError || finish.isError || updateStep.isError || reset.isError) && <div className="form-alert" role="alert">{errorMessage(execution.error || finish.error || updateStep.error || reset.error)}</div>}

      <div className="execution-lanes">
        {snapshot.inProgress.length > 0 && <ExecutionLane title="In progress" tone="progress" tasks={snapshot.inProgress} supplement={taskSupplement} action={(task) => <button className="lane-action" type="button" disabled={!execution.isSuccess || updateStep.isPending} onClick={() => updateStep.mutate({ stepId: task.taskId || '', status: 'COMPLETED' })}><Check size={15} /> Complete</button>} />}
        {snapshot.available.length > 0 && <ExecutionLane title="Ready to start" tone="available" tasks={snapshot.available} supplement={taskSupplement} action={(task) => <button className="lane-action" type="button" disabled={!execution.isSuccess || updateStep.isPending} onClick={() => updateStep.mutate({ stepId: task.taskId || '', status: 'IN_PROGRESS' })}><ArrowRight size={15} /> Start</button>} />}
        {snapshot.blocked.length > 0 && <ExecutionLane title="Blocked" tone="blocked" tasks={snapshot.blocked} blocked collapsible />}
        {snapshot.completed.length > 0 && <ExecutionLane title="Completed" tone="done" tasks={snapshot.completed} completed />}
      </div>
    </div>
  )
}

function SavedPlanControls({ planId, execution, finished = false }: {
  planId: string
  execution: Schema<'CookingPlanExecutionResponse'>
  finished?: boolean
}) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const updateCache = (updated: Schema<'CookingPlanExecutionResponse'>) => {
    queryClient.setQueryData(queryKeys.cooking.execution(planId), updated)
    void queryClient.invalidateQueries({ queryKey: queryKeys.cooking.saved() })
  }
  const save = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'CookingPlanExecutionResponse'>>(await api.PUT('/cooking-plans/{planId}/saved', { params: { path: { planId } } })),
    onSuccess: (updated) => { updateCache(updated); showToast('Cooking plan saved to your account.') },
  })
  const remove = useMutation({
    mutationFn: async (resetProgress: boolean) => dataOrThrow<Schema<'CookingPlanExecutionResponse'>>(await api.DELETE('/cooking-plans/{planId}/saved', { params: { path: { planId }, query: { resetProgress } } })),
    onSuccess: (updated) => { updateCache(updated); showToast('Cooking plan removed from Saved.') },
  })
  if (!execution.savedAt) return <button className="secondary-action" type="button" disabled={save.isPending} onClick={() => save.mutate()}><Bookmark size={16} /> {save.isPending ? 'Saving…' : 'Save plan'}</button>
  return <div className="generate-actions"><span className="field-note"><BookmarkCheck size={15} /> Saved to your account</span><button className="text-button" type="button" disabled={remove.isPending} onClick={() => remove.mutate(false)}>Remove from Saved</button>{!finished && <button className="text-button" type="button" disabled={remove.isPending} onClick={() => remove.mutate(true)}>Remove &amp; reset progress</button>}</div>
}

function IngredientPullList({ items }: { items: Array<{ key: string; name: string; quantity: string }> }) {
  return <div className="task-ingredients"><strong>Gather these ingredients</strong><ul>{items.map((item) => <li key={item.key}><span>{item.name}</span><small>{item.quantity}</small></li>)}</ul></div>
}

function ExecutionLane({ title, tone, tasks, action, supplement, blocked, completed, collapsible }: {
  title: string
  tone: string
  tasks: Array<Schema<'CookingPlanTimelineTask'> & { reason?: string }>
  action?: (task: Schema<'CookingPlanTimelineTask'>) => React.ReactNode
  supplement?: (task: Schema<'CookingPlanTimelineTask'>) => React.ReactNode
  blocked?: boolean
  completed?: boolean
  collapsible?: boolean
}) {
  const head = <div className="lane-head"><span className="lane-dot" /><h3>{title} <small>{tasks.length}</small></h3>{collapsible && <ArrowRight className="lane-toggle" size={16} />}</div>
  const list = <div className="lane-list">{tasks.map((task, index) => <div className={`task-card${blocked ? ' block' : ''}${completed ? ' done' : ''}`} key={`${task.taskId}-${index}`}><p>{task.instruction}</p>{task.durationMinutes != null && <small>{task.durationMinutes} min · starts {formatMinute(task.startMinute)}{task.workMode === 'PASSIVE' ? ' · passive' : ''}</small>}{task.reason && <small className="block-reason">{task.reason}</small>}{supplement && supplement(task)}{action && action(task)}</div>)}</div>
  if (collapsible) return <details className={`execution-lane ${tone} collapsible-lane`}><summary>{head}</summary>{list}</details>
  return <section className={`execution-lane ${tone}`}>{head}{list}</section>
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

export function SavedCookingPlansPage() {
  const saved = useQuery({
    queryKey: queryKeys.cooking.saved(),
    queryFn: async () => dataOrThrow<Schema<'CookingPlanHistoryResponse'>>(await api.GET('/cooking-plans/saved', { params: { query: { page: 0, size: 50 } } })),
  })
  const items = (saved.data?.items || []) as Schema<'CookingPlanSummary'>[]
  return (
    <div className="page section-page">
      <header className="section-page-heading"><div><p className="eyebrow">Saved · Cooking Plans</p><h1>Continue where you left off.</h1><p>Plans, completion state, and step progress are stored in your FoodMind account and shared with Android.</p></div><Link className="primary-action" to="/cooking"><ChefHat size={17} /> Start cooking</Link></header>
      <SavedSectionTabs />
      {saved.isLoading && <LoadingState label="Opening saved cooking plans…" />}
      {saved.isError && <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />}
      {saved.isSuccess && !items.length && <EmptyState title="No saved cooking plans" message="Open a generated plan and select Save plan to keep it here." action={<Link className="primary-action" to="/cooking/history">Open plan history</Link>} />}
      {items.length > 0 && <section className="saved-grid">{items.map((plan) => {
        const label = plan.finishedAt ? 'Completed' : 'In progress'
        const title = plan.dishNames?.filter(Boolean).join(' · ') || `${plan.sourceCount || 0} dish cooking plan`
        return <article className="saved-card" key={plan.planId}><div className="saved-visual"><ChefHat /></div><div><p className="eyebrow">{label} · saved {formatDateTime(plan.savedAt)}</p><h2>{title}</h2><p>{plan.finishedAt ? `Completed ${formatDateTime(plan.finishedAt)}` : `${plan.completedStepCount || 0} of ${plan.taskCount || 0} scheduled steps completed`}{plan.makespanMinutes ? ` · ${plan.makespanMinutes} min` : ''}</p><Link className="text-button" to={`/cooking/${plan.planId}`}>{plan.finishedAt ? 'View plan' : 'Continue cooking'} <ArrowRight size={15} /></Link></div></article>
      })}</section>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cooking-specific preferences. Account dietary and allergen rules remain the
// single source of truth for every recommendation and cooking plan.
// ---------------------------------------------------------------------------

export function CookingSettingsPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const preferences = useQuery({
    queryKey: queryKeys.users.preferences(),
    queryFn: async () => dataOrThrow<Schema<'UserPreferencesResponse'>>(await api.GET('/users/me/preferences')),
  })
  const [region, setRegion] = useState('SG')
  useEffect(() => {
    if (preferences.data?.cookingRegion) setRegion(preferences.data.cookingRegion)
  }, [preferences.data?.cookingRegion])
  const REGIONS = [{ code: 'SG', name: 'Singapore' }, { code: 'US', name: 'United States' }, { code: 'CN', name: 'Mainland China' }]
  const update = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'UserPreferencesResponse'>>(await api.PUT('/users/me/preferences/cooking-region', { body: { cookingRegion: region as 'SG' | 'US' | 'CN' } })),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.users.preferences(), updated)
      showToast('Cooking region synced across your account.')
    },
  })
  if (preferences.isLoading) return <div className="page"><LoadingState label="Loading cooking preferences…" /></div>
  if (preferences.isError) return <div className="page"><ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} /></div>
  return (
    <div className="page section-page">
      <Link className="back-link" to="/cooking"><ArrowLeft size={16} /> Cooking</Link>
      <header className="section-page-heading"><div><p className="eyebrow">Kitchen setup</p><h1>Cooking preferences</h1><p>Your region is saved to your FoodMind account and shared with Android.</p></div><span className="cooking-mark"><Settings /></span></header>
      <section className="detail-card"><p className="eyebrow">Region</p><h2>Choose the guidance region.</h2><div className="settings-chips">{REGIONS.map((item) => <button className={region === item.code ? 'active' : ''} aria-pressed={region === item.code} type="button" onClick={() => setRegion(item.code)} key={item.code}>{item.name}</button>)}</div></section>
      <section className="local-draft-note"><Check size={17} /><span><strong>One source for dietary safety.</strong> Update dietary requirements and allergens in <Link to="/me/preferences">account preferences</Link>.</span></section>
      {update.isError && <div className="form-alert" role="alert">{errorMessage(update.error)}</div>}
      <div className="generate-actions"><button className="primary-action" type="button" disabled={update.isPending} onClick={() => update.mutate()}><Check size={16} /> {update.isPending ? 'Saving…' : 'Save preferences'}</button></div>
    </div>
  )
}
