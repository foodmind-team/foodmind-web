// Local execution-board simulation for the READY cooking plan detail page.
//
// The real backend contract has no /cooking-plans/{planId}/execution endpoint,
// so the execution lanes (available / in progress / completed / blocked) and
// the expectedEventId optimistic concurrency (409 on stale snapshots) are
// simulated on-device from the plan timeline. Swapping in a real endpoint later
// only requires replacing these pure functions with API calls.

import type { Schema } from './api/client'

export type CookingTimelineTask = Schema<'CookingPlanTimelineTask'>
export type CookingMiseEnPlaceItem = Schema<'CookingPlanMiseEnPlaceItem'>

export type LocalTaskState = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'

export type ExecutionBlockedTask = CookingTimelineTask & { reason: string }

export type ExecutionSnapshot = {
  available: CookingTimelineTask[]
  inProgress: CookingTimelineTask[]
  completed: CookingTimelineTask[]
  blocked: ExecutionBlockedTask[]
  expectedEventId: string
}

export type ExecutionUpdate = {
  cookingTaskId: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  expectedEventId: string
}

export class ExecutionConflictError extends Error {
  constructor() {
    super('EXECUTION_STATE_CONFLICT')
    this.name = 'ExecutionConflictError'
  }
}

type PersistedExecutionProgress = {
  timelineKey: string
  eventId: number
  states: Record<string, LocalTaskState>
}

function progressStorageKey(planId: string) {
  return `foodmind:cooking-progress:${planId}:v1`
}

function timelineKey(timeline: CookingTimelineTask[]) {
  return orderedTasks(timeline).map((task, index) => taskKey(task, index)).join('|')
}

