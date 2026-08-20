import type { Schema } from './api/client'

export type DashboardMetric = Schema<'DashboardMetricResponse'>

export type DimensionTotal = {
  dimension: string
  name: string
  value: number
}

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

export function aggregateDimensionMetrics(metrics: DashboardMetric[]): DimensionTotal[] {
  const totals = new Map<string, DimensionTotal>()
  for (const metric of metrics) {
    if (metric.empty || metric.value === null || metric.value === undefined) continue
    const dimension = metric.dimension || metric.dimensionLabel || metric.label
    const name = metric.dimensionLabel || metric.dimension || metric.label
    const existing = totals.get(dimension)
    totals.set(dimension, {
      dimension,
      name,
      value: (existing?.value || 0) + metric.value,
    })
  }
  return [...totals.values()].sort((left, right) => left.dimension.localeCompare(right.dimension))
}
