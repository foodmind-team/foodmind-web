import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bookmark, MapPin, Package, ShieldCheck, Utensils } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { api, dataOrThrow, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { formatDateTime, formatMoney, sentenceCase } from '../lib/format'

type CatalogueData = Schema<'CatalogueMealResponse'> | Schema<'CataloguePlaceResponse'> | Schema<'CatalogueProductResponse'>

export function CatalogueDetailPage() {
  const { sourceType = 'place', sourceId = '' } = useParams()
  const type = sourceType === 'meal' ? 'meal' : sourceType === 'product' ? 'product' : 'place'
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const detail = useQuery({
    queryKey: queryKeys.catalogue.detail(type, sourceId),
    queryFn: async (): Promise<CatalogueData> => {
      if (type === 'meal') return dataOrThrow<Schema<'CatalogueMealResponse'>>(await api.GET('/catalogue/meals/{id}', { params: { path: { id: sourceId } } }))
      if (type === 'product') return dataOrThrow<Schema<'CatalogueProductResponse'>>(await api.GET('/catalogue/products/{id}', { params: { path: { id: sourceId } } }))
      return dataOrThrow<Schema<'CataloguePlaceResponse'>>(await api.GET('/catalogue/places/{id}', { params: { path: { id: sourceId } } }))
    },
  })
  const save = useMutation({
    mutationFn: async () => dataOrThrow(await api.POST('/want-to-try', { body: { sourceType: type === 'meal' ? 'MEAL' : type === 'product' ? 'FOOD_PRODUCT' : 'PLACE', sourceId } })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['saved'] }); showToast('Added to Want to Try.') },
  })
  if (detail.isLoading) return <div className="page"><LoadingState label="Opening catalogue details…" /></div>
  if (detail.isError) return <div className="page"><ErrorState error={detail.error} onRetry={() => void detail.refetch()} /></div>
  const data = detail.data!
  if (type === 'place') return <PlaceDetail data={data as Schema<'CataloguePlaceResponse'>} onSave={() => save.mutate()} saving={save.isPending} />
  if (type === 'meal') return <MealDetail data={data as Schema<'CatalogueMealResponse'>} onSave={() => save.mutate()} saving={save.isPending} />
  return <ProductDetail data={data as Schema<'CatalogueProductResponse'>} onSave={() => save.mutate()} saving={save.isPending} />
}

function DetailHeader({ icon, eyebrow, title, support, onSave, saving }: { icon: React.ReactNode; eyebrow: string; title: string; support: string; onSave: () => void; saving: boolean }) {
  return <><Link className="back-link" to="/explore"><ArrowLeft size={16} /> Explore</Link><header className="catalogue-hero"><span>{icon}</span><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{support}</p></div><button className="primary-action" type="button" onClick={onSave} disabled={saving}><Bookmark size={17} /> Save</button></header></>
}

function PlaceDetail({ data, onSave, saving }: { data: Schema<'CataloguePlaceResponse'>; onSave: () => void; saving: boolean }) {
  return <div className="page section-page"><DetailHeader icon={<MapPin />} eyebrow={sentenceCase(data.placeType)} title={data.name} support={`${data.area}${data.addressText ? ` · ${data.addressText}` : ''}`} onSave={onSave} saving={saving} /><div className="catalogue-grid"><section className="detail-card"><p className="eyebrow">Available offerings</p><h2>What FoodMind can reference</h2>{data.offerings.map((offering) => <Link className="offering-row" to={`/catalogue/meal/${offering.mealId}`} key={offering.id}><div><strong>{offering.displayName}</strong><small>{offering.cuisineCode} · {offering.mealType}</small></div><span>{formatMoney(offering.price?.amount, offering.price?.currency)}</span></Link>)}</section><section className="detail-card evidence-card"><p className="eyebrow">Decision-support observations</p><h2>Available evidence, with limits</h2><div className="permission-note"><ShieldCheck size={17} /><span>FoodMind does not inspect kitchens, certify restaurants, or guarantee safety.</span></div>{data.observations.length ? data.observations.map((observation) => <article key={observation.id}><strong>{sentenceCase(observation.observationType)} · {(observation.score * 100).toFixed(0)}%</strong><p>{observation.note || 'No note provided.'}</p><small>{observation.sourceKind} · {formatDateTime(observation.observedAt)}</small></article>) : <p>No observations are available.</p>}</section></div></div>
}

function MealDetail({ data, onSave, saving }: { data: Schema<'CatalogueMealResponse'>; onSave: () => void; saving: boolean }) {
  return <div className="page section-page"><DetailHeader icon={<Utensils />} eyebrow={`${data.cuisine.name} · ${sentenceCase(data.mealType)}`} title={data.name} support={data.description || 'Controlled FoodMind catalogue meal.'} onSave={onSave} saving={saving} /><div className="catalogue-grid"><section className="detail-card"><p className="eyebrow">Dietary context</p><h2>Known catalogue classifications</h2><div className="taste-tags">{data.dietaryTagCodes.map((tag) => <span key={tag}>{sentenceCase(tag)}</span>)}</div><h3>Known allergens</h3><div className="taste-tags danger-tags">{data.allergenCodes.length ? data.allergenCodes.map((tag) => <span key={tag}>{sentenceCase(tag)}</span>) : <span>None recorded</span>}</div></section><section className="detail-card"><p className="eyebrow">Where it is offered</p><h2>Active place offerings</h2>{data.offerings.map((offering) => offering.place ? <Link className="offering-row" to={`/catalogue/place/${offering.place.id}`} key={offering.id}><div><strong>{offering.displayName}</strong><small>{offering.place.name} · {offering.availabilityNote || 'Availability note not provided'}</small></div><span>{formatMoney(offering.price?.amount, offering.price?.currency)}</span></Link> : <div className="offering-row" key={offering.id}><div><strong>{offering.displayName}</strong><small>Place details unavailable</small></div><span>{formatMoney(offering.price?.amount, offering.price?.currency)}</span></div>)}</section></div></div>
}

function ProductDetail({ data, onSave, saving }: { data: Schema<'CatalogueProductResponse'>; onSave: () => void; saving: boolean }) {
  return <div className="page section-page"><DetailHeader icon={<Package />} eyebrow={data.brand || 'Curated product'} title={data.name} support={data.description || 'Controlled FoodMind catalogue product.'} onSave={onSave} saving={saving} /><div className="catalogue-grid"><section className="detail-card"><p className="eyebrow">Product details</p><h2>{formatMoney(data.price?.amount, data.price?.currency)}</h2><p>{data.place?.name ? `Available from ${data.place.name} in ${data.place.area}` : 'Place not specified.'}</p></section><section className="detail-card"><p className="eyebrow">Known classifications</p><h2>Dietary and allergen context</h2><div className="taste-tags">{data.dietaryTagCodes.map((tag) => <span key={tag}>{sentenceCase(tag)}</span>)}</div><div className="taste-tags danger-tags">{data.allergenCodes.map((tag) => <span key={tag}>{sentenceCase(tag)}</span>)}</div></section></div></div>
}
