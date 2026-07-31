import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Bookmark, Compass, Heart, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
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
  const retry = () => isSearching ? search.refetch() : explore.refetch()
  const loadMore = () => isSearching ? search.fetchNextPage() : explore.fetchNextPage()
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }
  const changeQuery = (value: string) => { setQuery(value); setFilter('q', value) }

  return (
    <div className="page section-page">
      <header className="section-page-heading explore-heading"><div><p className="eyebrow">Authorised discovery</p><h1>Explore what your circles and FoodMind know.</h1><p>Trusted group records and curated catalogue ideas—never a public follower feed.</p></div><label className="explore-search"><Search size={18} /><span className="sr-only">Search authorised FoodMind content</span><input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="Search places, meals, or products" /></label></header>
      <div className="permission-note"><ShieldCheck size={17} /><span>Every result is re-authorised when it loads. Removed access becomes unavailable, not cached content.</span></div>
      <div className="topic-row" aria-label="Explore source filters">{[['', 'For you'], ['records', 'Group records'], ['products', 'Curated products'], ['places', 'Curated places']].map(([value, label]) => <button className={type === value ? 'active' : ''} type="button" onClick={() => setFilter('type', value)} key={label}>{label}</button>)}</div>
      <div className="topic-row secondary-topics" aria-label="Explore topic filters">{['', 'Quick dinner', 'Group-tested', 'Cooking', 'Cafés'].map((value) => <button className={topic === value ? 'active' : ''} type="button" onClick={() => setFilter('topic', value)} key={value || 'all'}>{value || 'All topics'}</button>)}</div>
      {isLoading && <LoadingState label={debouncedQuery ? 'Searching FoodMind…' : 'Gathering authorised ideas…'} />}
      {isError && <ErrorState error={error} onRetry={() => void retry()} />}
      {isSuccess && items.length === 0 && <EmptyState title={debouncedQuery ? 'No authorised matches' : 'Nothing to explore yet'} message={debouncedQuery ? 'Try a broader search or another source filter.' : 'Group-visible records and active curated content will appear here.'} />}
      <section className="post-grid">{items.map((item) => <DiscoveryCard item={item} key={`${item.sourceType}-${item.sourceId}`} />)}</section>
      {hasNextPage && <button className="secondary-action load-more" type="button" disabled={isFetchingNextPage} onClick={() => void loadMore()}>{isFetchingNextPage ? 'Loading…' : 'Load more ideas'}</button>}
    </div>
  )
}

function DiscoveryCard({ item }: { item: ExploreItem | SearchItem }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const isExplore = item.sourceType === 'GROUP_RECORD' || item.sourceType === 'CURATED_PRODUCT' || item.sourceType === 'CURATED_PLACE'
  const save = useMutation({
    mutationFn: async () => dataOrThrow(await api.POST('/want-to-try', { body: { sourceType: isExplore ? saveType(item.sourceType as ExploreItem['sourceType']) : item.sourceType as Schema<'WantToTrySourceType'>, sourceId: item.sourceId } })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['saved'] }); showToast('Added to Want to Try.') },
  })
  return <article className="post-card"><Link className={`post-visual ${toneFor(item.sourceId)}`} to={destinationFor(item.sourceType, item.sourceId)} aria-label={`Open ${item.title}`}><span className="post-tag">{sentenceCase(item.sourceType)}</span><span className="post-shape shape-a" /><span className="post-shape shape-b" /><span className="post-shape shape-c" /></Link><div className="post-copy"><p className="eyebrow">{sentenceCase(item.visibility)}{item.occurredAt ? ` · ${formatDateTime(item.occurredAt)}` : ''}</p><h2>{item.title}</h2>{item.subtitle && <p>{item.subtitle}</p>}{item.snippet && <p className="post-snippet">{item.snippet}</p>}<div className="post-meta"><Link to={destinationFor(item.sourceType, item.sourceId)}>View details <ArrowRight size={14} /></Link><button type="button" disabled={save.isPending} onClick={() => save.mutate()} aria-label={`Save ${item.title}`}><Heart size={15} /> Save</button></div>{save.isError && <small className="inline-error">{errorMessage(save.error)}</small>}</div></article>
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
      {saved.isLoading && <LoadingState label="Opening your shortlist…" />}
      {saved.isError && <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />}
      {saved.isSuccess && !savedItems.length && <EmptyState title="Your shortlist is open" message="Save an authorised idea from Explore or a recommendation and it will stay here." action={<Link className="primary-action" to="/explore">Explore ideas</Link>} />}
      <section className="saved-grid">{savedItems.map((item) => <article className={`saved-card ${!item.sourceAvailable ? 'unavailable' : ''}`} key={item.id}><div className={`saved-visual ${toneFor(item.sourceId)}`}><Bookmark /></div><div><p className="eyebrow">{sentenceCase(item.sourceType)} · {formatDateTime(item.createdAt)}</p><h2>{item.sourceAvailable ? item.source?.title || 'Saved item' : 'Source unavailable'}</h2><p>{item.sourceAvailable ? item.source?.snippet || item.note || 'Ready for a future FoodMind decision.' : 'This row remains in your shortlist, but its live source is no longer available to you.'}</p><div className="card-actions">{item.sourceAvailable && <Link className="text-button" to={destinationFor(item.sourceType, item.sourceId)}>Open <ArrowRight size={15} /></Link>}<button className="icon-button" type="button" disabled={remove.isPending} aria-label={`Remove ${item.source?.title || 'saved item'}`} onClick={() => remove.mutate(item.id)}><Trash2 size={17} /></button></div></div></article>)}</section>
      {remove.isError && <div className="soft-warning" role="alert">{errorMessage(remove.error)}</div>}
      {saved.data && saved.data.totalPages > 1 && <nav className="pagination" aria-label="Saved pages"><button type="button" disabled={page === 0} onClick={() => setSearchParams({ page: String(page - 1) })}>Previous</button><span>Page {page + 1} of {saved.data.totalPages}</span><button type="button" disabled={!saved.data.hasNext} onClick={() => setSearchParams({ page: String(page + 1) })}>Next</button></nav>}
    </div>
  )
}
