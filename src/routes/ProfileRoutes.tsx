import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BarChart3, CalendarDays, Check, ChefHat, Clock3, History, LocateFixed, LogOut, MessageCircle, Settings2, Shield, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { api, ApiError, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { requestCurrentLocation, type CurrentCoordinates } from '../lib/current-location'
import { queryKeys } from '../lib/api/query-keys'
import { formatDateTime, sentenceCase } from '../lib/format'
import { localMonday } from '../lib/local-date'
import { parsePreferenceCodes } from '../lib/preference-codes'

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
  budgetMin: string
  budgetMax: string
  currency: string
  spiceTolerance: string
  maxDistanceKm: string
  drinkSweetnessPreference: string
  drinkIcePreference: string
  likedCuisineCodes: string[]
  dislikedCuisineCodes: string[]
  dietaryTagCodes: string
  allergenCodes: string
  preferredMealTypes: string[]
}

const stringNumber = (value: string) => value.trim() ? Number(value) : undefined


export function PreferencesPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const preferences = useQuery({ queryKey: queryKeys.users.preferences(), queryFn: async () => dataOrThrow<Schema<'UserPreferencesResponse'>>(await api.GET('/users/me/preferences')) })
  const reference = useQuery({ queryKey: queryKeys.catalogue.reference(), staleTime: Infinity, queryFn: async () => dataOrThrow<Schema<'CatalogueReferenceDataResponse'>>(await api.GET('/catalogue/reference-data')) })
  const [coordinates, setCoordinates] = useState<CurrentCoordinates | null>(null)
  const [locationMessage, setLocationMessage] = useState('No default location saved. Distance filtering is off.')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const { register, handleSubmit, reset, setError, setValue, watch, formState: { errors, isSubmitting } } = useForm<PreferenceForm>({
    defaultValues: { likedCuisineCodes: [], dislikedCuisineCodes: [] },
  })
  const likedCuisineCodes = watch('likedCuisineCodes') || []
  const dislikedCuisineCodes = watch('dislikedCuisineCodes') || []

  useEffect(() => {
    if (!preferences.data) return
    const data = preferences.data
    reset({ budgetMin: data.budgetMin?.toString() || '', budgetMax: data.budgetMax?.toString() || '', currency: data.currency || 'SGD', spiceTolerance: data.spiceTolerance?.toString() || '', maxDistanceKm: data.maxDistanceKm?.toString() || '', drinkSweetnessPreference: data.drinkSweetnessPreference || '', drinkIcePreference: data.drinkIcePreference || '', likedCuisineCodes: data.likedCuisineCodes || [], dislikedCuisineCodes: data.dislikedCuisineCodes || [], dietaryTagCodes: (data.dietaryTagCodes || []).join(', '), allergenCodes: data.allergens.map((item) => item.code).join(', '), preferredMealTypes: data.preferredMealTypes || [] })
    const savedCoordinates = data.preferredLatitude != null && data.preferredLongitude != null
      ? { latitude: data.preferredLatitude, longitude: data.preferredLongitude }
      : null
    setCoordinates(savedCoordinates)
    setLocationMessage(savedCoordinates ? 'Saved default location is ready.' : 'No default location saved. Distance filtering is off.')
    setLocationError(null)
  }, [preferences.data, reset])

  const update = useMutation({
    mutationFn: async (body: Schema<'ReplacePreferencesRequest'>) => dataOrThrow<Schema<'UserPreferencesResponse'>>(await api.PUT('/users/me/preferences', { body })),
    onSuccess: (updated) => { queryClient.setQueryData(queryKeys.users.preferences(), updated); showToast('Preferences updated.'); void queryClient.invalidateQueries({ queryKey: ['recommendations'] }); void queryClient.invalidateQueries({ queryKey: ['cooking'] }) },
  })
  const submit = handleSubmit(async (values) => {
    try {
      const liked = values.likedCuisineCodes || []
      const disliked = (values.dislikedCuisineCodes || []).filter((code) => !liked.includes(code))
      const existingAllergenSeverity = Object.fromEntries((preferences.data?.allergens || []).map((item) => [item.code, item.severity]))
      await update.mutateAsync({ budgetMin: stringNumber(values.budgetMin), budgetMax: stringNumber(values.budgetMax), currency: values.currency.toUpperCase(), spiceTolerance: stringNumber(values.spiceTolerance), preferredArea: undefined, preferredLatitude: coordinates?.latitude, preferredLongitude: coordinates?.longitude, maxDistanceKm: coordinates ? stringNumber(values.maxDistanceKm) : undefined, drinkSweetnessPreference: values.drinkSweetnessPreference || undefined, drinkIcePreference: values.drinkIcePreference || undefined, cookingRegion: preferences.data?.cookingRegion, likedCuisineCodes: liked, dislikedCuisineCodes: disliked, dietaryTagCodes: parsePreferenceCodes(values.dietaryTagCodes), preferredMealTypes: values.preferredMealTypes, allergens: parsePreferenceCodes(values.allergenCodes).map((code) => ({ code, severity: existingAllergenSeverity[code] || 'MODERATE' })) })
    } catch (error) {
      let focused = false
      if (error instanceof ApiError) error.fieldErrors.forEach((field) => {
        if (field.field === 'allergens') {
          setError('allergenCodes', { message: field.message }, { shouldFocus: !focused })
          focused = true
        } else if (field.field in values) {
          setError(field.field as keyof PreferenceForm, { message: field.message }, { shouldFocus: !focused })
          focused = true
        }
      })
      if (!focused && !(error instanceof ApiError && error.fieldErrors.length)) setError('root', { message: errorMessage(error) })
    }
  })
  const locate = async () => {
    setLocating(true)
    setLocationError(null)
    try {
      setCoordinates(await requestCurrentLocation())
      setLocationMessage('Current location is ready and will be saved with your preferences.')
    } catch (error) {
      setLocationError(errorMessage(error))
    } finally {
      setLocating(false)
    }
  }
  const clearLocation = () => {
    setCoordinates(null)
    setValue('maxDistanceKm', '')
    setLocationMessage('No default location saved. Distance filtering is off.')
    setLocationError(null)
  }
  const toggleCuisine = (field: 'likedCuisineCodes' | 'dislikedCuisineCodes', code: string, checked: boolean) => {
    const selected = field === 'likedCuisineCodes' ? likedCuisineCodes : dislikedCuisineCodes
    const oppositeField = field === 'likedCuisineCodes' ? 'dislikedCuisineCodes' : 'likedCuisineCodes'
    const opposite = field === 'likedCuisineCodes' ? dislikedCuisineCodes : likedCuisineCodes
    setValue(field, checked ? [...new Set([...selected, code])] : selected.filter((item) => item !== code), { shouldDirty: true })
    if (checked) setValue(oppositeField, opposite.filter((item) => item !== code), { shouldDirty: true })
  }

  if (preferences.isLoading || reference.isLoading) return <div className="page"><LoadingState label="Loading your preferences…" /></div>
  if (preferences.isError || reference.isError) return <div className="page"><ErrorState error={preferences.error || reference.error} onRetry={() => { void preferences.refetch(); void reference.refetch() }} /></div>
  return (
    <div className="page section-page narrow-page preferences-page">
      <header className="section-page-heading">
        <div><p className="eyebrow">Your constraints and taste</p><h1>Preferences</h1><p>Hard requirements filter first. Soft preferences help FoodMind rank the remaining valid options.</p></div>
      </header>
      <form className="card-form" onSubmit={submit}>
        <section>
          <p className="eyebrow">Budget and distance</p>
          <h2>Everyday context</h2>
          <div className="form-grid">
            <label>Minimum budget<input type="number" min="0" step="0.01" {...register('budgetMin')} /></label>
            <label>Maximum budget<input type="number" min="0" step="0.01" {...register('budgetMax')} /></label>
            <label>Currency<input maxLength={3} {...register('currency')} /></label>
          </div>
          <div className="current-location-card">
            <div className="current-location-copy"><p className="eyebrow">Default location</p><h3>Use your current location</h3><p>FoodMind saves this starting point only when you save these preferences.</p></div>
            <div className="current-location-actions">
              <button className="secondary-action" type="button" disabled={locating} onClick={() => void locate()}><LocateFixed size={17} /> {locating ? 'Locating…' : coordinates ? 'Update current location' : 'Use current location'}</button>
              {coordinates && <button className="text-button danger-link" type="button" onClick={clearLocation}><Trash2 size={16} /> Remove saved location</button>}
            </div>
            <p className="current-location-status" role="status">{locationMessage}</p>
            {locationError && <div className="form-alert" role="alert">{locationError}</div>}
            <label>Maximum distance (km)<input type="number" min="0.1" step="0.1" disabled={!coordinates} {...register('maxDistanceKm')} /><small>{coordinates ? 'Recommendations can use this distance from your saved location.' : 'Choose your current location before setting a distance.'}</small></label>
          </div>
        </section>

        <section>
          <p className="eyebrow">Taste signals</p><h2>Cuisine and meal choices</h2>
          <fieldset><legend>Liked cuisines</legend><div className="check-grid">{reference.data?.cuisines.map((item) => <label className="check-control" key={item.code}><input type="checkbox" checked={likedCuisineCodes.includes(item.code)} onChange={(event) => toggleCuisine('likedCuisineCodes', item.code, event.target.checked)} /><span>{item.name}</span></label>)}</div></fieldset>
          <fieldset><legend>Disliked cuisines</legend><div className="check-grid">{reference.data?.cuisines.map((item) => <label className="check-control" key={item.code}><input type="checkbox" checked={dislikedCuisineCodes.includes(item.code)} onChange={(event) => toggleCuisine('dislikedCuisineCodes', item.code, event.target.checked)} /><span>{item.name}</span></label>)}</div></fieldset>
          <fieldset><legend>Preferred meal types</legend><div className="check-grid">{reference.data?.mealTypes.map((item) => <label className="check-control" key={item}><input type="checkbox" value={item} {...register('preferredMealTypes')} /><span>{sentenceCase(item)}</span></label>)}</div></fieldset>
          <div className="form-grid"><label>Spice tolerance<select {...register('spiceTolerance')}><option value="">Not specified</option>{[0, 1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select></label><label>Drink sweetness<input {...register('drinkSweetnessPreference')} placeholder="e.g. LOW" /></label><label>Drink ice<input {...register('drinkIcePreference')} placeholder="e.g. LESS" /></label></div>
        </section>

        <section>
          <p className="eyebrow">Hard constraints</p><h2>Dietary and allergen needs</h2>
          <div className="form-grid">
            <label>Required dietary tags<input {...register('dietaryTagCodes')} placeholder="e.g. VEGAN, VEGETARIAN" /><small>Separate multiple values with commas.</small></label>
            <label>Allergens<input {...register('allergenCodes')} placeholder="e.g. PEANUT, SHELLFISH" /><small>Separate multiple values with commas.</small></label>
          </div>
        </section>
        {(errors.root?.message || update.isError) && <div className="form-alert" role="alert">{errors.root?.message || errorMessage(update.error)}</div>}
        <div className="form-actions sticky-form-actions">
          <Link className="secondary-action" to="/me">Cancel</Link>
          <button className="primary-action" type="submit" disabled={isSubmitting || update.isPending}>{update.isPending ? 'Saving…' : <><Check size={17} /> Save preferences</>}</button>
        </div>
      </form>
    </div>
  )
}
