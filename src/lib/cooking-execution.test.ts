import { describe, expect, it } from 'vitest'
import {
  buildExecutionTimeline,
  computeExecutionSnapshot,
  initExecutionStates,
  type CookingTimelineTask,
} from './cooking-execution'

const timeline: CookingTimelineTask[] = [
  { taskId: 'task-1', instruction: 'Prep', startMinute: 0 },
  { taskId: 'task-2', instruction: 'Cook', startMinute: 2 },
]

describe('cooking execution projection', () => {
  it('offers the first pending step from an empty backend state', () => {
    const states = initExecutionStates(timeline)
    const snapshot = computeExecutionSnapshot(timeline, states, 0)

    expect(snapshot.available.map((task) => task.taskId)).toEqual(['task-1'])
    expect(snapshot.blocked.map((task) => task.taskId)).toEqual(['task-2'])
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
