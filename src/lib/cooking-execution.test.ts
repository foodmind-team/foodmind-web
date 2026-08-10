import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildExecutionTimeline,
  clearExecutionProgress,
  initExecutionStates,
  loadExecutionProgress,
  saveExecutionProgress,
  type CookingTimelineTask,
} from './cooking-execution'

const timeline: CookingTimelineTask[] = [
  { taskId: 'task-1', instruction: 'Prep', startMinute: 0 },
  { taskId: 'task-2', instruction: 'Cook', startMinute: 2 },
]

describe('cooking execution persistence', () => {
  beforeEach(() => localStorage.clear())

  it('restores progress for the same plan and timeline', () => {
    const states = { ...initExecutionStates(timeline), 'task-1': 'COMPLETED' as const }
    saveExecutionProgress('plan-1', timeline, states, 2)

    expect(loadExecutionProgress('plan-1', timeline)).toEqual({ states, eventId: 2 })
  })

  it('rejects stale timeline state and supports explicit reset', () => {
    saveExecutionProgress('plan-1', timeline, { 'task-1': 'COMPLETED', 'task-2': 'PENDING' }, 1)
    expect(loadExecutionProgress('plan-1', [{ taskId: 'new-task' }]).eventId).toBe(0)

    clearExecutionProgress('plan-1')
    expect(loadExecutionProgress('plan-1', timeline)).toEqual({ states: initExecutionStates(timeline), eventId: 0 })
  })
})

describe('unified cooking steps', () => {
  it('adds missing preparation before cooking tasks', () => {
    const unified = buildExecutionTimeline(timeline, [
      { sequenceNo: 1, instruction: 'Wash the greens', durationMinutes: 3 },
    ])

    expect(unified.map((task) => task.instruction)).toEqual(['Wash the greens', 'Prep', 'Cook'])
    expect(unified[0]).toMatchObject({ category: 'preparation', dishId: 'shared' })
  })

  it('does not duplicate preparation already present in the timeline', () => {
    const scheduled = [{ taskId: 'prep-1', instruction: '[Prep] wash 1 of cucumber', startMinute: 0 }]
    const unified = buildExecutionTimeline(scheduled, [
      { sequenceNo: 1, instruction: 'wash: cucumber', ingredient: 'cucumber', operation: 'wash' },
    ])

    expect(unified).toEqual(scheduled)
  })
})