export function loadExecutionProgress(
  planId: string,
  timeline: CookingTimelineTask[],
): { states: Record<string, LocalTaskState>; eventId: number } {
  const initial = { states: initExecutionStates(timeline), eventId: 0 }
  if (typeof window === 'undefined' || !planId) return initial
  try {
    const parsed = JSON.parse(window.localStorage.getItem(progressStorageKey(planId)) || 'null') as PersistedExecutionProgress | null
    if (!parsed || parsed.timelineKey !== timelineKey(timeline) || !Number.isInteger(parsed.eventId) || parsed.eventId < 0) return initial
    const expectedKeys = Object.keys(initial.states)
    const actualKeys = Object.keys(parsed.states || {})
    if (expectedKeys.length !== actualKeys.length || expectedKeys.some((key) => !actualKeys.includes(key))) return initial
    if (actualKeys.some((key) => !['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(parsed.states[key]))) return initial
    return { states: parsed.states, eventId: parsed.eventId }
  } catch {
    return initial
  }
}

export function saveExecutionProgress(
  planId: string,
  timeline: CookingTimelineTask[],
  states: Record<string, LocalTaskState>,
  eventId: number,
) {
  if (typeof window === 'undefined' || !planId) return
  window.localStorage.setItem(progressStorageKey(planId), JSON.stringify({
    timelineKey: timelineKey(timeline),
    eventId,
    states,
  } satisfies PersistedExecutionProgress))
}

export function clearExecutionProgress(planId: string) {
  if (typeof window === 'undefined' || !planId) return
  window.localStorage.removeItem(progressStorageKey(planId))
}

function taskKey(task: CookingTimelineTask, index: number): string {
  return task.taskId || `task-${index}`
}

function orderedTasks(timeline: CookingTimelineTask[]): CookingTimelineTask[] {
  return [...timeline].sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0))
}

function normaliseInstruction(value?: string | null): string {
  return (value || '')
    .replace(/^\[(?:prep|mise en place)\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()
}

function prepAlreadyScheduled(item: CookingMiseEnPlaceItem, timeline: CookingTimelineTask[]): boolean {
  const candidates = [item.instruction, item.ingredient]
    .map(normaliseInstruction)
    .filter(Boolean)
  const operation = normaliseInstruction(item.operation)
  const ingredient = normaliseInstruction(item.ingredient)

  return timeline.some((task) => {
    const scheduled = normaliseInstruction(task.instruction)
    const sameText = candidates.some((candidate) => (
      candidate === scheduled
      || (Math.min(candidate.length, scheduled.length) >= 24
        && (candidate.includes(scheduled) || scheduled.includes(candidate)))
    ))
    const sameOperation = operation.length >= 3
      && ingredient.length >= 3
      && scheduled.includes(operation)
      && scheduled.includes(ingredient)
    return sameText || sameOperation
  })
}

export function buildExecutionTimeline(
  timeline: CookingTimelineTask[],
  miseEnPlace: CookingMiseEnPlaceItem[],
): CookingTimelineTask[] {
  const missingPrep = [...miseEnPlace]
    .sort((a, b) => (a.sequenceNo ?? 0) - (b.sequenceNo ?? 0))
    .filter((item) => !prepAlreadyScheduled(item, timeline))
    .map((item, index): CookingTimelineTask => ({
      taskId: `mise-en-place-${item.sequenceNo ?? index + 1}-${index}`,
      instruction: item.instruction || [item.operation, item.ingredient].filter(Boolean).join(' ') || 'Prepare ingredients',
      startMinute: 0,
      durationMinutes: item.durationMinutes ?? undefined,
      workMode: 'ACTIVE',
      category: 'preparation',
      dishId: 'shared',
      resources: item.resources || [],
    }))

  // Stable sorting keeps synthetic preparation steps ahead of cooking tasks
  // that also start at minute zero.
  return orderedTasks([...missingPrep, ...timeline])
}

export function initExecutionStates(timeline: CookingTimelineTask[]): Record<string, LocalTaskState> {
  const states: Record<string, LocalTaskState> = {}
  orderedTasks(timeline).forEach((task, index) => {
    states[taskKey(task, index)] = 'PENDING'
  })
  return states
}

function sharesResource(a: CookingTimelineTask, b: CookingTimelineTask): boolean {
  return (a.resources ?? []).some((resource) => (b.resources ?? []).includes(resource))
}

export function computeExecutionSnapshot(
  timeline: CookingTimelineTask[],
  states: Record<string, LocalTaskState>,
  eventId: number,
): ExecutionSnapshot {
  const ordered = orderedTasks(timeline)
  const entries = ordered.map((task, index) => ({ task, key: taskKey(task, index) }))
  const completed = entries.filter((entry) => states[entry.key] === 'COMPLETED').map((entry) => entry.task)
  const inProgress = entries.filter((entry) => states[entry.key] === 'IN_PROGRESS').map((entry) => entry.task)

  const available: CookingTimelineTask[] = []
  const blocked: ExecutionBlockedTask[] = []
  let offered = false

  entries.forEach((entry, index) => {
    if (states[entry.key] !== 'PENDING') return
    const predecessors = entries.slice(0, index)
    const depsDone = predecessors.every((prev) => states[prev.key] === 'COMPLETED')
    const resourceFree = !inProgress.some((active) => sharesResource(active, entry.task))
    if (!offered && depsDone && resourceFree) {
      available.push(entry.task)
      offered = true
      return
    }
    const reasons: string[] = []
    if (!depsDone) {
      const waitingOn = predecessors.filter((prev) => states[prev.key] !== 'COMPLETED').map((prev) => prev.task.instruction || 'a previous step')
      reasons.push(`Waiting for ${waitingOn.join(', ')} to finish`)
    }
    if (!resourceFree) reasons.push('A shared resource (e.g. the stove) is occupied')
    blocked.push({ ...entry.task, reason: reasons.join(' · ') })
  })

  return { available, inProgress, completed, blocked, expectedEventId: `evt-${eventId}` }
}

export function applyExecutionUpdate(
  timeline: CookingTimelineTask[],
  states: Record<string, LocalTaskState>,
  eventId: number,
  update: ExecutionUpdate,
): { states: Record<string, LocalTaskState>; snapshot: ExecutionSnapshot; eventId: number } {
  if (update.expectedEventId !== `evt-${eventId}`) {
    throw new ExecutionConflictError()
  }
  const snapshot = computeExecutionSnapshot(timeline, states, eventId)
  const isAllowed = update.status === 'IN_PROGRESS'
    ? snapshot.available.some((task) => taskKey(task, -1) === update.cookingTaskId || task.taskId === update.cookingTaskId)
    : snapshot.inProgress.some((task) => task.taskId === update.cookingTaskId)
  if (!isAllowed) throw new Error('TASK_STATE_INVALID')

  const nextEventId = eventId + 1
  const nextStates: Record<string, LocalTaskState> = {
    ...states,
    [update.cookingTaskId]: update.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'COMPLETED',
  }
  return { states: nextStates, snapshot: computeExecutionSnapshot(timeline, nextStates, nextEventId), eventId: nextEventId }
}
