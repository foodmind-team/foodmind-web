import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Bookmark, Compass, ExternalLink, Heart, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { SavedSectionTabs } from '../components/saved/SavedSectionTabs'
import { useToast } from '../components/feedback/ToastProvider'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { formatDateTime, sentenceCase } from '../lib/format'

type ExploreItem = Schema<'ExploreResultResponse'>
type SearchItem = Schema<'SearchResultResponse'>

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])
  return debounced
}

function destinationFor(type: string, id: string) {
  if (type === 'GROUP_RECORD' || type === 'FOOD_RECORD') return `/records/food/${id}`
  if (type === 'CURATED_PRODUCT' || type === 'FOOD_PRODUCT') return `/catalogue/product/${id}`
  return `/catalogue/place/${id}`
}

function saveType(type: ExploreItem['sourceType']): Schema<'WantToTrySourceType'> {
  if (type === 'GROUP_RECORD') return 'FOOD_RECORD'
  if (type === 'CURATED_PRODUCT') return 'FOOD_PRODUCT'
  return 'PLACE'
}

function toneFor(id: string) {
  return ['dumpling', 'cafe', 'table', 'pantry'][[...id].reduce((total, character) => total + character.charCodeAt(0), 0) % 4]
}

function imageSource(reference?: string | null) {
  if (!reference) return null
  return /^(https?:\/\/|\/|data:image\/|blob:)/i.test(reference) ? reference : null
}

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearch = searchParams.get('q') || ''
  const [query, setQuery] = useState(initialSearch)
  const debouncedQuery = useDebounced(query.trim(), 350)
  const type = searchParams.get('type') || ''
  const topic = searchParams.get('topic') || ''
  const apiType = type === 'records' ? 'FOOD_RECORD' : type === 'products' ? 'FOOD_PRODUCT' : type === 'places' ? 'PLACE' : undefined
  const filters = useMemo(() => ({ types: apiType, topics: topic || undefined }), [apiType, topic])
  const explore = useInfiniteQuery({
    queryKey: queryKeys.explore.feed(filters), initialPageParam: undefined as string | undefined, enabled: debouncedQuery.length < 2,
    queryFn: async ({ pageParam }) => dataOrThrow<Schema<'ExplorePageResponse'>>(await api.GET('/explore', { params: { query: { ...filters, after: pageParam, page: 0, size: 18 } } })),
    getNextPageParam: (page) => page.nextCursor || undefined,
  })
  const search = useInfiniteQuery({
    queryKey: queryKeys.explore.search({ q: debouncedQuery, types: apiType }), initialPageParam: undefined as string | undefined, enabled: debouncedQuery.length >= 2,
    queryFn: async ({ pageParam }) => dataOrThrow<Schema<'SearchPageResponse'>>(await api.GET('/search', { params: { query: { q: debouncedQuery, types: apiType, after: pageParam, page: 0, size: 18 } } })),
    getNextPageParam: (page) => page.nextCursor || undefined,
  })
  const isSearching = debouncedQuery.length >= 2
  const items: Array<ExploreItem | SearchItem> = isSearching
    ? search.data?.pages.flatMap((page) => page.items) || []
    : explore.data?.pages.flatMap((page) => page.items) || []
  const isLoading = isSearching ? search.isLoading : explore.isLoading
  const isError = isSearching ? search.isError : explore.isError
  const error = isSearching ? search.error : explore.error
  const isSuccess = isSearching ? search.isSuccess : explore.isSuccess
  const hasNextPage = isSearching ? search.hasNextPage : explore.hasNextPage
  const isFetchingNextPage = isSearching ? search.isFetchingNextPage : explore.isFetchingNextPage
  const selectedKey = searchParams.get('view')
  const selectedItem = items.find((item) => `${item.sourceType}:${item.sourceId}` === selectedKey)
  const retry = () => isSearching ? search.refetch() : explore.refetch()
  const loadMore = () => isSearching ? search.fetchNextPage() : explore.fetchNextPage()
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }
  const changeQuery = (value: string) => { setQuery(value); setFilter('q', value) }
  const openPreview = (item: ExploreItem | SearchItem) => setFilter('view', `${item.sourceType}:${item.sourceId}`)
  const closePreview = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('view')
      return next
    }, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    if (!selectedItem) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePreview()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [closePreview, selectedItem])

  return (
    <div className="page section-page explore-page">
      <header className="explore-feed-heading"><div><p className="eyebrow">Authorised discovery</p><h1>Explore</h1></div><p>Meals, places, and products shared by your circles and the curated FoodMind catalogue.</p></header>
      <section className="explore-controls" aria-label="Explore controls">
        <label className="explore-search"><Search size={18} /><span className="sr-only">Search authorised FoodMind content</span><input autoFocus={searchParams.get('search') === 'true'} value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="Search places, meals, or products" />{query && <button type="button" onClick={() => changeQuery('')} aria-label="Clear search">Clear</button>}</label>
        <div className="explore-channel-row">
          <div className="topic-row" aria-label="Explore source filters">{[['', 'For you'], ['records', 'Group records'], ['products', 'Products'], ['places', 'Places']].map(([value, label]) => <button className={type === value ? 'active' : ''} type="button" onClick={() => setFilter('type', value)} key={label}>{label}</button>)}</div>
          <div className="topic-row secondary-topics" aria-label="Explore topic filters">{['', 'Quick dinner', 'Group-tested', 'Cooking', 'Cafés'].map((value) => <button className={topic === value ? 'active' : ''} type="button" onClick={() => setFilter('topic', value)} key={value || 'all'}>{value || 'All topics'}</button>)}</div>
          <div className="permission-note"><ShieldCheck size={16} /><span>Only content you are authorised to see</span></div>
        </div>
      </section>
      {isLoading && <LoadingState label={debouncedQuery ? 'Searching FoodMind…' : 'Gathering authorised ideas…'} />}
      {isError && <ErrorState error={error} onRetry={() => void retry()} />}
      {isSuccess && items.length === 0 && <EmptyState title={debouncedQuery ? 'No authorised matches' : 'Nothing to explore yet'} message={debouncedQuery ? 'Try a broader search or another source filter.' : 'Group-visible records and active curated content will appear here.'} />}
      <section className="post-grid">{items.map((item) => <DiscoveryCard item={item} onOpen={() => openPreview(item)} key={`${item.sourceType}-${item.sourceId}`} />)}</section>
      {hasNextPage && <button className="secondary-action load-more" type="button" disabled={isFetchingNextPage} onClick={() => void loadMore()}>{isFetchingNextPage ? 'Loading…' : 'Load more ideas'}</button>}
      {selectedItem && <DiscoveryPreview item={selectedItem} onClose={closePreview} />}
    </div>
  )
}

