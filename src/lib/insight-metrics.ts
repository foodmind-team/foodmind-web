import type { Schema } from './api/client'

export type DashboardMetric = Schema<'DashboardMetricResponse'>

export function displayMetricValue(metric?: DashboardMetric) {
  if (!metric || metric.empty || metric.value === null || metric.value === undefined) return 'No data'
  if (metric.unit === 'MONEY') return `${metric.currency || metric.dimension || ''} ${metric.value.toLocaleString()}`.trim()
  if (metric.unit === 'RATE') return `${(metric.value * 100).toFixed(1)}%`
  if (metric.unit === 'RATING') return metric.value.toFixed(1)
  return metric.value.toLocaleString()
}

export function latestMetric(metrics: DashboardMetric[], codes: string[]) {
  return metrics
    .filter((metric) => codes.includes(metric.code) && !metric.empty && metric.value !== null && metric.value !== undefined)
    .sort((left, right) => right.period.localeCompare(left.period))[0]
}
