import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowLeft, BarChart3, CalendarDays, Star, TrendingUp } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { api, dataOrThrow, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { localCalendarDate, localMonday } from '../lib/local-date'

type Metric = Schema<'DashboardMetricResponse'>
type ChartRow = Record<string, string | number>
const chartColors = ['#174d38', '#f27b5b', '#83a84d', '#d4a72c', '#5e7c70', '#9c6b4f']

function date(offsetDays = 0) {
  return localCalendarDate(new Date(), offsetDays)
}

function mondayOfCurrentWeek() {
  return localMonday(new Date())
}

function displayValue(metric: Metric) {
  if (metric.empty || metric.value === null || metric.value === undefined) return 'No data'
  if (metric.unit === 'MONEY') return `${metric.currency || metric.dimension || ''} ${metric.value.toLocaleString()}`.trim()
  if (metric.unit === 'RATE') return `${(metric.value * 100).toFixed(1)}%`
  if (metric.unit === 'RATING') return metric.value.toFixed(1)
  return metric.value.toLocaleString()
}

function pivotByPeriod(metrics: Metric[], seriesName: (metric: Metric) => string) {
  const rows = new Map<string, ChartRow>()
  for (const metric of metrics) {
    if (metric.value === null || metric.value === undefined || metric.empty) continue
    const row = rows.get(metric.period) || { period: metric.period }
    row[seriesName(metric)] = metric.value
    rows.set(metric.period, row)
  }
  return [...rows.values()]
}

function MetricsView({ metrics, spending }: { metrics: Metric[]; spending: Metric[] }) {
  const valid = metrics.filter((metric) => !metric.empty && metric.value !== null && metric.value !== undefined)
  const kpiCodes = new Set(['MEAN_RATING', 'REPEAT_FREQUENCY', 'ACCEPTANCE_RATE', 'REJECTION_RATE', 'WOULD_AGAIN_RATE', 'RECOMMENDATION_WOULD_EAT_AGAIN_RATE'])
  const activityCodes = ['FOOD_COUNT', 'DRINK_COUNT', 'FOOD_DRINK_COUNT']
  const outcomeCodes = ['ACCEPTANCE_RATE', 'REJECTION_RATE', 'WOULD_AGAIN_RATE', 'RECOMMENDATION_WOULD_EAT_AGAIN_RATE', 'REJECTION_REASON', 'SELECTED_CANDIDATE_TYPE']
  const kpis = metrics.filter((metric) => kpiCodes.has(metric.code))
  const activity = valid.filter((metric) => activityCodes.includes(metric.code))
  const cuisine = valid.filter((metric) => metric.code === 'CUISINE_DISTRIBUTION')
  const outcomes = valid.filter((metric) => outcomeCodes.includes(metric.code))
  const activityRows = pivotByPeriod(activity, (metric) => metric.label)
  const activitySeries = [...new Set(activity.map((metric) => metric.label))]
  const validSpending = spending.filter((metric) => !metric.empty && metric.value !== null && metric.value !== undefined)
  const spendingRows = pivotByPeriod(validSpending, (metric) => metric.currency || metric.dimension || 'Currency')
  const currencies = [...new Set(validSpending.map((metric) => metric.currency || metric.dimension || 'Currency'))]
  const cuisineRows = cuisine.map((metric) => ({ name: metric.dimensionLabel || metric.dimension || metric.label, value: metric.value as number, period: metric.period }))
  const outcomeRows = outcomes.map((metric) => ({ label: metric.dimensionLabel || metric.dimension || metric.label, value: metric.value as number, family: metric.label, period: metric.period }))

  return (
    <>
      <section className="metric-kpis">{kpis.length ? kpis.map((metric) => <article className="metric-card" key={`${metric.code}-${metric.period}-${metric.dimension}`}><span>{metric.code === 'MEAN_RATING' ? <Star /> : <TrendingUp />}</span><p className="eyebrow">{metric.label}</p><strong>{displayValue(metric)}</strong><small>{metric.empty ? 'No data for this period' : metric.samples ? `${metric.samples} samples` : metric.period}</small></article>) : <article className="metric-card empty-metric"><Activity /><p>No summary metrics returned.</p></article>}</section>
      <div className="analytics-grid">
        <ChartCard title="Food and drink activity" summary={`${activity.length} backend metric rows, grouped visually by the returned period.`}>{activityRows.length ? <ResponsiveContainer width="100%" height={280}><BarChart data={activityRows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" /><YAxis /><Tooltip /><Legend />{activitySeries.map((series, index) => <Bar dataKey={series} fill={chartColors[index % chartColors.length]} isAnimationActive={false} radius={[6, 6, 0, 0]} key={series} />)}</BarChart></ResponsiveContainer> : <p className="chart-empty">No activity data</p>}</ChartCard>
        <ChartCard title="Spending by currency" summary="Each currency is a separate series; FoodMind never combines monetary values across currencies.">{spendingRows.length ? <ResponsiveContainer width="100%" height={280}><LineChart data={spendingRows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" /><YAxis /><Tooltip /><Legend />{currencies.map((currency, index) => <Line type="monotone" dataKey={currency} name={currency} connectNulls={false} isAnimationActive={false} stroke={chartColors[(index + 1) % chartColors.length]} strokeWidth={3} key={currency} />)}</LineChart></ResponsiveContainer> : <p className="chart-empty">No spending data</p>}</ChartCard>
        <ChartCard title="Cuisine distribution" summary={`${cuisineRows.length} cuisine rows displayed exactly as returned; labels include their backend dimensions.`}>{cuisineRows.length ? <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={cuisineRows} dataKey="value" nameKey="name" innerRadius={62} isAnimationActive={false} outerRadius={105} paddingAngle={2}>{cuisineRows.map((row, index) => <Cell fill={chartColors[index % chartColors.length]} key={`${row.name}-${row.period}-${index}`} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <p className="chart-empty">No cuisine data</p>}</ChartCard>
        <ChartCard title="Recommendation outcomes" summary={`${outcomeRows.length} acceptance, rejection, reason, and candidate-type rows without client-side recalculation.`}>{outcomeRows.length ? <ResponsiveContainer width="100%" height={Math.max(300, outcomeRows.length * 34)}><BarChart data={outcomeRows} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="label" width={125} /><Tooltip /><Bar dataKey="value" fill="#d7ef72" isAnimationActive={false} stroke="#174d38" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer> : <p className="chart-empty">No recommendation outcome data</p>}</ChartCard>
      </div>
      <section className="metric-table-card"><div><p className="eyebrow">Accessible data table</p><h2>All returned metrics</h2><p>Null and empty values remain “No data”; they are never converted to zero.</p></div><div className="table-scroll"><table><thead><tr><th>Metric</th><th>Period</th><th>Dimension</th><th>Value</th><th>Samples</th></tr></thead><tbody>{metrics.map((metric, index) => <tr key={`${metric.code}-${metric.period}-${metric.dimension}-${index}`}><th scope="row">{metric.label}</th><td>{metric.period}</td><td>{metric.dimensionLabel || metric.dimension || '—'}</td><td>{displayValue(metric)}</td><td>{metric.samples ?? '—'}</td></tr>)}</tbody></table></div></section>
    </>
  )
}

function ChartCard({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  const summaryId = `${title.replaceAll(' ', '-').toLowerCase()}-summary`
  return <section className="chart-card" aria-labelledby={`${summaryId}-title`} aria-describedby={summaryId}><div><p className="eyebrow">Backend-owned metric</p><h2 id={`${summaryId}-title`}>{title}</h2><p id={summaryId}>{summary}</p></div><div className="chart-wrap" aria-hidden="true">{children}</div></section>
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
  return <div className="page section-page analytics-page"><header className="section-page-heading"><div><p className="eyebrow">Your patterns, calculated once</p><h1>Dashboard</h1><p>FoodMind renders the metric values returned by the backend—no client-side business calculations.</p></div><Link className="primary-action" to={`/weekly-recaps/${mondayOfCurrentWeek()}`}><CalendarDays size={17} /> This week's recap</Link></header><section className="filter-bar"><label>From<input type="date" value={filters.from} onChange={(event) => changeFilter('from', event.target.value)} /></label><label>To (exclusive)<input type="date" value={filters.to} onChange={(event) => changeFilter('to', event.target.value)} /></label><label>Group by<select value={filters.groupBy} onChange={(event) => changeFilter('groupBy', event.target.value)}><option>DAY</option><option>WEEK</option><option>MONTH</option></select></label></section>{dashboard.isLoading && <LoadingState label="Building your dashboard…" />}{dashboard.isError && <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />}{dashboard.data?.empty && <EmptyState title="No data for this range" message="FoodMind has no defined metrics for the selected dates yet. Empty is not the same as zero." />}{dashboard.data && !dashboard.data.empty && <MetricsView metrics={dashboard.data.metrics} spending={dashboard.data.spendingTotals} />}</div>
}

export function WeeklyRecapPage() {
  const { weekStart = '' } = useParams()
  const recap = useQuery({ queryKey: queryKeys.analytics.recap(weekStart), queryFn: async () => dataOrThrow<Schema<'WeeklyRecapResponse'>>(await api.GET('/weekly-recaps/{weekStart}', { params: { path: { weekStart } } })) })
  return <div className="page section-page analytics-page"><Link className="back-link" to="/dashboard"><ArrowLeft size={16} /> Dashboard</Link><header className="recap-hero"><span><BarChart3 /></span><div><p className="eyebrow">Week of {weekStart}</p><h1>Your weekly recap</h1><p>A concise backend-owned view of meals, drinks, spending, and recommendation feedback.</p></div></header>{recap.isLoading && <LoadingState label="Preparing your recap…" />}{recap.isError && <ErrorState error={recap.error} onRetry={() => void recap.refetch()} />}{recap.data?.empty && <EmptyState title="A quiet week in FoodMind" message="No defined metric values were returned for this exact backend week-start date." />}{recap.data && !recap.data.empty && <MetricsView metrics={recap.data.metrics} spending={recap.data.spendingTotals} />}</div>
}
