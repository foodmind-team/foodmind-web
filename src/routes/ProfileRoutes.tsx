import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BarChart3, CalendarDays, Check, ChefHat, Clock3, History, LogOut, MessageCircle, Settings2, Shield, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { api, ApiError, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { formatDateTime, sentenceCase } from '../lib/format'
import { localMonday } from '../lib/local-date'

function currentMonday() {
  return localMonday(new Date())
}

const PROFILE_TABS = [['overview', 'Overview'], ['activity', 'Activity'], ['account', 'Account']] as const

export function ProfilePage() {
  const { user, logout, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [timeZone, setTimeZone] = useState(user?.timeZone || '')
  const activeTab = searchParams.get('tab') === 'activity' ? 'activity' : searchParams.get('tab') === 'account' ? 'account' : 'overview'
  const recommendations = useQuery({ queryKey: queryKeys.recommendations.history(), queryFn: async () => dataOrThrow<Schema<'RecommendationHistoryResponse'>>(await api.GET('/recommendations/history', { params: { query: { page: 0, size: 5 } } })) })
  const recommendationItems = (recommendations.data?.items || []) as Schema<'RecommendationSessionSummary'>[]
  const update = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'CurrentUserResponse'>>(await api.PATCH('/users/me', { body: { displayName, timeZone } })),
    onSuccess: async (updated) => { queryClient.setQueryData(queryKeys.users.me(), updated); await refreshUser(); setEditing(false); showToast('Profile updated.') },
  })
  return (
    <div className="page section-page profile-page">
      <header className="profile-showcase"><span className="profile-avatar">{(user?.displayName || 'F').slice(0, 1).toUpperCase()}</span><div className="profile-identity"><p className="eyebrow">Your FoodMind account</p><h1>{user?.displayName}</h1><p className="profile-handle">{user?.email}</p><p className="profile-bio">Your private space for food decisions, memories, trusted circles, and grounded guidance.</p><div className="profile-stats"><span><strong>{recommendations.data?.totalItems ?? recommendationItems.length}</strong> recommendation sessions</span><span><strong>{user?.timeZone || 'Local'}</strong> time zone</span></div></div><button className="secondary-action" type="button" onClick={() => { setDisplayName(user?.displayName || ''); setTimeZone(user?.timeZone || ''); setEditing(true) }}><UserRound size={17} /> Edit profile</button></header>
      {editing && <section className="drawer-card"><p className="eyebrow">Profile details</p><h2>How FoodMind addresses you</h2><div className="form-grid"><label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>Time zone<input value={timeZone} onChange={(event) => setTimeZone(event.target.value)} /></label></div>{update.isError && <div className="form-alert">{errorMessage(update.error)}</div>}<div className="form-actions"><button className="secondary-action" type="button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-action" type="button" disabled={!displayName.trim() || !timeZone.trim() || update.isPending} onClick={() => update.mutate()}>Save profile</button></div></section>}
      <nav className="profile-tabs" aria-label="Profile sections">{PROFILE_TABS.map(([value, label]) => <button className={activeTab === value ? 'active' : ''} type="button" aria-current={activeTab === value ? 'page' : undefined} onClick={() => { const next = new URLSearchParams(searchParams); if (value === 'overview') next.delete('tab'); else next.set('tab', value); setSearchParams(next) }} key={value}>{label}</button>)}</nav>

      {activeTab === 'overview' && <section className="profile-tab-panel"><div className="profile-destinations">
        <ProfileLink to="/me/preferences" icon={Settings2} label="Preferences" detail="Budgets, cuisines, dietary rules, allergens, and location context" />
        <ProfileLink to="/cooking/settings" icon={ChefHat} label="Cooking preferences" detail="Regional guidance for new cooking plans" />
        <ProfileLink to="/history" icon={History} label="History" detail="Food and drink records in one timeline" />
        <ProfileLink to="/dashboard" icon={BarChart3} label="Dashboard" detail="Accessible backend-owned metrics and tables" />
        <ProfileLink to={`/weekly-recaps/${currentMonday()}`} icon={CalendarDays} label="Weekly recap" detail="The exact current backend week-start projection" />
        <ProfileLink to="/chat" icon={MessageCircle} label="Ask FoodMind" detail="Grounded search, summary, compare, and navigation" />
      </div></section>}

      {activeTab === 'activity' && <section className="profile-tab-panel profile-activity"><div className="profile-card"><p className="eyebrow">Recent recommendation sessions</p><h2>Your latest decisions</h2>{recommendations.isLoading && <LoadingState label="Loading recommendation history…" />}{recommendations.isError && <ErrorState error={recommendations.error} onRetry={() => void recommendations.refetch()} />}{recommendations.isSuccess && !recommendationItems.length && <EmptyState title="No recommendations yet" message="Generate your first recommendation from Home." />}{recommendationItems.map((item) => <Link className="history-row" to={`/recommendations/${item.sessionId}`} key={item.sessionId}><span><Clock3 size={17} /></span><div><strong>{sentenceCase(item.status)}</strong><small>{formatDateTime(item.createdAt)} · {item.returnedCandidateCount || 0} candidates</small></div><ArrowRight size={16} /></Link>)}</div></section>}

      {activeTab === 'account' && <section className="profile-tab-panel"><div className="profile-card security-card"><p className="eyebrow">Session controls</p><h2>Your account stays in your hands.</h2><p>Access tokens live only in memory. Signing out clears private client data and the server session cookie.</p><div className="session-actions"><button className="secondary-action" type="button" onClick={() => void logout(false)}><LogOut size={17} /> Sign out here</button><button className="text-button danger-link" type="button" onClick={() => void logout(true)}><Shield size={17} /> Sign out everywhere</button></div></div></section>}
    </div>
  )
}

