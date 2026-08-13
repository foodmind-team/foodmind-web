import { describe, expect, it } from 'vitest'
import { localCalendarDate, localMonday } from './local-date'

describe('local calendar dates', () => {
  it('keeps tomorrow in the local calendar instead of formatting it in UTC', () => {
    const singaporeMidnight = new Date(2026, 7, 14, 0, 19)

    expect(localCalendarDate(singaporeMidnight)).toBe('2026-08-14')
    expect(localCalendarDate(singaporeMidnight, 1)).toBe('2026-08-15')
    expect(localCalendarDate(singaporeMidnight, -30)).toBe('2026-07-15')
  })

  it('finds Monday using the local calendar', () => {
    expect(localMonday(new Date(2026, 7, 14, 0, 19))).toBe('2026-08-10')
  })
})
