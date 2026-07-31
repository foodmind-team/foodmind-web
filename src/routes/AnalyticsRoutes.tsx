import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowLeft, BarChart3, CalendarDays, Star, TrendingUp } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { api, dataOrThrow, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'

type Metric = Schema<'DashboardMetricResponse'>

function date(offsetDays = 0) {
  const value = new Date()
  value.setDate(value.getDate() + offsetDays)
  return value.toISOString().slice(0, 10)
}

function mondayOfCurrentWeek() {
  const value = new Date()
  const day = value.getDay() || 7
  value.setDate(value.getDate() - day + 1)
  return value.toISOString().slice(0, 10)
}

function displayValue(metric: Metric) {
  if (metric.empty || metric.value === null || metric.value === undefined) return 'No data'
  if (metric.unit === 'MONEY') return `${metric.currency || metric.dimension || ''} ${metric.value.toLocaleString()}`.trim()
  if (metric.unit === 'RATE') return `${(metric.value * 100).toFixed(1)}%`
  if (metric.unit === 'RATING') return metric.value.toFixed(1)
  return metric.value.toLocaleString()
}

function MetricsView({ metrics, spending }: { metrics: Metric[]; spending: Metric[] }) {
  const valid = metrics.filter((metric) => !metric.empty && metric.value !== null && metric.value !== undefined)
  const kpiCodes = new Set(['MEAN_RATING', 'REPEAT_FREQUENCY', 'ACCEPTANCE_RATE', 'REJECTION_RATE', 'WOULD_AGAIN_RATE', 'RECOMMENDATION_WOULD_EAT_AGAIN_RATE'])
  const kpis = metrics.filter((metric) => kpiCodes.has(metric.code))
  const activity = valid.filter((metric) => ['FOOD_COUNT', 'DRINK_COUNT', 'FOOD_DRINK_COUNT'].includes(metric.code))
  const distributions = valid.filter((metric) => ['CUISINE_DISTRIBUTION', 'REJECTION_REASON', 'SELECTED_CANDIDATE_TYPE'].includes(metric.code))
  const chartRows = activity.map((metric) => ({ period: metric.period, label: metric.label, value: metric.value }))
  const spendingRows = spending.filter((metric) => !metric.empty && metric.value !== null && metric.value !== undefined).map((metric) => ({ period: metric.period, value: metric.value, currency: metric.currency || metric.dimension || 'Currency' }))
  const distributionRows = distributions.map((metric) => ({ label: metric.dimensionLabel || metric.dimension || metric.label, value: metric.value, family: metric.label }))
  return (
    <>
      <section className="metric-kpis">{kpis.length ? kpis.map((metric) => <article className="metric-card" key={`${metric.code}-${metric.period}-${metric.dimension}`}><span>{metric.code === 'MEAN_RATING' ? <Star /> : <TrendingUp />}</span><p className="eyebrow">{metric.label}</p><strong>{displayValue(metric)}</strong><small>{metric.empty ? 'No data for this period' : metric.samples ? `${metric.samples} samples` : metric.period}</small></article>) : <article className="metric-card empty-metric"><Activity /><p>No summary metrics returned.</p></article>}</section>
      <div className="analytics-grid">
        <ChartCard title="Food and drink activity" summary={`${activity.length} backend metric rows across the selected range.`}>{chartRows.length ? <ResponsiveContainer width="100%" height={280}><BarChart data={chartRows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#174d38" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="chart-empty">No activity data</p>}</ChartCard>
        <ChartCard title="Spending by currency" summary="Each returned currency remains a separate backend-owned row; currencies are never combined.">{spendingRows.length ? <ResponsiveContainer width="100%" height={280}><LineChart data={spendingRows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="value" stroke="#f27b5b" strokeWidth={3} /></LineChart></ResponsiveContainer> : <p className="chart-empty">No spending data</p>}</ChartCard>
        <ChartCard title="Patterns and outcomes" summary={`${distributionRows.length} returned distribution rows. Values are displayed exactly as supplied by the backend.`}>{distributionRows.length ? <ResponsiveContainer width="100%" height={300}><BarChart data={distributionRows} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="label" width={110} /><Tooltip /><Bar dataKey="value" fill="#d7ef72" stroke="#174d38" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer> : <p className="chart-empty">No distribution data</p>}</ChartCard>
      </div>
      <section className="metric-table-card"><div><p className="eyebrow">Accessible data table</p><h2>All returned metrics</h2><p>Null and empty values remain “No data”; they are never converted to zero.</p></div><div className="table-scroll"><table><thead><tr><th>Metric</th><th>Period</th><th>Dimension</th><th>Value</th><th>Samples</th></tr></thead><tbody>{metrics.map((metric, index) => <tr key={`${metric.code}-${metric.period}-${metric.dimension}-${index}`}><th scope="row">{metric.label}</th><td>{metric.period}</td><td>{metric.dimensionLabel || metric.dimension || '—'}</td><td>{displayValue(metric)}</td><td>{metric.samples ?? '—'}</td></tr>)}</tbody></table></div></section>
    </>
  )
}

function ChartCard({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return <section className="chart-card"><div><p className="eyebrow">Backend-owned metric</p><h2>{title}</h2><p id={`${title.replaceAll(' ', '-')}-summary`}>{summary}</p></div><div className="chart-wrap" role="img" aria-label={`${title}. ${summary}`}>{children}</div></section>
}

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    from: searchParams.get('from') || date(-90),
    to: searchParams.get('to') || date(1),
    groupBy: (searchParams.get('groupBy') || 'WEEK') as 'DAY' | 'WEEK' | 'MONTH',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Singapore',
  }
  const dashboard = useQuery({ queryKey: queryKeys.analytics.dashboard(filters), queryFn: async () => dataOrThrow<Schema<'DashboardResponse'>>(await api.GET('/dashboard', { params: { query: filters } })) })
  const changeFilter = (key: string, value: string) => { const next = new URLSearchParams(searchParams); next.set(key, value); setSearchParams(next) }
  return <div className="page section-page analytics-page"><header className="section-page-heading"><div><p className="eyebrow">Your patterns, calculated once</p><h1>Dashboard</h1><p>FoodMind renders the metric values returned by the backend—no client-side business calculations.</p></div><Link className="primary-action" to={`/weekly-recaps/${mondayOfCurrentWeek()}`}><CalendarDays size={17} /> This week's recap</Link></header><section className="filter-bar"><label>From<input type="date" value={filters.from} onChange={(event) => changeFilter('from', event.target.value)} /></label><label>To (exclusive)<input type="date" value={filters.to} onChange={(event) => changeFilter('to', event.target.value)} /></label><label>Group by<select value={filters.groupBy} onChange={(event) => changeFilter('groupBy', event.target.value)}><option>DAY</option><option>WEEK</option><option>MONTH</option></select></label></section>{dashboard.isLoading && <LoadingState label="Building your dashboard…" />}{dashboard.isError && <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />}{dashboard.data?.empty && <EmptyState title="No data for this range" message="FoodMind has no defined metrics for the selected dates yet. Empty is not the same as zero." />}{dashboard.data && !dashboard.data.empty && <MetricsView metrics={dashboard.data.metrics} spending={dashboard.data.spendingTotals} />}</div>
}

export function WeeklyRecapPage() {
  const { weekStart = '' } = useParams()
  const recap = useQuery({ queryKey: queryKeys.analytics.recap(weekStart), queryFn: async () => dataOrThrow<Schema<'WeeklyRecapResponse'>>(await api.GET('/weekly-recaps/{weekStart}', { params: { path: { weekStart } } })) })
  return <div className="page section-page analytics-page"><Link className="back-link" to="/dashboard"><ArrowLeft size={16} /> Dashboard</Link><header className="recap-hero"><span><BarChart3 /></span><div><p className="eyebrow">Week of {weekStart}</p><h1>Your weekly recap</h1><p>A concise backend-owned view of meals, drinks, spending, and recommendation feedback.</p></div></header>{recap.isLoading && <LoadingState label="Preparing your recap…" />}{recap.isError && <ErrorState error={recap.error} onRetry={() => void recap.refetch()} />}{recap.data?.empty && <EmptyState title="A quiet week in FoodMind" message="No defined metric values were returned for this exact backend week-start date." />}{recap.data && !recap.data.empty && <MetricsView metrics={recap.data.metrics} spending={recap.data.spendingTotals} />}</div>
}
