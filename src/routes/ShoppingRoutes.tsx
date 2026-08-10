import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, ListChecks, PackageCheck, Save, ShoppingBasket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'

export function ShoppingListIndexPage() {
  const lists = useQuery({
    queryKey: queryKeys.shopping.list(),
    queryFn: async () => dataOrThrow<Schema<'ShoppingListPageResponse'>>(await api.GET('/shopping-lists', { params: { query: { page: 0, size: 100 } } })),
  })
  return (
    <div className="page section-page shopping-index-page">
      <header className="section-page-heading"><div><p className="eyebrow">Persisted shopping</p><h1>Your shopping lists.</h1><p>Open lists stay exactly where you left them when you pocket your phone or reopen the app.</p></div><Link className="secondary-action" to="/inventory">View inventory</Link></header>
      {lists.isLoading && <LoadingState label="Loading shopping lists…" />}
      {lists.isError && <ErrorState error={lists.error} onRetry={() => void lists.refetch()} />}
      {lists.isSuccess && !lists.data.items?.length && <EmptyState title="No shopping lists yet" message="Generate a Cooking Plan with missing inventory to create one." action={<Link className="primary-action" to="/cooking">Choose recipes</Link>} />}
      <section className="shopping-list-grid">{((lists.data?.items || []) as Schema<'ShoppingListResponse'>[]).map((list) => <Link className="shopping-list-card" to={`/shopping-lists/${list.shoppingListId}`} key={list.shoppingListId}><span><ShoppingBasket size={22} /></span><div><p className="eyebrow">{list.status} · original {list.originalServings} servings</p><h2>{list.checkedItemCount} of {list.totalItemCount} purchased</h2><small>Updated {new Date(list.updatedAt).toLocaleString('en-SG')}</small></div><ArrowRight size={18} /></Link>)}</section>
    </div>
  )
}

export function ShoppingListDetailPage() {
  const { shoppingListId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const list = useQuery({
    queryKey: queryKeys.shopping.detail(shoppingListId),
    queryFn: async () => dataOrThrow<Schema<'ShoppingListResponse'>>(await api.GET('/shopping-lists/{shoppingListId}', { params: { path: { shoppingListId } } })),
  })
  const complete = useMutation({
    mutationFn: async () => dataOrThrow(await api.POST('/shopping-lists/{shoppingListId}/complete', { params: { path: { shoppingListId }, header: { 'Idempotency-Key': crypto.randomUUID() } } })),
    onSuccess: (plan) => {
      queryClient.setQueryData(queryKeys.cooking.detail(plan.planId), plan.status === 'PROCESSING' ? { planId: plan.planId, status: 'PROCESSING' as const } : plan)
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopping.list() })
      showToast('Purchases added to inventory. Revalidating the original servings.')
      navigate(`/cooking/${plan.planId}`)
    },
  })

  if (list.isLoading) return <div className="page"><LoadingState label="Opening shopping list…" /></div>
  if (list.isError) return <div className="page"><ErrorState error={list.error} onRetry={() => void list.refetch()} /></div>
  const data = list.data!
  const allChecked = data.totalItemCount > 0 && data.checkedItemCount === data.totalItemCount
  return (
    <div className="page section-page shopping-detail-page">
      <Link className="back-link" to="/shopping-lists"><ArrowLeft size={16} /> Shopping lists</Link>
      <header className="section-page-heading"><div><p className="eyebrow">{data.status} · {data.checkedItemCount}/{data.totalItemCount} purchased</p><h1>Buy ingredients for <span className="shopping-serving-count">{data.originalServings} servings.</span></h1><p>Quantities are based on the original Cooking Plan request. Check every item, then FoodMind writes real inventory and revalidates before generating.</p></div><span className="cooking-mark"><ListChecks /></span></header>
      <div className="shopping-progress" role="progressbar" aria-label="Purchased items" aria-valuemin={0} aria-valuemax={data.totalItemCount} aria-valuenow={data.checkedItemCount}><span style={{ width: `${data.totalItemCount ? data.checkedItemCount / data.totalItemCount * 100 : 0}%` }} /></div>
      <section className="shopping-items">{data.items.map((item) => <ShoppingItemEditor item={item} list={data} key={item.itemId} />)}</section>
      {data.status === 'OPEN' && <div className="shopping-complete-bar"><div><strong>{allChecked ? 'Everything is purchased.' : `Check ${data.totalItemCount - data.checkedItemCount} more item${data.totalItemCount - data.checkedItemCount === 1 ? '' : 's'}.`}</strong><small>Inventory is written only when you continue.</small></div><button className="primary-action" type="button" disabled={!allChecked || complete.isPending} onClick={() => complete.mutate()}><PackageCheck size={17} /> {complete.isPending ? 'Adding inventory…' : 'Everything purchased — continue'}</button></div>}
      {data.status === 'COMPLETED' && <div className="local-draft-note"><Check size={17} /><span><strong>Purchases committed.</strong> {data.continuationPlanId ? <Link to={`/cooking/${data.continuationPlanId}`}>Open the continued Cooking Plan.</Link> : 'The continuation is being attached; refresh shortly.'}</span></div>}
      {complete.isError && <div className="form-alert" role="alert">{errorMessage(complete.error)}</div>}
    </div>
  )
}

