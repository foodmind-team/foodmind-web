import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Coffee, Edit3, Plus, Star, Trash2, Utensils } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { api, ApiError, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { quotedVersion } from '../lib/commands'
import { formatDateTime, formatMoney, sentenceCase, toLocalDateTimeValue } from '../lib/format'

type RecordType = 'food' | 'drink'
type FoodRecord = Schema<'FoodRecordResponse'>
type DrinkRecord = Schema<'DrinkRecordResponse'>
type AnyRecord = FoodRecord | DrinkRecord

function defaultDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    from: searchParams.get('from') || defaultDate(-30),
    to: searchParams.get('to') || defaultDate(1),
    period: (searchParams.get('period') || 'WEEK') as 'DAY' | 'WEEK' | 'MONTH',
    types: searchParams.get('types') || 'FOOD,DRINK',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Singapore',
  }
  const history = useInfiniteQuery({
    queryKey: queryKeys.records.history(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => dataOrThrow<Schema<'HistoryResponse'>>(await api.GET('/history', { params: { query: { ...filters, cursor: pageParam, size: 30 } } })),
    getNextPageParam: (page) => page.nextCursor || undefined,
  })
  const entries = history.data?.pages.flatMap((page) => page.entries) || []

  const changeFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set(key, value)
    setSearchParams(next)
  }

  return (
    <div className="page section-page">
      <header className="section-page-heading"><div><p className="eyebrow">Your real food story</p><h1>History</h1><p>Food and drink records in one time-zone-aware timeline.</p></div><Link className="primary-action" to="/records/new"><Plus size={17} /> Add record</Link></header>
      <section className="filter-bar" aria-label="History filters">
        <label>From<input type="date" value={filters.from} onChange={(event) => changeFilter('from', event.target.value)} /></label>
        <label>To<input type="date" value={filters.to} onChange={(event) => changeFilter('to', event.target.value)} /></label>
        <label>Group by<select value={filters.period} onChange={(event) => changeFilter('period', event.target.value)}><option>DAY</option><option>WEEK</option><option>MONTH</option></select></label>
        <label>Record type<select value={filters.types} onChange={(event) => changeFilter('types', event.target.value)}><option value="FOOD,DRINK">Food &amp; drink</option><option value="FOOD">Food only</option><option value="DRINK">Drinks only</option></select></label>
      </section>
      {history.isLoading && <LoadingState label="Gathering your food history…" />}
      {history.isError && <ErrorState error={history.error} onRetry={() => void history.refetch()} />}
      {history.isSuccess && entries.length === 0 && <EmptyState title="Your history starts with one meal" message="Record something you ate or drank and FoodMind will keep it organised here." action={<Link className="primary-action" to="/records/new">Add your first record</Link>} />}
      {entries.length > 0 && <section className="timeline-list">{entries.map((entry) => <Link className="timeline-card" to={`/records/${entry.sourceType.toLowerCase()}/${entry.sourceId}`} key={`${entry.sourceType}-${entry.sourceId}`}><span className={`timeline-icon ${entry.sourceType.toLowerCase()}`}>{entry.sourceType === 'FOOD' ? <Utensils /> : <Coffee />}</span><div><p className="eyebrow">{sentenceCase(entry.sourceType)} · {formatDateTime(entry.occurredAt)}</p><h2>{entry.title}</h2><p>{entry.context || 'Personal or trusted-group record'}</p></div><span className="timeline-rating">{entry.rating ? <><Star size={15} fill="currentColor" /> {entry.rating}</> : 'Not rated'}<ArrowRight size={17} /></span></Link>)}</section>}
      {history.hasNextPage && <button className="secondary-action load-more" type="button" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>{history.isFetchingNextPage ? 'Loading…' : 'Load more records'}</button>}
    </div>
  )
}