function SaveDiscoveryButton({ item, className = '' }: { item: ExploreItem | SearchItem; className?: string }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const isExplore = item.sourceType === 'GROUP_RECORD' || item.sourceType === 'CURATED_PRODUCT' || item.sourceType === 'CURATED_PLACE'
  const save = useMutation({
    mutationFn: async () => dataOrThrow(await api.POST('/want-to-try', { body: { sourceType: isExplore ? saveType(item.sourceType as ExploreItem['sourceType']) : item.sourceType as Schema<'WantToTrySourceType'>, sourceId: item.sourceId } })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['saved'] }); showToast('Added to Want to Try.') },
  })
  return <><button className={className} type="button" disabled={save.isPending} onClick={() => save.mutate()} aria-label={`Save ${item.title}`}><Heart size={16} /><span>{save.isPending ? 'Saving' : 'Save'}</span></button>{save.isError && <small className="inline-error">{errorMessage(save.error)}</small>}</>
}

function DiscoveryCard({ item, onOpen }: { item: ExploreItem | SearchItem; onOpen: () => void }) {
  const destination = destinationFor(item.sourceType, item.sourceId)
  const sourceLabel = sentenceCase(item.sourceType)
  const image = imageSource(item.imageReference)
  return <article className="post-card">
    <button className={`post-visual ${toneFor(item.sourceId)}`} type="button" onClick={onOpen} aria-label={`Preview ${item.title}`}>
      {image ? <img src={image} alt="" /> : <><span className="post-shape shape-a" /><span className="post-shape shape-b" /><span className="post-shape shape-c" /></>}
      <span className="post-tag">{sourceLabel}</span>
    </button>
    <div className="post-copy">
      <p className="eyebrow">{item.occurredAt ? formatDateTime(item.occurredAt) : sentenceCase(item.visibility)}</p>
      <button className="post-title-button" type="button" onClick={onOpen}><h2>{item.title}</h2></button>
      {(item.subtitle || item.snippet) && <p className="post-snippet">{item.subtitle || item.snippet}</p>}
      <div className="post-meta">
        <Link className="post-author" to={destination}><span>{sourceLabel.slice(0, 1)}</span>{sourceLabel}<ArrowRight size={13} /></Link>
        <SaveDiscoveryButton item={item} />
      </div>
    </div>
  </article>
}

