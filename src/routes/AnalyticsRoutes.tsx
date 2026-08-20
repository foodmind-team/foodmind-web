import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowLeft, BarChart3, CalendarDays, CircleDollarSign, Database, Star, Target, Utensils } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { api, dataOrThrow, type Schema } from '../lib/api/client'
import { aggregateDimensionMetrics, displayMetricValue, latestMetric, type DashboardMetric } from '../lib/insight-metrics'
import { queryKeys } from '../lib/api/query-keys'
import { localCalendarDate, localMonday } from '../lib/local-date'

type ChartRow = Record<string, string | number>
type InsightIcon = ComponentType<{ size?: number; strokeWidth?: number }>

const chartColors = ['#d9ef74', '#79b78e', '#f07b61', '#d4a72c', '#6ca4a1', '#b78bce']
const activityCodes = ['FOOD_COUNT', 'DRINK_COUNT', 'FOOD_DRINK_COUNT']
const outcomeCodes = ['ACCEPTANCE_RATE', 'REJECTION_RATE', 'WOULD_AGAIN_RATE', 'RECOMMENDATION_WOULD_EAT_AGAIN_RATE', 'REJECTION_REASON', 'SELECTED_CANDIDATE_TYPE']

function date(offsetDays = 0) {
  return localCalendarDate(new Date(), offsetDays)
}

function mondayOfCurrentWeek() {
  return localMonday(new Date())
}

function pivotByPeriod(metrics: DashboardMetric[], seriesName: (metric: DashboardMetric) => string) {
  const rows = new Map<string, ChartRow>()
  for (const metric of metrics) {
    if (metric.value === null || metric.value === undefined || metric.empty) continue
    const row = rows.get(metric.period) || { period: metric.period }
    row[seriesName(metric)] = metric.value
    rows.set(metric.period, row)
  }
  return [...rows.values()].sort((left, right) => String(left.period).localeCompare(String(right.period)))
}

