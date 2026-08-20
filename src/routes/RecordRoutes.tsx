import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Coffee, Edit3, Image, ImagePlus, Plus, ShieldCheck, Star, Trash2, Utensils, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { SafeImage } from '../components/media/SafeImage'
import { useToast } from '../components/feedback/ToastProvider'
import { api, ApiError, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { deleteRecordMedia, mediaValidationMessage, normaliseRecordMedia, uploadRecordMedia } from '../lib/api/media'
import { queryKeys } from '../lib/api/query-keys'
import { quotedVersion } from '../lib/commands'
import { formatDateTime, formatMoney, sentenceCase, toLocalDateTimeValue } from '../lib/format'
import { localCalendarDate } from '../lib/local-date'

type RecordType = 'food' | 'drink'
type FoodRecord = Schema<'FoodRecordResponse'>
type DrinkRecord = Schema<'DrinkRecordResponse'>
type AnyRecord = FoodRecord | DrinkRecord

function defaultDate(offsetDays = 0) {
  return localCalendarDate(new Date(), offsetDays)
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
      <header className="section-page-heading"><div><p className="eyebrow">Your real food story</p><h1>History</h1><p>Food and drink records in one time-zone-aware timeline.</p></div><div className="header-button-row"><Link className="secondary-action" to="/records/food"><Utensils size={17} /> Food records</Link><Link className="secondary-action" to="/records/drink"><Coffee size={17} /> Drink records</Link><Link className="primary-action" to="/records/new"><Plus size={17} /> Add record</Link></div></header>
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

export function RecordCollectionPage() {
  const { recordType = 'food' } = useParams()
  const type: RecordType = recordType === 'drink' ? 'drink' : 'food'
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    visibility: (searchParams.get('visibility') || '') as '' | 'PRIVATE' | 'GROUP',
    minRating: searchParams.get('minRating') || '',
    page: Math.max(0, Number(searchParams.get('page') || 0)),
    size: Math.min(50, Math.max(1, Number(searchParams.get('size') || 20))),
    sort: searchParams.get('sort') || 'occurredAt,desc',
  }
  const records = useQuery({
    queryKey: queryKeys.records.list(type, filters),
    queryFn: async () => {
      const query = {
        from: filters.from || undefined,
        to: filters.to || undefined,
        visibility: filters.visibility || undefined,
        minRating: filters.minRating ? Number(filters.minRating) : undefined,
        page: filters.page,
        size: filters.size,
        sort: filters.sort,
      }
      return type === 'food'
        ? dataOrThrow<Schema<'FoodRecordPageResponse'>>(await api.GET('/food-records', { params: { query } }))
        : dataOrThrow<Schema<'DrinkRecordPageResponse'>>(await api.GET('/drink-records', { params: { query } }))
    },
  })
  const items = (records.data?.items || []) as AnyRecord[]
  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  return (
    <div className="page section-page">
      <Link className="back-link" to="/history"><ArrowLeft size={16} /> Combined history</Link>
      <header className="section-page-heading"><div><p className="eyebrow">Authorised record library</p><h1>{type === 'food' ? 'Food records' : 'Drink records'}</h1><p>Browse the permission-scoped {type} records returned by the dedicated backend collection.</p></div><div className="header-button-row"><Link className="secondary-action" to={`/records/${type === 'food' ? 'drink' : 'food'}`}>{type === 'food' ? <Coffee size={17} /> : <Utensils size={17} />} {type === 'food' ? 'Drink records' : 'Food records'}</Link><Link className="primary-action" to={`/records/new?type=${type}`}><Plus size={17} /> Add {type}</Link></div></header>
      <section className="filter-bar record-library-filters" aria-label={`${type} record filters`}>
        <label>From<input type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} /></label>
        <label>To<input type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} /></label>
        <label>Visibility<select value={filters.visibility} onChange={(event) => updateFilter('visibility', event.target.value)}><option value="">All authorised</option><option value="PRIVATE">Private</option><option value="GROUP">Trusted group</option></select></label>
        <label>Minimum rating<select value={filters.minRating} onChange={(event) => updateFilter('minRating', event.target.value)}><option value="">Any rating</option>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}+</option>)}</select></label>
        <label>Sort<select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}><option value="occurredAt,desc">Newest meal time</option><option value="occurredAt,asc">Oldest meal time</option><option value="rating,desc">Highest rating</option><option value="createdAt,desc">Recently added</option></select></label>
        <label>Page size<select value={filters.size} onChange={(event) => updateFilter('size', event.target.value)}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
      </section>
      {records.isLoading && <LoadingState label={`Loading ${type} records…`} />}
      {records.isError && <ErrorState error={records.error} onRetry={() => void records.refetch()} />}
      {records.isSuccess && items.length === 0 && <EmptyState title={`No ${type} records match`} message="Adjust the filters or add a new record. Permission-controlled records stay hidden when unavailable." action={<Link className="primary-action" to={`/records/new?type=${type}`}>Add {type}</Link>} />}
      <section className="record-library-grid">{items.map((item) => {
        const food = 'mealNameSnapshot' in item
        const title = food ? item.mealNameSnapshot : item.drinkName
        const place = food ? item.placeNameSnapshot : item.shopNameSnapshot
        return <Link className="record-library-card" to={`/records/${type}/${item.id}`} key={item.id}><span className={`timeline-icon ${type}`}>{food ? <Utensils /> : <Coffee />}</span><div><p className="eyebrow">{sentenceCase(item.visibility)} · {formatDateTime(item.occurredAt)}</p><h2>{title}</h2><p>{place || 'No place recorded'}</p><div className="record-card-meta"><span>{formatMoney(item.price?.amount, item.price?.currency)}</span><span>{item.rating ? <><Star size={14} fill="currentColor" /> {item.rating}</> : 'Not rated'}</span></div></div><ArrowRight size={18} /></Link>
      })}</section>
      {records.data && records.data.totalPages > 1 && <nav className="pagination" aria-label={`${type} record pages`}><button type="button" disabled={filters.page === 0} onClick={() => updateFilter('page', String(filters.page - 1))}>Previous</button><span>Page {filters.page + 1} of {records.data.totalPages}</span><button type="button" disabled={!records.data.hasNext} onClick={() => updateFilter('page', String(filters.page + 1))}>Next</button></nav>}
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
    price: record?.price?.amount?.toString() || searchParams?.get('price') || '',
    currency: record?.price?.currency || searchParams?.get('currency') || 'SGD',
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