type RecordFormValues = {
  type: RecordType
  name: string
  placeName: string
  mealId: string
  placeId: string
  cuisineId: string
  occurredAt: string
  price: string
  currency: string
  rating: string
  comment: string
  repeatIntent: string
  sweetnessLevel: string
  iceLevel: string
  visibility: 'PRIVATE' | 'GROUP'
  groupId: string
}

function useRecordLookups() {
  const groups = useQuery({ queryKey: queryKeys.groups.list(), queryFn: async () => dataOrThrow<Schema<'GroupResponse'>[]>(await api.GET('/groups')) })
  const catalogue = useQuery({ queryKey: queryKeys.catalogue.reference(), staleTime: Infinity, queryFn: async () => dataOrThrow<Schema<'CatalogueReferenceDataResponse'>>(await api.GET('/catalogue/reference-data')) })
  return { groups, catalogue }
}

function recordDefaults(type: RecordType, record?: AnyRecord | null, searchParams?: URLSearchParams): RecordFormValues {
  const food = record && 'mealNameSnapshot' in record ? record : null
  const drink = record && 'drinkName' in record ? record : null
  return {
    type,
    name: food?.mealNameSnapshot || drink?.drinkName || searchParams?.get('mealName') || '',
    placeName: food?.placeNameSnapshot || drink?.shopNameSnapshot || searchParams?.get('placeName') || '',
    mealId: food?.mealId || searchParams?.get('mealId') || '',
    placeId: food?.placeId || drink?.placeId || searchParams?.get('placeId') || '',
    cuisineId: food?.cuisineId || '',
    occurredAt: toLocalDateTimeValue(record?.occurredAt),
    price: record?.price?.amount?.toString() || '',
    currency: record?.price?.currency || 'SGD',
    rating: record?.rating?.toString() || '',
    comment: record?.comment || '',
    repeatIntent: food?.wouldEatAgain === true || drink?.wouldBuyAgain === true ? 'true' : food?.wouldEatAgain === false || drink?.wouldBuyAgain === false ? 'false' : '',
    sweetnessLevel: drink?.sweetnessLevel?.toString() || '',
    iceLevel: drink?.iceLevel?.toString() || '',
    visibility: record?.visibility || 'PRIVATE',
    groupId: record?.groupId || '',
  }
}

function numberOrNull(value: string) {
  return value.trim() ? Number(value) : null
}

function booleanOrNull(value: string) {
  return value === 'true' ? true : value === 'false' ? false : null
}

function recordBody(values: RecordFormValues) {
  const common = {
    placeId: values.placeId || null,
    occurredAt: new Date(values.occurredAt).toISOString(),
    price: numberOrNull(values.price),
    currency: values.price ? values.currency.toUpperCase() : null,
    rating: numberOrNull(values.rating),
    comment: values.comment || null,
    visibility: values.visibility,
    groupId: values.visibility === 'GROUP' ? values.groupId || null : null,
  } as const
  if (values.type === 'food') return { ...common, mealId: values.mealId || null, mealNameSnapshot: values.name, placeNameSnapshot: values.placeName || null, cuisineId: values.cuisineId || null, wouldEatAgain: booleanOrNull(values.repeatIntent) } satisfies Schema<'CreateFoodRecordRequest'>
  return { ...common, drinkName: values.name, shopNameSnapshot: values.placeName, sweetnessLevel: numberOrNull(values.sweetnessLevel), iceLevel: numberOrNull(values.iceLevel), wouldBuyAgain: booleanOrNull(values.repeatIntent) } satisfies Schema<'CreateDrinkRecordRequest'>
}

