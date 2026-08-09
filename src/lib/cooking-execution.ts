// Local execution-board simulation for the READY cooking plan detail page.
//
// The real backend contract has no /cooking-plans/{planId}/execution endpoint,
// so the execution lanes (available / in progress / completed / blocked) and
// the expectedEventId optimistic concurrency (409 on stale snapshots) are
// simulated on-device from the plan timeline. Swapping in a real endpoint later
// only requires replacing these pure functions with API calls.

import type { Schema } from './api/client'

export type CookingTimelineTask = Schema<'CookingPlanTimelineTask'>

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

function taskKey(task: CookingTimelineTask, index: number): string {
  return task.taskId || `task-${index}`
}

function orderedTasks(timeline: CookingTimelineTask[]): CookingTimelineTask[] {
  return [...timeline].sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0))
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
