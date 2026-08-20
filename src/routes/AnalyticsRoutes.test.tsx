import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { aggregateDimensionMetrics, displayMetricValue, latestMetric, type DashboardMetric } from '../lib/insight-metrics'
import { server } from '../test/server'
import { DashboardPage } from './AnalyticsRoutes'

vi.mock('recharts', () => ({
  Bar: () => null,
  BarChart: ({ children }: { children?: ReactNode }) => <>{children}</>,
  CartesianGrid: () => null,
  Cell: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Pie: ({ children }: { children?: ReactNode }) => <>{children}</>,
  PieChart: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

const origin = 'http://localhost:3000'

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><DashboardPage /></MemoryRouter></QueryClientProvider>)
}

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
  it('lets Backend resolve the account time zone instead of sending the device time zone', async () => {
    let requestedTimeZone: string | null | undefined
    server.use(http.get(`${origin}/api/v1/dashboard`, ({ request }) => {
      requestedTimeZone = new URL(request.url).searchParams.get('timeZone')
      return HttpResponse.json({
        from: '2026-05-22T16:00:00Z',
        to: '2026-08-21T16:00:00Z',
        groupBy: 'WEEK',
        timeZone: 'Asia/Shanghai',
        empty: true,
        metrics: [],
        spendingTotals: [],
      })
    }))

    renderDashboard()

    expect(await screen.findByRole('heading', { name: 'No data for this range' })).toBeInTheDocument()
    expect(requestedTimeZone).toBeNull()
  })

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

  it('combines the same cuisine dimension across periods into one chart segment', () => {
    const mix = aggregateDimensionMetrics([
      metric({ code: 'CUISINE_DISTRIBUTION', period: '2026-08-03', dimension: 'CHINESE', dimensionLabel: 'Chinese', value: 2 }),
      metric({ code: 'CUISINE_DISTRIBUTION', period: '2026-08-10', dimension: 'CHINESE', dimensionLabel: 'Chinese', value: 3 }),
      metric({ code: 'CUISINE_DISTRIBUTION', period: '2026-08-10', dimension: 'INDIAN', dimensionLabel: 'Indian', value: 1 }),
      metric({ code: 'CUISINE_DISTRIBUTION', period: '2026-08-17', dimension: 'CHINESE', dimensionLabel: 'Chinese', empty: true, value: null }),
    ])

    expect(mix).toEqual([
      { dimension: 'CHINESE', name: 'Chinese', value: 5 },
      { dimension: 'INDIAN', name: 'Indian', value: 1 },
    ])
  })
})