function RecordForm({ type, record, recordId }: { type: RecordType; record?: AnyRecord | null; recordId?: string }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { groups, catalogue } = useRecordLookups()
  const [conflict, setConflict] = useState(false)
  const defaults = useMemo(() => recordDefaults(type, record, searchParams), [record, searchParams, type])
  const { register, handleSubmit, watch, reset, setError, formState: { errors, isSubmitting } } = useForm<RecordFormValues>({ values: defaults })
  const currentType = watch('type')
  const visibility = watch('visibility')
  const sessionId = searchParams.get('sessionId')
  const candidateId = searchParams.get('candidateId')

  useEffect(() => reset({ ...defaults, type: currentType }), [currentType, defaults, reset])

  const submit = handleSubmit(async (values) => {
    setConflict(false)
    if (!values.name.trim()) { setError('name', { message: currentType === 'food' ? 'Enter the meal name.' : 'Enter the drink name.' }); return }
    if (currentType === 'drink' && !values.placeName.trim()) { setError('placeName', { message: 'Enter the shop or place name.' }); return }
    if (visibility === 'GROUP' && !values.groupId) { setError('groupId', { message: 'Choose a group.' }); return }
    try {
      let saved: AnyRecord
      if (recordId) {
        const params = { path: { id: recordId }, header: { 'If-Match': quotedVersion(record!.version) } }
        saved = currentType === 'food'
          ? dataOrThrow<FoodRecord>(await api.PATCH('/food-records/{id}', { body: recordBody(values) as Schema<'UpdateFoodRecordRequest'>, params }))
          : dataOrThrow<DrinkRecord>(await api.PATCH('/drink-records/{id}', { body: recordBody(values) as Schema<'UpdateDrinkRecordRequest'>, params }))
      } else {
        saved = currentType === 'food'
          ? dataOrThrow<FoodRecord>(await api.POST('/food-records', { body: recordBody(values) as Schema<'CreateFoodRecordRequest'> }))
          : dataOrThrow<DrinkRecord>(await api.POST('/drink-records', { body: recordBody(values) as Schema<'CreateDrinkRecordRequest'> }))
      }

      if (!recordId && currentType === 'food' && sessionId && candidateId && saved.rating) {
        await api.POST('/recommendations/{sessionId}/feedback', { body: { eventType: 'LATER_RATED', candidateId, rating: saved.rating, resultingFoodRecordId: saved.id }, params: { path: { sessionId }, header: { 'Idempotency-Key': crypto.randomUUID() } } })
        if ('wouldEatAgain' in saved && saved.wouldEatAgain !== null && saved.wouldEatAgain !== undefined) {
          await api.POST('/recommendations/{sessionId}/feedback', { body: { eventType: 'WOULD_EAT_AGAIN', candidateId, booleanValue: saved.wouldEatAgain, resultingFoodRecordId: saved.id }, params: { path: { sessionId }, header: { 'Idempotency-Key': crypto.randomUUID() } } })
        }
      }
      queryClient.setQueryData(queryKeys.records.detail(currentType, saved.id), saved)
      void queryClient.invalidateQueries({ queryKey: ['records'] })
      void queryClient.invalidateQueries({ queryKey: ['analytics'] })
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      showToast(recordId ? 'Record updated.' : 'Record added to your history.')
      navigate(`/records/${currentType}/${saved.id}`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setConflict(true)
      if (error instanceof ApiError) error.fieldErrors.forEach((field) => {
        const map: Record<string, keyof RecordFormValues> = { mealNameSnapshot: 'name', drinkName: 'name', shopNameSnapshot: 'placeName', groupId: 'groupId', occurredAt: 'occurredAt', rating: 'rating' }
        if (map[field.field]) setError(map[field.field], { message: field.message })
      })
      throw error
    }
  })

  return (
    <form className="record-form card-form" onSubmit={(event) => void submit(event).catch(() => undefined)} noValidate>
      {!recordId && <div className="segmented-control" aria-label="Record type"><label className={currentType === 'food' ? 'active' : ''}><input type="radio" value="food" {...register('type')} /> <Utensils size={17} /> Food</label><label className={currentType === 'drink' ? 'active' : ''}><input type="radio" value="drink" {...register('type')} /> <Coffee size={17} /> Drink</label></div>}
      {conflict && <div className="conflict-panel" role="alert"><strong>A newer version is available.</strong><p>Your draft is still here. Reload the latest record before deciding what to reapply.</p><button className="secondary-action" type="button" onClick={() => window.location.reload()}>Reload latest</button></div>}
      {errors.root && <div className="form-alert" role="alert">{errors.root.message}</div>}
      <div className="form-grid">
        <label>{currentType === 'food' ? 'Meal name' : 'Drink name'}<input {...register('name')} aria-invalid={Boolean(errors.name)} />{errors.name && <small>{errors.name.message}</small>}</label>
        <label>{currentType === 'food' ? 'Place (optional)' : 'Shop or place'}<input {...register('placeName')} aria-invalid={Boolean(errors.placeName)} />{errors.placeName && <small>{errors.placeName.message}</small>}</label>
        <label>When you had it<input type="datetime-local" {...register('occurredAt')} /></label>
        {currentType === 'food' && <label>Cuisine<select {...register('cuisineId')}><option value="">Not specified</option>{catalogue.data?.cuisines.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
        <label>Price<input type="number" min="0" step="0.01" {...register('price')} /></label>
        <label>Currency<input maxLength={3} {...register('currency')} /></label>
        <label>Rating<select {...register('rating')}><option value="">Not rated</option>{[1, 2, 3, 4, 5].map((rating) => <option value={rating} key={rating}>{rating} / 5</option>)}</select></label>
        <label>{currentType === 'food' ? 'Would eat again?' : 'Would buy again?'}<select {...register('repeatIntent')}><option value="">Not sure</option><option value="true">Yes</option><option value="false">No</option></select></label>
        {currentType === 'drink' && <><label>Sweetness level<select {...register('sweetnessLevel')}><option value="">Not specified</option>{[0, 1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select></label><label>Ice level<select {...register('iceLevel')}><option value="">Not specified</option>{[0, 1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select></label></>}
        <label>Visibility<select {...register('visibility')}><option value="PRIVATE">Private</option><option value="GROUP">A trusted group</option></select></label>
        {visibility === 'GROUP' && <label>Group<select {...register('groupId')} aria-invalid={Boolean(errors.groupId)}><option value="">Choose a group</option>{groups.data?.filter((group) => group.status === 'ACTIVE').map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select>{errors.groupId && <small>{errors.groupId.message}</small>}</label>}
      </div>
      <label>Notes<textarea rows={4} maxLength={2_000} {...register('comment')} /></label>
      <p className="field-note">Optional fields cannot be explicitly cleared yet; the backend currently treats omitted and null values as unchanged on edits.</p>
      <div className="form-actions"><Link className="secondary-action" to={recordId ? `/records/${type}/${recordId}` : '/history'}>Cancel</Link><button className="primary-action" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : recordId ? 'Save changes' : 'Add to history'} <Check size={17} /></button></div>
    </form>
  )
}

export function RecordComposerPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') === 'drink' ? 'drink' : 'food'
  return <div className="page section-page narrow-page"><header className="section-page-heading"><div><p className="eyebrow">A signal you control</p><h1>Record a meal or drink</h1><p>Keep the details that will be useful later. Photos stay off until authorised media reads are supported.</p></div></header><RecordForm type={type} /></div>
}

function useRecord(type: string, id: string) {
  const recordType = type === 'drink' ? 'drink' : 'food'
  return useQuery({
    queryKey: queryKeys.records.detail(recordType, id),
    queryFn: async () => recordType === 'food'
      ? dataOrThrow<FoodRecord>(await api.GET('/food-records/{id}', { params: { path: { id } } }))
      : dataOrThrow<DrinkRecord>(await api.GET('/drink-records/{id}', { params: { path: { id } } })),
  })
}

export function RecordDetailPage() {
  const { recordType = 'food', id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const record = useRecord(recordType, id)
  const type: RecordType = recordType === 'drink' ? 'drink' : 'food'
  const remove = useMutation({
    mutationFn: async () => type === 'food'
      ? dataOrThrow<void>(await api.DELETE('/food-records/{id}', { params: { path: { id } } }))
      : dataOrThrow<void>(await api.DELETE('/drink-records/{id}', { params: { path: { id } } })),
    onSuccess: () => { queryClient.removeQueries({ queryKey: queryKeys.records.detail(type, id) }); void queryClient.invalidateQueries({ queryKey: ['records'] }); showToast('Record removed.'); navigate('/history') },
  })
  if (record.isLoading) return <div className="page"><LoadingState label="Opening this record…" /></div>
  if (record.isError) return <div className="page"><ErrorState error={record.error} onRetry={() => void record.refetch()} /></div>
  const data = record.data!
  const title = 'mealNameSnapshot' in data ? data.mealNameSnapshot : data.drinkName
  const place = 'mealNameSnapshot' in data ? data.placeNameSnapshot : data.shopNameSnapshot
  const repeat = 'mealNameSnapshot' in data ? data.wouldEatAgain : data.wouldBuyAgain
  return <div className="page section-page narrow-page"><Link className="back-link" to="/history"><ArrowLeft size={16} /> History</Link><header className="record-hero"><span className={`record-hero-icon ${type}`}>{type === 'food' ? <Utensils /> : <Coffee />}</span><div><p className="eyebrow">{sentenceCase(type)} · {sentenceCase(data.visibility)}</p><h1>{title}</h1><p>{place || 'No place recorded'} · {formatDateTime(data.occurredAt)}</p></div></header><section className="detail-card"><dl className="detail-grid"><div><dt>Rating</dt><dd>{data.rating ? `${data.rating} / 5` : 'Not rated'}</dd></div><div><dt>Price</dt><dd>{formatMoney(data.price?.amount, data.price?.currency)}</dd></div><div><dt>{type === 'food' ? 'Would eat again' : 'Would buy again'}</dt><dd>{repeat === null || repeat === undefined ? 'Not answered' : repeat ? 'Yes' : 'No'}</dd></div><div><dt>Last updated</dt><dd>{formatDateTime(data.updatedAt)}</dd></div></dl>{data.comment && <div className="note-block"><p className="eyebrow">Your note</p><p>{data.comment}</p></div>}<div className="form-actions"><Link className="primary-action" to={`/records/${type}/${id}/edit`}><Edit3 size={17} /> Edit if you own it</Link><button className="secondary-action danger" type="button" onClick={() => setConfirming(true)}><Trash2 size={17} /> Delete</button></div>{confirming && <div className="confirm-panel" role="alertdialog" aria-labelledby="delete-title"><h2 id="delete-title">Delete this record?</h2><p>This removes it from normal history views and cannot be undone from the web app.</p>{remove.isError && <p className="inline-error">{errorMessage(remove.error)}</p>}<div className="form-actions"><button className="secondary-action" type="button" onClick={() => setConfirming(false)}>Keep record</button><button className="primary-action danger" type="button" disabled={remove.isPending} onClick={() => remove.mutate()}>Delete record</button></div></div>}</section></div>
}

export function RecordEditorPage() {
  const { recordType = 'food', id = '' } = useParams()
  const type: RecordType = recordType === 'drink' ? 'drink' : 'food'
  const record = useRecord(type, id)
  if (record.isLoading) return <div className="page"><LoadingState label="Preparing the latest record…" /></div>
  if (record.isError) return <div className="page"><ErrorState error={record.error} onRetry={() => void record.refetch()} /></div>
  return <div className="page section-page narrow-page"><header className="section-page-heading"><div><p className="eyebrow">Version {record.data?.version}</p><h1>Edit record</h1><p>If this record changed elsewhere, FoodMind will preserve your draft and ask you to reload.</p></div></header><RecordForm type={type} record={record.data} recordId={id} /></div>
}