function ShoppingItemEditor({ item, list }: {
  item: Schema<'ShoppingListItemResponse'>
  list: Schema<'ShoppingListResponse'>
}) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [quantity, setQuantity] = useState(String(item.purchasedQuantity))
  const [unit, setUnit] = useState(item.unit)
  const [expiryDate, setExpiryDate] = useState(item.expiryDate || '')
  useEffect(() => {
    setQuantity(String(item.purchasedQuantity))
    setUnit(item.unit)
    setExpiryDate(item.expiryDate || '')
  }, [item.expiryDate, item.purchasedQuantity, item.unit])
  const update = useMutation({
    mutationFn: async (checked: boolean) => dataOrThrow<Schema<'ShoppingListResponse'>>(await api.PATCH('/shopping-lists/{shoppingListId}/items/{itemId}', {
      params: { path: { shoppingListId: list.shoppingListId, itemId: item.itemId }, header: { 'If-Match': `"${item.version}"` } },
      body: { checked, purchasedQuantity: Number(quantity), unit: unit.trim(), expiryDate: expiryDate || null },
    })),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.shopping.detail(list.shoppingListId), updated)
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopping.list() })
      showToast('Shopping item updated.')
    },
  })
  const valid = Number.isFinite(Number(quantity)) && Number(quantity) > 0 && unit.trim().length > 0

  return (
    <article className={`shopping-item${item.checked ? ' checked' : ''}`}>
      <label className="shopping-check"><input type="checkbox" aria-label={`Mark ${item.ingredientName} ${item.checked ? 'not purchased' : 'purchased'}`} checked={item.checked} disabled={list.status !== 'OPEN' || update.isPending || !valid} onChange={(event) => update.mutate(event.target.checked)} /><span><Check size={16} /></span></label>
      <div className="shopping-item-copy"><p className="eyebrow">Need {item.requiredQuantity} {item.unit}</p><h2>{item.ingredientName}</h2></div>
      <label>Purchased quantity<input type="number" min="0.001" step="0.001" disabled={list.status !== 'OPEN'} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      <label>Unit<input maxLength={16} disabled={list.status !== 'OPEN'} value={unit} onChange={(event) => setUnit(event.target.value)} /></label>
      <label>Expiry date<input type="date" disabled={list.status !== 'OPEN'} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></label>
      {list.status === 'OPEN' && <button className="text-button" aria-label={`Save details for ${item.ingredientName}`} type="button" disabled={!valid || update.isPending} onClick={() => update.mutate(item.checked)}><Save size={15} /> Save details</button>}
      {update.isError && <div className="form-alert" role="alert">{errorMessage(update.error)}</div>}
    </article>
  )
}