function InsightRelationship({ metrics, spending }: { metrics: DashboardMetric[]; spending: DashboardMetric[] }) {
  const nodes: { title: string; metric?: DashboardMetric; detail: string; icon: InsightIcon; tone: string }[] = [
    { title: 'Activity', metric: latestMetric(metrics, ['FOOD_DRINK_COUNT', 'FOOD_COUNT', 'DRINK_COUNT']), detail: 'What you recorded', icon: Activity, tone: 'sage' },
    { title: 'Spending', metric: latestMetric(spending, ['SPENDING_TOTAL']), detail: 'What it cost', icon: CircleDollarSign, tone: 'gold' },
    { title: 'Cuisine mix', metric: latestMetric(metrics, ['CUISINE_DISTRIBUTION']), detail: 'What you explored', icon: Utensils, tone: 'lime' },
    { title: 'Rating', metric: latestMetric(metrics, ['MEAN_RATING']), detail: 'How it felt', icon: Star, tone: 'sage' },
    { title: 'Outcomes', metric: latestMetric(metrics, ['ACCEPTANCE_RATE', 'WOULD_AGAIN_RATE', 'RECOMMENDATION_WOULD_EAT_AGAIN_RATE']), detail: 'What worked', icon: Target, tone: 'coral' },
  ]

  return (
    <section className="insight-story" aria-labelledby="food-story-title">
      <div className="insight-story-heading">
        <div><p className="eyebrow">Relationship overview</p><h2 id="food-story-title">Your food story</h2></div>
        <p>Read left to right to compare the signals FoodMind received. Connections organize the data; they do not claim causation.</p>
      </div>
      <ol className="insight-path">
        {nodes.map(({ title, metric, detail, icon: Icon, tone }) => (
          <li className={`insight-node ${tone}`} key={title}>
            <span className="insight-node-icon"><Icon size={22} strokeWidth={1.8} /></span>
            <div><small>{title}</small><strong>{displayMetricValue(metric)}</strong><span>{metric?.dimensionLabel || metric?.label || detail}</span></div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function RecommendationOutcomes({ metrics }: { metrics: DashboardMetric[] }) {
  const rates = metrics.filter((metric) => metric.unit === 'RATE')
  const counts = metrics.filter((metric) => metric.unit === 'COUNT')
  return (
    <div className="outcome-diagram">
      {rates.length > 0 && <div className="outcome-rate-list">{rates.map((metric, index) => (
        <div className="outcome-rate" key={`${metric.code}-${metric.period}-${metric.dimension}-${index}`}>
          <span><strong>{metric.dimensionLabel || metric.label}</strong><small>{displayMetricValue(metric)}</small></span>
          <div><i style={{ width: `${Math.max(0, Math.min(100, (metric.value || 0) * 100))}%` }} /></div>
        </div>
      ))}</div>}
      {counts.length > 0 && <ResponsiveContainer width="100%" height={Math.max(190, counts.length * 42)}><BarChart data={counts.map((metric) => ({ label: metric.dimensionLabel || metric.dimension || metric.label, value: metric.value }))} layout="vertical" margin={{ left: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="label" width={105} /><Tooltip /><Bar dataKey="value" fill="#f07b61" isAnimationActive={false} radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer>}
      {!rates.length && !counts.length && <p className="chart-empty">No recommendation outcome data</p>}
    </div>
  )
}

function metricKey(metric: DashboardMetric) {
  return `${metric.code}-${metric.period}-${metric.dimension || ''}-${metric.currency || ''}`
}

function RawDataDisclosure({ metrics, spending }: { metrics: DashboardMetric[]; spending: DashboardMetric[] }) {
  const keys = new Set(metrics.map(metricKey))
  const rows = [...metrics, ...spending.filter((metric) => !keys.has(metricKey(metric)))]
  return (
    <details className="metric-table-card metric-data-disclosure">
      <summary><span><Database size={18} /><strong>View all returned data</strong></span><small>{rows.length} metric rows</small></summary>
      <div className="metric-table-intro"><p className="eyebrow">Accessible data table</p><h2>Backend values</h2><p>Empty values stay “No data” and currencies remain separate.</p></div>
      <div className="table-scroll"><table><thead><tr><th>Metric</th><th>Period</th><th>Dimension</th><th>Value</th><th>Samples</th></tr></thead><tbody>{rows.map((metric, index) => <tr key={`${metricKey(metric)}-${index}`}><th scope="row">{metric.label}</th><td>{metric.period}</td><td>{metric.dimensionLabel || metric.dimension || '—'}</td><td>{displayMetricValue(metric)}</td><td>{metric.samples ?? '—'}</td></tr>)}</tbody></table></div>
    </details>
  )
}

function MetricsView({ metrics, spending }: { metrics: DashboardMetric[]; spending: DashboardMetric[] }) {
  const valid = metrics.filter((metric) => !metric.empty && metric.value !== null && metric.value !== undefined)
  const activity = valid.filter((metric) => activityCodes.includes(metric.code))
  const cuisine = valid.filter((metric) => metric.code === 'CUISINE_DISTRIBUTION')
  const outcomes = valid.filter((metric) => outcomeCodes.includes(metric.code))
  const activityRows = pivotByPeriod(activity, (metric) => metric.label)
  const activitySeries = [...new Set(activity.map((metric) => metric.label))]
  const validSpending = spending.filter((metric) => !metric.empty && metric.value !== null && metric.value !== undefined)
  const spendingRows = pivotByPeriod(validSpending, (metric) => metric.currency || metric.dimension || 'Currency')
  const currencies = [...new Set(validSpending.map((metric) => metric.currency || metric.dimension || 'Currency'))]
  const cuisineRows = aggregateDimensionMetrics(cuisine)

  return (
    <>
      <InsightRelationship metrics={metrics} spending={spending} />
      <div className="analytics-grid">
        <ChartCard title="Food and drink activity" summary="Returned food and drink counts share a time axis so their movement is easy to compare.">{activityRows.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={activityRows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" /><YAxis /><Tooltip /><Legend />{activitySeries.map((series, index) => <Line type="monotone" dataKey={series} connectNulls={false} isAnimationActive={false} stroke={chartColors[index % chartColors.length]} strokeWidth={3} key={series} />)}</LineChart></ResponsiveContainer> : <p className="chart-empty">No activity data</p>}</ChartCard>
        <ChartCard title="Spending over time" summary="Each currency remains a separate series, so monetary values are never combined.">{spendingRows.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={spendingRows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" /><YAxis /><Tooltip /><Legend />{currencies.map((currency, index) => <Bar dataKey={currency} name={currency} isAnimationActive={false} fill={chartColors[(index + 1) % chartColors.length]} radius={[6, 6, 0, 0]} key={currency} />)}</BarChart></ResponsiveContainer> : <p className="chart-empty">No spending data</p>}</ChartCard>
        <ChartCard title="Cuisine mix" summary="Backend cuisine dimensions are shown as parts of the recorded mix.">{cuisineRows.length ? <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={cuisineRows} dataKey="value" nameKey="name" innerRadius={66} isAnimationActive={false} outerRadius={104} paddingAngle={3}>{cuisineRows.map((row, index) => <Cell fill={chartColors[index % chartColors.length]} key={row.dimension} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <p className="chart-empty">No cuisine data</p>}</ChartCard>
        <ChartCard title="Recommendation outcomes" summary="Rates and counts use separate diagram scales so unlike units are never compared as if they were equal."><RecommendationOutcomes metrics={outcomes} /></ChartCard>
      </div>
      <RawDataDisclosure metrics={metrics} spending={spending} />
    </>
  )
}

function ChartCard({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const summaryId = `${title.replaceAll(' ', '-').toLowerCase()}-summary`
  return <section className="chart-card" aria-labelledby={`${summaryId}-title`} aria-describedby={summaryId}><div><p className="eyebrow">Diagram</p><h2 id={`${summaryId}-title`}>{title}</h2><p id={summaryId}>{summary}</p></div><div className="chart-wrap" aria-hidden="true">{children}</div></section>
}

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    from: searchParams.get('from') || date(-90),
    to: searchParams.get('to') || date(1),
    groupBy: (searchParams.get('groupBy') || 'WEEK') as 'DAY' | 'WEEK' | 'MONTH',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Singapore',
  }
  const dashboard = useQuery({ queryKey: queryKeys.analytics.dashboard(filters), queryFn: async () => dataOrThrow<Schema<'DashboardResponse'>>(await api.GET('/dashboard', { params: { query: filters } })), staleTime: 5 * 60 * 1000 })
  const changeFilter = (key: string, value: string) => { const next = new URLSearchParams(searchParams); next.set(key, value); setSearchParams(next) }
  return <div className="page section-page analytics-page"><header className="section-page-heading insights-heading"><div><p className="eyebrow">Patterns connected</p><h1>Insights</h1><p>See how your activity, spending, tastes, and recommendation outcomes fit together.</p></div><Link className="primary-action" to={`/weekly-recaps/${mondayOfCurrentWeek()}`}><CalendarDays size={17} /> This week's recap</Link></header><section className="filter-bar insight-filters" aria-label="Insight period"><label>From<input type="date" value={filters.from} onChange={(event) => changeFilter('from', event.target.value)} /></label><label>To (exclusive)<input type="date" value={filters.to} onChange={(event) => changeFilter('to', event.target.value)} /></label><label>Group by<select value={filters.groupBy} onChange={(event) => changeFilter('groupBy', event.target.value)}><option>DAY</option><option>WEEK</option><option>MONTH</option></select></label></section>{dashboard.isLoading && <LoadingState label="Building your insights…" />}{dashboard.isError && <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />}{dashboard.data?.empty && <EmptyState title="No data for this range" message="FoodMind has no defined metrics for the selected dates yet. Empty is not the same as zero." />}{dashboard.data && !dashboard.data.empty && <MetricsView metrics={dashboard.data.metrics} spending={dashboard.data.spendingTotals} />}</div>
}

export function WeeklyRecapPage() {
  const { weekStart = '' } = useParams()
  const recap = useQuery({ queryKey: queryKeys.analytics.recap(weekStart), queryFn: async () => dataOrThrow<Schema<'WeeklyRecapResponse'>>(await api.GET('/weekly-recaps/{weekStart}', { params: { path: { weekStart } } })) })
  return <div className="page section-page analytics-page"><Link className="back-link" to="/dashboard"><ArrowLeft size={16} /> Insights</Link><header className="recap-hero"><span><BarChart3 /></span><div><p className="eyebrow">Week of {weekStart}</p><h1>Your weekly recap</h1><p>The same relationship view, focused on one backend-defined week.</p></div></header>{recap.isLoading && <LoadingState label="Preparing your recap…" />}{recap.isError && <ErrorState error={recap.error} onRetry={() => void recap.refetch()} />}{recap.data?.empty && <EmptyState title="A quiet week in FoodMind" message="No defined metric values were returned for this exact backend week-start date." />}{recap.data && !recap.data.empty && <MetricsView metrics={recap.data.metrics} spending={recap.data.spendingTotals} />}</div>
}
