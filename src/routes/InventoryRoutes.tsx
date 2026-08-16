import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Check, PackageOpen, Pencil, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'

type LotDraft = { ingredientName: string; quantity: string; unit: string; expiryDate: string }
const EMPTY_LOT: LotDraft = { ingredientName: '', quantity: '', unit: 'g', expiryDate: '' }

function lotBody(draft: LotDraft): Schema<'InventoryLotRequest'> {
  return {
    ingredientName: draft.ingredientName.trim(),
    quantity: Number(draft.quantity),
    unit: draft.unit.trim(),
    expiryDate: draft.expiryDate || null,
  }
}

function updateInventoryCache(
  queryClient: ReturnType<typeof useQueryClient>,
  saved: Schema<'InventoryLotResponse'>,
  prepend = false,
) {
  queryClient.setQueryData<Schema<'InventoryLotPageResponse'>>(queryKeys.inventory.list(), (current) => {
    if (!current) return current
    const items = (current.items || []) as Schema<'InventoryLotResponse'>[]
    const remaining = items.filter((item) => item.lotId !== saved.lotId)
    return { ...current, items: prepend ? [saved, ...remaining] : remaining.concat(saved) } as Schema<'InventoryLotPageResponse'>
  })
}

export function InventoryPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [draft, setDraft] = useState<LotDraft>(EMPTY_LOT)
  const [adding, setAdding] = useState(false)
  const inventory = useQuery({
    queryKey: queryKeys.inventory.list(),
    queryFn: async () => dataOrThrow<Schema<'InventoryLotPageResponse'>>(await api.GET('/inventory/lots', { params: { query: { page: 0, size: 100 } } })),
  })
  const create = useMutation({
    mutationFn: async (body: Schema<'InventoryLotRequest'>) => dataOrThrow<Schema<'InventoryLotResponse'>>(await api.POST('/inventory/lots', { body })),
    onSuccess: (saved) => {
      setDraft(EMPTY_LOT)
      setAdding(false)
      updateInventoryCache(queryClient, saved, true)
      showToast('Inventory lot added.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.list() })
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const body = lotBody(draft)
    if (!body.ingredientName || !body.unit || !Number.isFinite(body.quantity) || body.quantity <= 0) return
    create.mutate(body)
  }

  return (
    <div className="page section-page inventory-page">
      <header className="section-page-heading"><div><p className="eyebrow">Real inventory</p><h1>What is in your kitchen?</h1><p>Keep quantities current so FoodMind can plan around what you already have.</p></div><div className="heading-actions"><Link className="secondary-action" to="/shopping-lists">Shopping lists</Link><button className="primary-action" type="button" onClick={() => setAdding(true)}><Plus size={16} /> Add ingredient</button></div></header>
      {adding && <form className="inventory-create-form detail-card drawer-card" onSubmit={submit}>
        <div><p className="eyebrow">Add inventory</p><h2>Create a lot</h2></div>
        <label>Ingredient<input required maxLength={128} value={draft.ingredientName} onChange={(event) => setDraft((current) => ({ ...current, ingredientName: event.target.value }))} placeholder="Firm tofu" /></label>
        <label>Quantity<input required type="number" min="0.001" step="0.001" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} /></label>
        <label>Unit<input required maxLength={16} value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))} /></label>
        <label>Expiry date<input type="date" value={draft.expiryDate} onChange={(event) => setDraft((current) => ({ ...current, expiryDate: event.target.value }))} /></label>
        <div className="form-actions"><button className="secondary-action" type="button" onClick={() => { setAdding(false); setDraft(EMPTY_LOT) }}>Cancel</button><button className="primary-action" type="submit" disabled={create.isPending}><Plus size={16} /> {create.isPending ? 'Adding…' : 'Add ingredient'}</button></div>
      </form>}
      {create.isError && <div className="form-alert" role="alert">{errorMessage(create.error)}</div>}
      {inventory.isLoading && <LoadingState label="Loading inventory…" />}
      {inventory.isError && <ErrorState error={inventory.error} onRetry={() => void inventory.refetch()} />}
      {inventory.isSuccess && !inventory.data.items?.length && <EmptyState title="Your inventory is empty" message="Add what you have before generating a Cooking Plan." action={<button className="primary-action" type="button" onClick={() => setAdding(true)}>Add your first ingredient</button>} />}
      <section className="inventory-lot-grid">{((inventory.data?.items || []) as Schema<'InventoryLotResponse'>[]).map((lot) => <InventoryLotCard lot={lot} key={lot.lotId} />)}</section>
    </div>
  )
}