function recordBody(values: RecordFormValues, mediaAssetId?: string) {
  const common = {
    placeId: values.placeId || null,
    occurredAt: new Date(values.occurredAt).toISOString(),
    price: numberOrNull(values.price),
    currency: values.price ? values.currency.toUpperCase() : null,
    rating: numberOrNull(values.rating),
    comment: values.comment || null,
    visibility: values.visibility,
    groupId: values.visibility === 'GROUP' ? values.groupId || null : null,
    ...(mediaAssetId ? { mediaAssetId } : {}),
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
  const [photo, setPhoto] = useState<{ blob: Blob; name: string } | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const defaults = useMemo(() => recordDefaults(type, record, searchParams), [record, searchParams, type])
  const { register, handleSubmit, watch, reset, setError, formState: { errors, isSubmitting } } = useForm<RecordFormValues>({ values: defaults })
  const currentType = watch('type')
  const visibility = watch('visibility')
  const sessionId = searchParams.get('sessionId')
  const candidateId = searchParams.get('candidateId')
  const fromRecommendation = !recordId && currentType === 'food' && Boolean(sessionId && candidateId)

  useEffect(() => reset({ ...defaults, type: currentType }), [currentType, defaults, reset])
  useEffect(() => {
    if (!photo) { setPhotoPreview(null); return }
    const preview = URL.createObjectURL(photo.blob)
    setPhotoPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [photo])

  const choosePhoto = async (file?: File) => {
    if (!file) { setPhoto(null); setPhotoError(null); return }
    const validation = mediaValidationMessage(file)
    if (validation && file.type) { setPhotoError(validation); setPhoto(null); return }
    try {
      const blob = await normaliseRecordMedia(file)
      setPhoto({ blob, name: blob === file ? file.name : `${file.name.replace(/\.[^.]+$/, '') || 'image'}.jpg` })
      setPhotoError(null)
    } catch (error) {
      setPhoto(null)
      setPhotoError(error instanceof Error ? error.message : 'Choose a JPEG, PNG, or WebP image, or an image that can be converted to JPEG.')
    }
  }

  const submit = handleSubmit(async (values) => {
    setConflict(false)
    if (!values.name.trim()) { setError('name', { message: currentType === 'food' ? 'Enter the meal name.' : 'Enter the drink name.' }); return }
    if (currentType === 'drink' && !values.placeName.trim()) { setError('placeName', { message: 'Enter the shop or place name.' }); return }
    if (visibility === 'GROUP' && !values.groupId) { setError('groupId', { message: 'Choose a group.' }); return }
    if (photoError) return
    let newMediaAssetId: string | null = null
    let attachedToRecord = false
    try {
      if (photo) {
        setUploadingPhoto(true)
        const asset = await uploadRecordMedia(photo.blob)
        newMediaAssetId = asset.mediaAssetId
      }
      let saved: AnyRecord
      if (recordId) {
        const params = { path: { id: recordId }, header: { 'If-Match': quotedVersion(record!.version) } }
        saved = currentType === 'food'
          ? dataOrThrow<FoodRecord>(await api.PATCH('/food-records/{id}', { body: recordBody(values, newMediaAssetId || undefined) as Schema<'UpdateFoodRecordRequest'>, params }))
          : dataOrThrow<DrinkRecord>(await api.PATCH('/drink-records/{id}', { body: recordBody(values, newMediaAssetId || undefined) as Schema<'UpdateDrinkRecordRequest'>, params }))
      } else {
        saved = currentType === 'food'
          ? dataOrThrow<FoodRecord>(await api.POST('/food-records', { body: recordBody(values, newMediaAssetId || undefined) as Schema<'CreateFoodRecordRequest'> }))
          : dataOrThrow<DrinkRecord>(await api.POST('/drink-records', { body: recordBody(values, newMediaAssetId || undefined) as Schema<'CreateDrinkRecordRequest'> }))
      }
      attachedToRecord = true

      if (!recordId && currentType === 'food' && sessionId && candidateId && saved.rating) {
        void api.POST('/recommendations/{sessionId}/feedback', { body: { eventType: 'LATER_RATED', candidateId, rating: saved.rating, resultingFoodRecordId: saved.id }, params: { path: { sessionId }, header: { 'Idempotency-Key': crypto.randomUUID() } } })
        if ('wouldEatAgain' in saved && saved.wouldEatAgain !== null && saved.wouldEatAgain !== undefined) {
          void api.POST('/recommendations/{sessionId}/feedback', { body: { eventType: 'WOULD_EAT_AGAIN', candidateId, booleanValue: saved.wouldEatAgain, resultingFoodRecordId: saved.id }, params: { path: { sessionId }, header: { 'Idempotency-Key': crypto.randomUUID() } } })
        }
      }
      if (newMediaAssetId && record?.mediaAssetId && record.mediaAssetId !== newMediaAssetId) {
        void deleteRecordMedia(record.mediaAssetId).catch(() => showToast('Record updated, but the previous image could not be deleted. Try again from its record.', 'error'))
      }
      queryClient.setQueryData(queryKeys.records.detail(currentType, saved.id), saved)
      void queryClient.invalidateQueries({ queryKey: ['records'] })
      void queryClient.invalidateQueries({ queryKey: ['analytics'] })
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      void queryClient.invalidateQueries({ queryKey: ['explore'] })
      void queryClient.invalidateQueries({ queryKey: ['search'] })
      showToast(recordId ? 'Record updated.' : fromRecommendation ? 'Meal recorded. Opening it in Explore.' : 'Record added to your history.')
      navigate(fromRecommendation
        ? `/explore?type=records&view=${encodeURIComponent(`GROUP_RECORD:${saved.id}`)}`
        : `/records/${currentType}/${saved.id}`)
    } catch (error) {
      if (newMediaAssetId && !attachedToRecord) await deleteRecordMedia(newMediaAssetId).catch(() => undefined)
      if (error instanceof ApiError && error.status === 409) setConflict(true)
      let mappedField = false
      if (error instanceof ApiError) error.fieldErrors.forEach((field) => {
        const map: Record<string, keyof RecordFormValues> = {
          mealNameSnapshot: 'name', drinkName: 'name', placeNameSnapshot: 'placeName', shopNameSnapshot: 'placeName',
          groupId: 'groupId', occurredAt: 'occurredAt', rating: 'rating', cuisineId: 'cuisineId', price: 'price', currency: 'currency',
          comment: 'comment', sweetnessLevel: 'sweetnessLevel', iceLevel: 'iceLevel', wouldEatAgain: 'repeatIntent', wouldBuyAgain: 'repeatIntent',
        }
        if (map[field.field]) {
          mappedField = true
          setError(map[field.field], { message: field.message })
        }
      })
      if (!(error instanceof ApiError && error.status === 409) && !mappedField) setError('root', { message: errorMessage(error) })
    } finally {
      setUploadingPhoto(false)
    }
  })

  return (
    <form className="record-form card-form" onSubmit={(event) => void submit(event)} noValidate>
      {fromRecommendation && <div className="soft-warning" role="status"><strong>Recommendation accepted.</strong> Review what FoodMind filled in, add what you actually ate, then save to open this meal in Explore.</div>}
      {!recordId && <div className="segmented-control" aria-label="Record type"><label className={currentType === 'food' ? 'active' : ''}><input type="radio" value="food" {...register('type')} /> <Utensils size={17} /> Food</label><label className={currentType === 'drink' ? 'active' : ''}><input type="radio" value="drink" {...register('type')} /> <Coffee size={17} /> Drink</label></div>}
      {conflict && <div className="conflict-panel" role="alert"><strong>A newer version is available.</strong><p>Your draft is still here. Reload the latest record before deciding what to reapply.</p><button className="secondary-action" type="button" onClick={() => window.location.reload()}>Reload latest</button></div>}
      {errors.root && <div className="form-alert" role="alert">{errors.root.message}</div>}
      <div className="form-grid">
        <label>{currentType === 'food' ? 'Meal name' : 'Drink name'}<input {...register('name')} aria-invalid={Boolean(errors.name)} />{errors.name && <small>{errors.name.message}</small>}</label>
        <label>{currentType === 'food' ? 'Place (optional)' : 'Shop or place'}<input {...register('placeName')} aria-invalid={Boolean(errors.placeName)} />{errors.placeName && <small>{errors.placeName.message}</small>}</label>
        <label>When you had it<input type="datetime-local" {...register('occurredAt')} aria-invalid={Boolean(errors.occurredAt)} />{errors.occurredAt && <small>{errors.occurredAt.message}</small>}</label>
        {currentType === 'food' && <label>Cuisine<select {...register('cuisineId')} aria-invalid={Boolean(errors.cuisineId)}><option value="">Not specified</option>{catalogue.data?.cuisines.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{errors.cuisineId && <small>{errors.cuisineId.message}</small>}</label>}
        <label>Price<input type="number" min="0" step="0.01" {...register('price')} aria-invalid={Boolean(errors.price)} />{errors.price && <small>{errors.price.message}</small>}</label>
        <label>Currency<input maxLength={3} {...register('currency')} aria-invalid={Boolean(errors.currency)} />{errors.currency && <small>{errors.currency.message}</small>}</label>
        <label>Rating<select {...register('rating')} aria-invalid={Boolean(errors.rating)}><option value="">Not rated</option>{[1, 2, 3, 4, 5].map((rating) => <option value={rating} key={rating}>{rating} / 5</option>)}</select>{errors.rating && <small>{errors.rating.message}</small>}</label>
        <label>{currentType === 'food' ? 'Would eat again?' : 'Would buy again?'}<select {...register('repeatIntent')} aria-invalid={Boolean(errors.repeatIntent)}><option value="">Not sure</option><option value="true">Yes</option><option value="false">No</option></select>{errors.repeatIntent && <small>{errors.repeatIntent.message}</small>}</label>
        {currentType === 'drink' && <><label>Sweetness level<select {...register('sweetnessLevel')} aria-invalid={Boolean(errors.sweetnessLevel)}><option value="">Not specified</option>{[0, 1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select>{errors.sweetnessLevel && <small>{errors.sweetnessLevel.message}</small>}</label><label>Ice level<select {...register('iceLevel')} aria-invalid={Boolean(errors.iceLevel)}><option value="">Not specified</option>{[0, 1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select>{errors.iceLevel && <small>{errors.iceLevel.message}</small>}</label></>}
        <label>Who can see this in Explore?<select {...register('visibility')}><option value="PRIVATE">Only me</option><option value="GROUP">A trusted group</option></select></label>
        {visibility === 'GROUP' && <label>Group<select {...register('groupId')} aria-invalid={Boolean(errors.groupId)}><option value="">Choose a group</option>{groups.data?.filter((group) => group.status === 'ACTIVE').map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select>{errors.groupId && <small>{errors.groupId.message}</small>}</label>}
      </div>
      <p className="field-note">Your record appears in your own Explore. Choose a trusted group to share it with active group members too.</p>
      <label>Notes<textarea rows={4} maxLength={4_000} {...register('comment')} />{errors.comment && <small>{errors.comment.message}</small>}</label>
      <section className="media-upload-field" aria-labelledby="record-photo-title">
        <div className="media-upload-copy"><span><ImagePlus /></span><div><p className="eyebrow">Optional photo</p><h2 id="record-photo-title">Add one secure image</h2><p>JPEG, PNG, WebP, HEIC, and other browser-decodable images · up to 5 MB after conversion. Other formats are converted to JPEG before upload.</p></div></div>
        {photoPreview ? <div className="media-preview"><img src={photoPreview} alt="Selected record upload preview" referrerPolicy="no-referrer" /><div><strong>{photo?.name}</strong><small>{photo ? `${(photo.blob.size / 1024 / 1024).toFixed(2)} MB` : ''}</small><button className="text-button danger-link" type="button" onClick={() => void choosePhoto()}><X size={15} /> Remove selection</button></div></div> : <label className="media-drop-control"><ImagePlus size={21} /><span><strong>{record?.mediaAssetId ? 'Replace the stored image' : 'Choose an image'}</strong><small>The file is converted to JPEG when needed, then uploaded only when you save the record.</small></span><input type="file" accept="image/*,.heic,.heif" onChange={(event) => void choosePhoto(event.target.files?.[0])} /></label>}
        {record?.imageUrl && !photo && <div className="media-preview"><SafeImage src={record.imageUrl} alt="Current stored record image" fallback={<span className="media-image-fallback"><Image size={22} /><small>Image unavailable</small></span>} /><div><strong>Current verified image</strong><small>The read link is temporary and refreshed with this record.</small></div></div>}
        {record?.mediaAssetId && !photo && !record.imageUrl && <p className="media-existing"><ShieldCheck size={16} /> A verified image is attached, but it is not currently available to display.</p>}
        {photoError && <div className="inline-error" role="alert">{photoError}</div>}
        <p className="field-note">Saved images are private and displayed with short-lived authorised links.</p>
      </section>
      <p className="field-note">Optional fields cannot be explicitly cleared yet; the backend currently treats omitted and null values as unchanged on edits.</p>
      <div className="form-actions"><Link className="secondary-action" to={recordId ? `/records/${type}/${recordId}` : fromRecommendation ? `/recommendations/${sessionId}` : '/history'}>Cancel</Link><button className="primary-action" type="submit" disabled={isSubmitting || uploadingPhoto}>{uploadingPhoto ? 'Securing image…' : isSubmitting ? 'Saving…' : recordId ? 'Save changes' : fromRecommendation ? 'Post meal to Explore' : 'Add to history'} <Check size={17} /></button></div>
    </form>
  )
}

export function RecordComposerPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') === 'drink' ? 'drink' : 'food'
  const fromRecommendation = type === 'food' && Boolean(searchParams.get('sessionId') && searchParams.get('candidateId'))
  return <div className="page section-page narrow-page"><header className="section-page-heading"><div><p className="eyebrow">{fromRecommendation ? 'Accepted recommendation' : 'A signal you control'}</p><h1>{fromRecommendation ? 'Record what you ate' : 'Record a meal or drink'}</h1><p>{fromRecommendation ? 'Confirm the suggested details, add your experience, and choose who can see it in Explore.' : 'Keep the details that will be useful later, with an optional backend-verified photo.'}</p></div></header><RecordForm type={type} /></div>
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
  const [confirmingMedia, setConfirmingMedia] = useState(false)
  const [mediaDeleted, setMediaDeleted] = useState(false)
  const record = useRecord(recordType, id)
  const type: RecordType = recordType === 'drink' ? 'drink' : 'food'
  const remove = useMutation({
    mutationFn: async () => type === 'food'
      ? dataOrThrow<void>(await api.DELETE('/food-records/{id}', { params: { path: { id } } }))
      : dataOrThrow<void>(await api.DELETE('/drink-records/{id}', { params: { path: { id } } })),
    onSuccess: () => { queryClient.removeQueries({ queryKey: queryKeys.records.detail(type, id) }); void queryClient.invalidateQueries({ queryKey: ['records'] }); void queryClient.invalidateQueries({ queryKey: ['analytics'] }); void queryClient.invalidateQueries({ queryKey: ['groups'] }); void queryClient.invalidateQueries({ queryKey: ['explore'] }); void queryClient.invalidateQueries({ queryKey: ['search'] }); showToast('Record removed.'); navigate('/history') },
  })
  const removeMedia = useMutation({
    mutationFn: async (mediaAssetId: string) => deleteRecordMedia(mediaAssetId),
    onSuccess: () => { setMediaDeleted(true); setConfirmingMedia(false); showToast('Stored image deleted. The record itself is unchanged.') },
  })
  if (record.isLoading) return <div className="page"><LoadingState label="Opening this record…" /></div>
  if (record.isError) return <div className="page"><ErrorState error={record.error} onRetry={() => void record.refetch()} /></div>
  const data = record.data!
  const title = 'mealNameSnapshot' in data ? data.mealNameSnapshot : data.drinkName
  const place = 'mealNameSnapshot' in data ? data.placeNameSnapshot : data.shopNameSnapshot
  const repeat = 'mealNameSnapshot' in data ? data.wouldEatAgain : data.wouldBuyAgain
  return (
    <div className="page section-page narrow-page">
      <Link className="back-link" to="/history"><ArrowLeft size={16} /> History</Link>
      <header className="record-hero">
        <span className={`record-hero-icon ${type}`}>{type === 'food' ? <Utensils /> : <Coffee />}</span>
        <div><p className="eyebrow">{sentenceCase(type)} · {sentenceCase(data.visibility)}</p><h1>{title}</h1><p>{place || 'No place recorded'} · {formatDateTime(data.occurredAt)}</p></div>
      </header>
      <section className="detail-card">
        <dl className="detail-grid">
          <div><dt>Rating</dt><dd>{data.rating ? `${data.rating} / 5` : 'Not rated'}</dd></div>
          <div><dt>Price</dt><dd>{formatMoney(data.price?.amount, data.price?.currency)}</dd></div>
          <div><dt>{type === 'food' ? 'Would eat again' : 'Would buy again'}</dt><dd>{repeat === null || repeat === undefined ? 'Not answered' : repeat ? 'Yes' : 'No'}</dd></div>
          <div><dt>Last updated</dt><dd>{formatDateTime(data.updatedAt)}</dd></div>
        </dl>
        {data.comment && <div className="note-block"><p className="eyebrow">Your note</p><p>{data.comment}</p></div>}
        {data.mediaAssetId && !mediaDeleted && (
          <section className="stored-media-card">
            <SafeImage
              src={data.imageUrl}
              alt={`Uploaded image for ${title}`}
              loading="eager"
              className="stored-media-image"
              fallback={<span className="stored-media-fallback"><Image size={24} /><small>Image unavailable</small></span>}
            />
            <div><p className="eyebrow">Image attachment</p><h2>Verified record image</h2><p>The private image is loaded through a short-lived authorised link.</p></div>
            <button className="secondary-action danger" type="button" onClick={() => setConfirmingMedia(true)}><Trash2 size={16} /> Delete image</button>
          </section>
        )}
        {mediaDeleted && <p className="media-existing"><Check size={16} /> The stored image asset has been deleted.</p>}
        {confirmingMedia && data.mediaAssetId && <div className="confirm-panel" role="alert" aria-labelledby="delete-media-title"><h2 id="delete-media-title">Delete the stored image?</h2><p>This removes the backend media asset. The meal or drink record will remain.</p>{removeMedia.isError && <p className="inline-error">{errorMessage(removeMedia.error)}</p>}<div className="form-actions"><button className="secondary-action" type="button" onClick={() => setConfirmingMedia(false)}>Keep image</button><button className="primary-action danger" type="button" disabled={removeMedia.isPending} onClick={() => removeMedia.mutate(data.mediaAssetId!)}>Delete image</button></div></div>}
        <div className="form-actions"><Link className="primary-action" to={`/records/${type}/${id}/edit`}><Edit3 size={17} /> Edit if you own it</Link><button className="secondary-action danger" type="button" onClick={() => setConfirming(true)}><Trash2 size={17} /> Delete</button></div>
        {confirming && <div className="confirm-panel" role="alert" aria-labelledby="delete-title"><h2 id="delete-title">Delete this record?</h2><p>This removes it from normal history views and cannot be undone from the web app.{data.mediaAssetId && !mediaDeleted ? ' Delete its stored image separately first if you no longer want that asset retained.' : ''}</p>{remove.isError && <p className="inline-error">{errorMessage(remove.error)}</p>}<div className="form-actions"><button className="secondary-action" type="button" onClick={() => setConfirming(false)}>Keep record</button><button className="primary-action danger" type="button" disabled={remove.isPending} onClick={() => remove.mutate()}>Delete record</button></div></div>}
      </section>
    </div>
  )
}

export function RecordEditorPage() {
  const { recordType = 'food', id = '' } = useParams()
  const type: RecordType = recordType === 'drink' ? 'drink' : 'food'
  const record = useRecord(type, id)
  if (record.isLoading) return <div className="page"><LoadingState label="Preparing the latest record…" /></div>
  if (record.isError) return <div className="page"><ErrorState error={record.error} onRetry={() => void record.refetch()} /></div>
  return <div className="page section-page narrow-page"><header className="section-page-heading"><div><p className="eyebrow">Version {record.data?.version}</p><h1>Edit record</h1><p>If this record changed elsewhere, FoodMind will preserve your draft and ask you to reload.</p></div></header><RecordForm type={type} record={record.data} recordId={id} /></div>
}