function DiscoveryPreview({ item, onClose }: { item: ExploreItem | SearchItem; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const destination = destinationFor(item.sourceType, item.sourceId)
  const sourceLabel = sentenceCase(item.sourceType)
  const image = imageSource(item.imageReference)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    return () => { if (dialog.open && typeof dialog.close === 'function') dialog.close() }
  }, [])
  return <dialog ref={dialogRef} className="discovery-overlay" aria-labelledby="discovery-dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="discovery-dialog">
      <button className="discovery-close" type="button" aria-label="Close preview" autoFocus onClick={onClose}><X size={21} /></button>
      <div className={`discovery-dialog-visual ${toneFor(item.sourceId)}`}>
        {image ? <img src={image} alt="" /> : <><span className="post-shape shape-a" /><span className="post-shape shape-b" /><span className="post-shape shape-c" /><span className="discovery-visual-label">{sourceLabel}</span></>}
      </div>
      <div className="discovery-dialog-copy">
        <div className="discovery-source"><span>{sourceLabel.slice(0, 1)}</span><div><strong>{sourceLabel}</strong><small>{sentenceCase(item.visibility)} source</small></div></div>
        <div className="discovery-dialog-body"><p className="eyebrow">{item.occurredAt ? formatDateTime(item.occurredAt) : 'FoodMind catalogue'}</p><h2 id="discovery-dialog-title">{item.title}</h2>{item.subtitle && <p className="discovery-subtitle">{item.subtitle}</p>}{item.snippet && <p className="discovery-snippet">{item.snippet}</p>}<div className="permission-note"><ShieldCheck size={16} /><span>Availability and permissions are rechecked when you open the source.</span></div></div>
        <div className="discovery-dialog-actions"><SaveDiscoveryButton item={item} className="secondary-action" /><Link className="primary-action" to={destination}>Open full details <ExternalLink size={16} /></Link></div>
      </div>
    </section>
  </dialog>
}

export function SavedPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(0, Number(searchParams.get('page') || 0))
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const saved = useQuery({ queryKey: queryKeys.saved.list(page), queryFn: async () => dataOrThrow<Schema<'WantToTryPageResponse'>>(await api.GET('/want-to-try', { params: { query: { page, size: 24 } } })) })
  const savedItems = (saved.data?.items || []) as Schema<'WantToTryResponse'>[]
  const remove = useMutation({
    mutationFn: async (id: string) => dataOrThrow<void>(await api.DELETE('/want-to-try/{id}', { params: { path: { id } } })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['saved'] }); showToast('Removed from Want to Try.') },
  })
  return (
    <div className="page section-page">
      <header className="section-page-heading"><div><p className="eyebrow">Want to Try</p><h1>Saved for the right moment.</h1><p>Your backend-owned shortlist of meals, places, products, and trusted records.</p></div><Link className="primary-action" to="/explore"><Compass size={17} /> Explore ideas</Link></header>
      <SavedSectionTabs />
      {saved.isLoading && <LoadingState label="Opening your shortlist…" />}
      {saved.isError && <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />}
      {saved.isSuccess && !savedItems.length && <EmptyState title="Your shortlist is open" message="Save an authorised idea from Explore or a recommendation and it will stay here." action={<Link className="primary-action" to="/explore">Explore ideas</Link>} />}
      <section className="saved-grid">{savedItems.map((item) => <article className={`saved-card ${!item.sourceAvailable ? 'unavailable' : ''}`} key={item.id}><div className={`saved-visual ${toneFor(item.sourceId)}`}><Bookmark /></div><div><p className="eyebrow">{sentenceCase(item.sourceType)} · {formatDateTime(item.createdAt)}</p><h2>{item.sourceAvailable ? item.source?.title || 'Saved item' : 'Source unavailable'}</h2><p>{item.sourceAvailable ? item.source?.snippet || item.note || 'Ready for a future FoodMind decision.' : 'This row remains in your shortlist, but its live source is no longer available to you.'}</p><div className="card-actions">{item.sourceAvailable && <Link className="text-button" to={destinationFor(item.sourceType, item.sourceId)}>Open <ArrowRight size={15} /></Link>}<button className="icon-button" type="button" disabled={remove.isPending} aria-label={`Remove ${item.source?.title || 'saved item'}`} onClick={() => remove.mutate(item.id)}><Trash2 size={17} /></button></div></div></article>)}</section>
      {remove.isError && <div className="soft-warning" role="alert">{errorMessage(remove.error)}</div>}
      {saved.data && saved.data.totalPages > 1 && <nav className="pagination" aria-label="Saved pages"><button type="button" disabled={page === 0} onClick={() => setSearchParams({ page: String(page - 1) })}>Previous</button><span>Page {page + 1} of {saved.data.totalPages}</span><button type="button" disabled={!saved.data.hasNext} onClick={() => setSearchParams({ page: String(page + 1) })}>Next</button></nav>}
    </div>
  )
}
