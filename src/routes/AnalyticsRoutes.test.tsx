import { describe, expect, it } from 'vitest'
import { displayMetricValue, latestMetric, type DashboardMetric } from '../lib/insight-metrics'

const metric = (overrides: Partial<DashboardMetric>): DashboardMetric => ({
  code: 'FOOD_COUNT',
  label: 'Food records',
  period: '2026-08-10',
  value: 4,
  unit: 'COUNT',
  empty: false,
  ...overrides,
})

describe('insight metric presentation', () => {
  it('selects the latest returned value without combining periods', () => {
    const latest = latestMetric([
      metric({ period: '2026-08-03', value: 11 }),
      metric({ period: '2026-08-10', value: 7 }),
    ], ['FOOD_COUNT'])

    expect(latest?.value).toBe(7)
  })

  it('keeps empty, rate, rating, and currency semantics explicit', () => {
    expect(displayMetricValue(metric({ empty: true, value: null }))).toBe('No data')
    expect(displayMetricValue(metric({ unit: 'RATE', value: 0.725 }))).toBe('72.5%')
    expect(displayMetricValue(metric({ unit: 'RATING', value: 4.25 }))).toBe('4.3')
    expect(displayMetricValue(metric({ unit: 'MONEY', value: 92.7, currency: 'SGD' }))).toBe('SGD 92.7')
  })
})