function InventoryLotCard({ lot }: { lot: Schema<'InventoryLotResponse'> }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [draft, setDraft] = useState<LotDraft>({ ingredientName: lot.ingredientName, quantity: String(lot.quantity), unit: lot.unit, expiryDate: lot.expiryDate || '' })
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory.list() })
  const openEditor = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'InventoryLotResponse'>>(await api.GET('/inventory/lots/{lotId}', {
      params: { path: { lotId: lot.lotId } },
    })),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.inventory.detail(detail.lotId), detail)
      setDraft({ ingredientName: detail.ingredientName, quantity: String(detail.quantity), unit: detail.unit, expiryDate: detail.expiryDate || '' })
      setEditing(true)
    },
  })
  const update = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'InventoryLotResponse'>>(await api.PUT('/inventory/lots/{lotId}', {
      params: { path: { lotId: lot.lotId }, header: { 'If-Match': `"${lot.version}"` } },
      body: lotBody(draft),
    })),
    onSuccess: (saved) => {
      setDraft({ ingredientName: saved.ingredientName, quantity: String(saved.quantity), unit: saved.unit, expiryDate: saved.expiryDate || '' })
      updateInventoryCache(queryClient, saved)
      setEditing(false)
      showToast('Inventory lot updated.')
      void refresh()
    },
  })
  const archive = useMutation({
    mutationFn: async () => dataOrThrow(await api.DELETE('/inventory/lots/{lotId}', { params: { path: { lotId: lot.lotId }, header: { 'If-Match': `"${lot.version}"` } } })),
    onSuccess: () => { setConfirmingArchive(false); showToast('Inventory lot archived.'); void refresh() },
  })

  return (
    <article className="inventory-lot-card">
      <div className="inventory-lot-icon"><PackageOpen size={20} /></div>
      {editing ? <>
        <label>Ingredient<input value={draft.ingredientName} onChange={(event) => setDraft((current) => ({ ...current, ingredientName: event.target.value }))} /></label>
        <div className="inventory-edit-row"><label>Quantity<input type="number" min="0.001" step="0.001" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} /></label><label>Unit<input value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))} /></label><label>Expiry<input type="date" value={draft.expiryDate} onChange={(event) => setDraft((current) => ({ ...current, expiryDate: event.target.value }))} /></label></div>
        <div className="recipe-card-actions"><button className="primary-action" type="button" disabled={update.isPending} onClick={() => update.mutate()}><Check size={15} /> Save</button><button className="secondary-action" type="button" onClick={() => setEditing(false)}><X size={15} /> Cancel</button></div>
      </> : <>
        <div><p className="eyebrow">{lot.expiryDate ? `Expires ${lot.expiryDate}` : 'No expiry date'}</p><h2>{lot.ingredientName}</h2><p><strong>{lot.available} {lot.unit}</strong> available · {lot.reserved} reserved</p></div>
        <div className="recipe-card-actions"><button className="text-button" type="button" disabled={openEditor.isPending} onClick={() => openEditor.mutate()}><Pencil size={15} /> {openEditor.isPending ? 'Opening…' : 'Edit'}</button><button className="text-button danger-text" type="button" disabled={archive.isPending} onClick={() => setConfirmingArchive(true)}><Archive size={15} /> Archive</button></div>
        {confirmingArchive && <div className="confirm-panel" role="alert"><p>Archive {lot.ingredientName}? It will no longer be available to new cooking plans.</p><div><button className="secondary-action" type="button" onClick={() => setConfirmingArchive(false)}>Cancel</button><button className="text-button danger-text" type="button" disabled={archive.isPending} onClick={() => archive.mutate()}>{archive.isPending ? 'Archiving…' : 'Archive ingredient'}</button></div></div>}
      </>}
      {(openEditor.isError || update.isError || archive.isError) && <div className="form-alert" role="alert">{errorMessage(openEditor.error || update.error || archive.error)}</div>}
    </article>
  )
}