function ProfileLink({ to, icon: Icon, label, detail }: { to: string; icon: typeof Settings2; label: string; detail: string }) {
  return <Link to={to}><span><Icon /></span><div><strong>{label}</strong><small>{detail}</small></div><ArrowRight size={17} /></Link>
}

type PreferenceForm = {
  budgetMin: string; budgetMax: string; currency: string; spiceTolerance: string; preferredArea: string; preferredLatitude: string; preferredLongitude: string; maxDistanceKm: string; cleanlinessPriority: string; minimumCleanlinessEvidenceScore: string; foodGoal: string; drinkSweetnessPreference: string; drinkIcePreference: string; likedCuisineCodes: string[]; dislikedCuisineCodes: string[]; dietaryTagCodes: string[]; preferredMealTypes: string[]
}

const stringNumber = (value: string) => value.trim() ? Number(value) : undefined

export function PreferencesPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const preferences = useQuery({ queryKey: queryKeys.users.preferences(), queryFn: async () => dataOrThrow<Schema<'UserPreferencesResponse'>>(await api.GET('/users/me/preferences')) })
  const reference = useQuery({ queryKey: queryKeys.catalogue.reference(), staleTime: Infinity, queryFn: async () => dataOrThrow<Schema<'CatalogueReferenceDataResponse'>>(await api.GET('/catalogue/reference-data')) })
  const [allergenCodes, setAllergenCodes] = useState<string[]>([])
  const [allergenSeverity, setAllergenSeverity] = useState<Record<string, string>>({})
  const { register, handleSubmit, reset, setError, formState: { isSubmitting } } = useForm<PreferenceForm>()

  useEffect(() => {
    if (!preferences.data) return
    const data = preferences.data
    reset({ budgetMin: data.budgetMin?.toString() || '', budgetMax: data.budgetMax?.toString() || '', currency: data.currency || 'SGD', spiceTolerance: data.spiceTolerance?.toString() || '', preferredArea: data.preferredArea || '', preferredLatitude: data.preferredLatitude?.toString() || '', preferredLongitude: data.preferredLongitude?.toString() || '', maxDistanceKm: data.maxDistanceKm?.toString() || '', cleanlinessPriority: data.cleanlinessPriority?.toString() || '0', minimumCleanlinessEvidenceScore: data.minimumCleanlinessEvidenceScore?.toString() || '', foodGoal: data.foodGoal || '', drinkSweetnessPreference: data.drinkSweetnessPreference || '', drinkIcePreference: data.drinkIcePreference || '', likedCuisineCodes: data.likedCuisineCodes || [], dislikedCuisineCodes: data.dislikedCuisineCodes || [], dietaryTagCodes: data.dietaryTagCodes || [], preferredMealTypes: data.preferredMealTypes || [] })
    setAllergenCodes(data.allergens.map((item) => item.code))
    setAllergenSeverity(Object.fromEntries(data.allergens.map((item) => [item.code, item.severity])))
  }, [preferences.data, reset])

  const update = useMutation({
    mutationFn: async (body: Schema<'ReplacePreferencesRequest'>) => dataOrThrow<Schema<'UserPreferencesResponse'>>(await api.PUT('/users/me/preferences', { body })),
    onSuccess: (updated) => { queryClient.setQueryData(queryKeys.users.preferences(), updated); showToast('Preferences updated.'); void queryClient.invalidateQueries({ queryKey: ['recommendations'] }); void queryClient.invalidateQueries({ queryKey: ['cooking'] }) },
  })
  const submit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ budgetMin: stringNumber(values.budgetMin), budgetMax: stringNumber(values.budgetMax), currency: values.currency.toUpperCase(), spiceTolerance: stringNumber(values.spiceTolerance), preferredArea: values.preferredArea || undefined, preferredLatitude: stringNumber(values.preferredLatitude), preferredLongitude: stringNumber(values.preferredLongitude), maxDistanceKm: stringNumber(values.maxDistanceKm), cleanlinessPriority: stringNumber(values.cleanlinessPriority), minimumCleanlinessEvidenceScore: stringNumber(values.minimumCleanlinessEvidenceScore), foodGoal: values.foodGoal || undefined, drinkSweetnessPreference: values.drinkSweetnessPreference || undefined, drinkIcePreference: values.drinkIcePreference || undefined, likedCuisineCodes: values.likedCuisineCodes, dislikedCuisineCodes: values.dislikedCuisineCodes, dietaryTagCodes: values.dietaryTagCodes, preferredMealTypes: values.preferredMealTypes, allergens: allergenCodes.map((code) => ({ code, severity: allergenSeverity[code] || 'MODERATE' })) })
    } catch (error) {
      let focused = false
      if (error instanceof ApiError) error.fieldErrors.forEach((field) => {
        if (field.field === 'allergens') {
          setError('root', { message: field.message })
        } else if (field.field in values) {
          setError(field.field as keyof PreferenceForm, { message: field.message }, { shouldFocus: !focused })
          focused = true
        }
      })
      if (!focused && !(error instanceof ApiError && error.fieldErrors.length)) setError('root', { message: errorMessage(error) })
    }
  })
  const toggleAllergen = (code: string, checked: boolean) => setAllergenCodes((current) => checked ? [...new Set([...current, code])] : current.filter((item) => item !== code))

  if (preferences.isLoading || reference.isLoading) return <div className="page"><LoadingState label="Loading your preferences…" /></div>
  if (preferences.isError || reference.isError) return <div className="page"><ErrorState error={preferences.error || reference.error} onRetry={() => { void preferences.refetch(); void reference.refetch() }} /></div>
  return (
    <div className="page section-page narrow-page preferences-page"><header className="section-page-heading"><div><p className="eyebrow">Your constraints and taste</p><h1>Preferences</h1><p>Hard requirements filter first. Soft preferences help FoodMind rank the remaining valid options.</p></div></header><form className="card-form" onSubmit={submit}><section><p className="eyebrow">Budget and distance</p><h2>Everyday context</h2><div className="form-grid"><label>Minimum budget<input type="number" min="0" step="0.01" {...register('budgetMin')} /></label><label>Maximum budget<input type="number" min="0" step="0.01" {...register('budgetMax')} /></label><label>Currency<input maxLength={3} {...register('currency')} /></label><label>Preferred area<input {...register('preferredArea')} /></label><label>Maximum distance (km)<input type="number" min="0.1" step="0.1" {...register('maxDistanceKm')} /></label><label>Food goal<input placeholder="e.g. BALANCED" {...register('foodGoal')} /></label></div></section><section><p className="eyebrow">Taste signals</p><h2>Cuisine and meal choices</h2><fieldset><legend>Liked cuisines</legend><div className="check-grid">{reference.data?.cuisines.map((item) => <label className="check-control" key={item.code}><input type="checkbox" value={item.code} {...register('likedCuisineCodes')} /><span>{item.name}</span></label>)}</div></fieldset><fieldset><legend>Disliked cuisines</legend><div className="check-grid">{reference.data?.cuisines.map((item) => <label className="check-control" key={item.code}><input type="checkbox" value={item.code} {...register('dislikedCuisineCodes')} /><span>{item.name}</span></label>)}</div></fieldset><fieldset><legend>Preferred meal types</legend><div className="check-grid">{reference.data?.mealTypes.map((item) => <label className="check-control" key={item}><input type="checkbox" value={item} {...register('preferredMealTypes')} /><span>{sentenceCase(item)}</span></label>)}</div></fieldset><div className="form-grid"><label>Spice tolerance<select {...register('spiceTolerance')}><option value="">Not specified</option>{[0, 1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select></label><label>Drink sweetness<input {...register('drinkSweetnessPreference')} placeholder="e.g. LOW" /></label><label>Drink ice<input {...register('drinkIcePreference')} placeholder="e.g. LESS" /></label></div></section><section><p className="eyebrow">Hard constraints</p><h2>Dietary and allergen needs</h2><fieldset><legend>Required dietary tags</legend><div className="check-grid">{reference.data?.dietaryTags.map((item) => <label className="check-control" key={item.code}><input type="checkbox" value={item.code} {...register('dietaryTagCodes')} /><span>{item.name}</span></label>)}</div></fieldset><fieldset><legend>Allergens</legend><div className="allergen-grid">{reference.data?.allergens.map((item) => <div className="allergen-row" key={item.code}><label className="check-control"><input type="checkbox" checked={allergenCodes.includes(item.code)} onChange={(event) => toggleAllergen(item.code, event.target.checked)} /><span>{item.name}</span></label>{allergenCodes.includes(item.code) && <select aria-label={`${item.name} severity`} value={allergenSeverity[item.code] || 'MODERATE'} onChange={(event) => setAllergenSeverity((current) => ({ ...current, [item.code]: event.target.value }))}><option value="MILD">Mild</option><option value="MODERATE">Moderate</option><option value="SEVERE">Severe</option></select>}</div>)}</div></fieldset></section><section><p className="eyebrow">Cleanliness evidence</p><h2>Decision-support, not a safety guarantee</h2><p>FoodMind organises available hygiene-related observations and applies your priorities as decision-support signals. It does not inspect or certify kitchens.</p><div className="form-grid"><label>Priority<select {...register('cleanlinessPriority')}>{[0, 1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select></label><label>Minimum evidence score<select {...register('minimumCleanlinessEvidenceScore')}><option value="">No threshold</option><option value="0.6">0.6</option><option value="0.8">0.8</option><option value="0.9">0.9</option></select></label><label>Preferred latitude<input type="number" step="any" {...register('preferredLatitude')} /></label><label>Preferred longitude<input type="number" step="any" {...register('preferredLongitude')} /></label></div></section>{update.isError && <div className="form-alert" role="alert">{errorMessage(update.error)}</div>}<div className="form-actions sticky-form-actions"><Link className="secondary-action" to="/me">Cancel</Link><button className="primary-action" type="submit" disabled={isSubmitting || update.isPending}>{update.isPending ? 'Saving…' : <><Check size={17} /> Save preferences</>}</button></div></form></div>
  )
}
