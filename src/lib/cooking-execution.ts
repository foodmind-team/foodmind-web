// Pure execution-board projections for the READY cooking plan detail page.
// Mutable progress and optimistic concurrency live in Backend; these helpers
// only turn the immutable plan plus the latest account state into UI lanes.

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
      taskId: `mise:${item.sequenceNo ?? index + 1}`,
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
