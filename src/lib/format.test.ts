import { describe, expect, it } from 'vitest'
import { formatDateTime, formatMoney, sentenceCase, toLocalDateTimeValue } from './format'

describe('format helpers', () => {
  it('formats money without combining or changing the supplied currency', () => {
    expect(formatMoney(12.5, 'SGD')).toContain('12.50')
    expect(formatMoney(null, 'SGD')).toBe('Price not provided')
  })

  it('keeps missing values explicit', () => {
    expect(formatDateTime(null)).toBe('Not provided')
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
    expect(sentenceCase('GROUP_INSPIRED')).toBe('Group inspired')
    expect(sentenceCase(null)).toBe('Not provided')
  })

  it('creates a local datetime input value', () => {
    expect(toLocalDateTimeValue('2026-07-31T12:00:00Z')).toMatch(/^2026-07-31T/)
    expect(toLocalDateTimeValue()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('falls back safely for an unsupported currency code', () => {
    expect(formatMoney(12.5, 'NOT-A-CURRENCY')).toBe('NOT-A-CURRENCY 12.50')
    expect(formatMoney(undefined)).toBe('Price not provided')
  })
})
