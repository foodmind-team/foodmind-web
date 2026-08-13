import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Bookmark, Check, ChefHat, Clock3, MapPin, RotateCcw, Send, Sparkles, Users, WalletCards, WandSparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { ErrorState, FallbackBanner, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { clampCandidateIndex, prepareCommand, usesRecommendationFallback, type PendingCommand } from '../lib/commands'
import { formatMoney, sentenceCase, toLocalDateTimeValue } from '../lib/format'

type RecommendationCandidate = Schema<'RecommendationCandidateResponse'> & { modelScore?: number | null }
type Recommendation = Omit<Schema<'RecommendationResponse'>, 'items' | 'candidates'> & {
  items: RecommendationCandidate[]
  candidates?: RecommendationCandidate[]
}
const contextSchema = z.object({
  groupId: z.string(),
  mealType: z.string().max(40),
  maxBudget: z.string(),
  currency: z.string().length(3, 'Use a three-letter currency code.'),
  area: z.string().max(120),
  latitude: z.string(),
  longitude: z.string(),
  maxDistanceKm: z.string(),
  mood: z.string().max(120),
  requestedFor: z.string(),
  maxSpiceLevel: z.string(),
  minimumCleanlinessEvidenceScore: z.string(),
  requiredDietaryTagCodes: z.array(z.string()),
  avoidAllergenCodes: z.array(z.string()),
}).superRefine((value, context) => {
  const hasLatitude = Boolean(value.latitude.trim())
  const hasLongitude = Boolean(value.longitude.trim())
  if (hasLatitude !== hasLongitude) {
    context.addIssue({ code: 'custom', path: [hasLatitude ? 'longitude' : 'latitude'], message: 'Supply both coordinates or leave both blank.' })
  }
  const latitude = optionalNumber(value.latitude)
  const longitude = optionalNumber(value.longitude)
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) context.addIssue({ code: 'custom', path: ['latitude'], message: 'Latitude must be between -90 and 90.' })
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) context.addIssue({ code: 'custom', path: ['longitude'], message: 'Longitude must be between -180 and 180.' })
})

type ContextForm = z.infer<typeof contextSchema>

function useGroups() {
  return useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: async () => dataOrThrow<Schema<'GroupResponse'>[]>(await api.GET('/groups')),
  })
}

function useReferenceData() {
  return useQuery({
    queryKey: queryKeys.catalogue.reference(),
    staleTime: Infinity,
    queryFn: async () => dataOrThrow<Schema<'CatalogueReferenceDataResponse'>>(await api.GET('/catalogue/reference-data')),
  })
}

function usePreferences() {
  return useQuery({
    queryKey: queryKeys.users.preferences(),
    queryFn: async () => dataOrThrow<Schema<'UserPreferencesResponse'>>(await api.GET('/users/me/preferences')),
  })
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

export function HomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const groups = useGroups()
  const reference = useReferenceData()
  const preferences = usePreferences()
  const [showContext, setShowContext] = useState(false)
  const command = useRef<PendingCommand | null>(null)
  const defaults = useMemo<ContextForm>(() => ({
    groupId: searchParams.get('groupId') || '',
    mealType: preferences.data?.preferredMealTypes?.[0] || 'DINNER',
    maxBudget: preferences.data?.budgetMax?.toString() || '',
    currency: preferences.data?.currency || 'SGD',
    area: preferences.data?.preferredArea || '',
    latitude: '',
    longitude: '',
    maxDistanceKm: preferences.data?.maxDistanceKm?.toString() || '',
    mood: '',
    requestedFor: toLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000).toISOString()),
    maxSpiceLevel: preferences.data?.spiceTolerance?.toString() || '',
    minimumCleanlinessEvidenceScore: preferences.data?.minimumCleanlinessEvidenceScore?.toString() || '',
    requiredDietaryTagCodes: preferences.data?.dietaryTagCodes || [],
    avoidAllergenCodes: preferences.data?.allergens.map((item) => item.code) || [],
  }), [preferences.data, searchParams])
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ContextForm>({
    resolver: zodResolver(contextSchema),
    values: defaults,
  })
  const values = watch()
  const selectedGroup = groups.data?.find((group) => group.id === values.groupId)

  const generate = useMutation({
    mutationFn: async (input: { body: Schema<'GenerateRecommendationRequest'>; key: string }) => {
      const result = await api.POST('/recommendations/generate', {
        body: input.body,
        params: { header: { 'Idempotency-Key': input.key } },
      })
      return dataOrThrow<Recommendation>(result)
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.recommendations.detail(result.sessionId), result)
      void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.history() })
      command.current = null
      navigate(`/recommendations/${result.sessionId}`)
    },
    onError: () => { command.current = null },
  })

  const submit = handleSubmit((form) => {
    const body: Schema<'GenerateRecommendationRequest'> = {
      groupId: form.groupId || undefined,
      mealType: form.mealType || undefined,
      maxBudget: optionalNumber(form.maxBudget),
      currency: form.maxBudget ? form.currency.toUpperCase() : undefined,
      area: form.area || undefined,
      latitude: optionalNumber(form.latitude),
      longitude: optionalNumber(form.longitude),
      maxDistanceKm: optionalNumber(form.maxDistanceKm),
      mood: form.mood || undefined,
      requestedFor: form.requestedFor ? new Date(form.requestedFor).toISOString() : undefined,
      constraints: {
        maxSpiceLevel: optionalNumber(form.maxSpiceLevel),
        minimumCleanlinessEvidenceScore: optionalNumber(form.minimumCleanlinessEvidenceScore),
        requiredDietaryTagCodes: form.requiredDietaryTagCodes,
        avoidAllergenCodes: form.avoidAllergenCodes,
      },
    }
    command.current = prepareCommand(command.current, body)
    generate.mutate({ body, key: command.current.key })
  })

  const hardConstraints = [...values.requiredDietaryTagCodes, ...values.avoidAllergenCodes]

  return (
    <div className="page home-page">
      <section className="home-heading">
        <p className="eyebrow">Tonight · {selectedGroup?.name || 'Just for you'}</p>
        <h1>Dinner, decided with confidence.</h1>
        <p>One recommendation shaped by your history, trusted context, and the constraints that matter now.</p>
      </section>

      <form className="generator-card recommend-mode" onSubmit={submit}>
        <div className="generator-glow" aria-hidden="true" />
        <div className="generator-context">
          <div className="context-heading">
            <span className="context-icon"><Users size={19} /></span>
            <div><p>Recommending for</p><strong>{selectedGroup?.name || 'Your personal taste'}</strong></div>
            <button type="button" onClick={() => setShowContext((shown) => !shown)} aria-expanded={showContext}>Edit</button>
          </div>
          <div className="context-grid" aria-label="Current recommendation context">
            <ContextItem icon={Clock3} label="When" value={values.requestedFor ? new Date(values.requestedFor).toLocaleString('en-SG', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'Any time'} />
            <ContextItem icon={MapPin} label="Range" value={values.maxDistanceKm ? `Within ${values.maxDistanceKm} km` : values.area || (values.latitude && values.longitude ? 'Manual coordinates' : 'Any area')} />
            <ContextItem icon={WalletCards} label="Budget" value={values.maxBudget ? `${values.currency} ${values.maxBudget}` : 'Flexible'} />
            <ContextItem icon={Sparkles} label="Hard needs" value={hardConstraints.length ? `${hardConstraints.length} applied` : 'None added'} />
          </div>
          <p className="context-trust">FoodMind uses only your own and authorised group evidence. Permission checks stay with the backend.</p>
        </div>

        <div className="generator-action">
          <span className="hero-symbol" aria-hidden="true"><MapPin size={34} /></span>
          <p className="generator-label">FoodMind recommendation</p>
          <h2>Ready for one place that fits tonight?</h2>
          <p>Hard constraints decide what is valid. Your FoodMind signals help rank what is most suitable.</p>
          {generate.isError && <div className="inline-error" role="alert">{errorMessage(generate.error)}</div>}
          <button className="generate-button" type="submit" disabled={generate.isPending}>
            {generate.isPending ? <><span className="spinner" /> Finding your best match…</> : <><WandSparkles size={20} /> Generate recommendation <ArrowRight size={18} /></>}
          </button>
          <small>Up to three ordered candidates, shown one clear choice at a time.</small>
        </div>

        {showContext && (
          <div className="context-editor">
            <div className="section-topline"><div><p className="eyebrow">Decision context</p><h2>Shape tonight's recommendation</h2></div><button className="icon-button" type="button" aria-label="Close context editor" onClick={() => setShowContext(false)}><X size={19} /></button></div>
            <div className="form-grid">
              <label>Group<select {...register('groupId')}><option value="">Just for me</option>{groups.data?.filter((group) => group.status === 'ACTIVE').map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
              <label>Meal type<select {...register('mealType')}>{(reference.data?.mealTypes || ['BREAKFAST', 'LUNCH', 'DINNER']).map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Maximum budget<input type="number" min="0" step="0.01" {...register('maxBudget')} /></label>
              <label>Currency<input maxLength={3} {...register('currency')} />{errors.currency && <small>{errors.currency.message}</small>}</label>
              <label>Area<input placeholder="e.g. Tiong Bahru" {...register('area')} /></label>
              <label>Latitude (optional)<input type="number" min="-90" max="90" step="any" placeholder="1.3521" {...register('latitude')} />{errors.latitude && <small>{errors.latitude.message}</small>}</label>
              <label>Longitude (optional)<input type="number" min="-180" max="180" step="any" placeholder="103.8198" {...register('longitude')} />{errors.longitude && <small>{errors.longitude.message}</small>}</label>
              <label>Maximum distance (km)<input type="number" min="0.1" step="0.1" {...register('maxDistanceKm')} /></label>
              <label>Mood<input placeholder="Comforting, quick, adventurous…" {...register('mood')} /></label>
              <label>Requested time<input type="datetime-local" {...register('requestedFor')} /></label>
              <label>Maximum spice<select {...register('maxSpiceLevel')}><option value="">No limit</option>{[0, 1, 2, 3, 4, 5].map((level) => <option value={level} key={level}>{level} / 5</option>)}</select></label>
              <label>Cleanliness evidence threshold<select {...register('minimumCleanlinessEvidenceScore')}><option value="">No threshold</option><option value="0.6">Moderate evidence</option><option value="0.8">Strong evidence</option><option value="0.9">Very strong evidence</option></select></label>
            </div>
            <fieldset><legend>Dietary requirements</legend><div className="check-grid">{reference.data?.dietaryTags.map((item) => <label className="check-control" key={item.code}><input type="checkbox" value={item.code} {...register('requiredDietaryTagCodes')} /><span>{item.name}</span></label>)}</div></fieldset>
            <fieldset><legend>Allergens to avoid</legend><div className="check-grid">{reference.data?.allergens.map((item) => <label className="check-control" key={item.code}><input type="checkbox" value={item.code} {...register('avoidAllergenCodes')} /><span>{item.name}</span></label>)}</div></fieldset>
            <div className="form-actions"><button className="secondary-action" type="button" onClick={() => reset(defaults)}>Use profile defaults</button><button className="primary-action" type="button" onClick={() => setShowContext(false)}>Done</button></div>
          </div>
        )}
      </form>

      <div className="support-grid">
        <section className="group-card"><p className="eyebrow">Trusted groups</p><h2>{groups.isLoading ? 'Loading your groups…' : groups.data?.length ? `${groups.data.length} group${groups.data.length === 1 ? '' : 's'} ready` : 'Decide together when you are ready'}</h2><p className="section-support">Group recommendations use only evidence you are authorised to see.</p><Link className="text-button" to="/groups">Open Groups <ArrowRight size={15} /></Link></section>
        <section className="learn-card"><p className="eyebrow">The decision loop</p><h2>Clear choice. Honest reasons.</h2><div className="learn-list"><LearnItem number="01" title="Rules filter" detail="Dietary, allergy, budget, and distance needs" /><LearnItem number="02" title="Signals rank" detail="Personal and trusted group evidence" /><LearnItem number="03" title="You decide" detail="Accept, reject, or ask for a new session" /></div></section>
      </div>
      {(groups.isError || reference.isError || preferences.isError) && <div className="soft-warning" role="status">Some profile context could not be loaded. You can still adjust the available fields and retry.</div>}
    </div>
  )
}

function ContextItem({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="context-item"><Icon size={17} /><span><small>{label}</small><strong>{value}</strong></span></div>
}

function LearnItem({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="learn-item"><span>{number}</span><p><strong>{title}</strong><small>{detail}</small></p></div>
}

const reasonLabels: Record<string, string> = {
  CUISINE_MATCH: 'Cuisine match', WITHIN_BUDGET: 'Within budget', SPICE_MATCH: 'Spice match', NEARBY: 'Nearby', NOT_RECENTLY_REPEATED: 'Fresh choice', SIMILAR_USERS_LIKED: 'Similar users liked', SIMILAR_TO_LIKED_MEALS: 'Similar to meals you liked', TRUSTED_GROUP_RATING: 'Trusted group signal', WANT_TO_TRY: 'On your shortlist',
}

export function RecommendationDetailPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const groups = useGroups()
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [rejectionReason, setRejectionReason] = useState('')
  const [shareGroupId, setShareGroupId] = useState('')
  const recommendation = useQuery({
    queryKey: queryKeys.recommendations.detail(sessionId),
    queryFn: async () => dataOrThrow<Recommendation>(await api.GET('/recommendations/{sessionId}', { params: { path: { sessionId } } })),
  })
  const items = useMemo(
    () => [...(recommendation.data?.items || recommendation.data?.candidates || [])]
      .sort((left, right) => left.rank - right.rank),
    [recommendation.data],
  )
  const candidate = items[candidateIndex]

  useEffect(() => {
    setCandidateIndex(0)
    setRejectionReason('')
  }, [sessionId])

  const feedback = useMutation({
    mutationFn: async (body: Schema<'RecommendationFeedbackRequest'>) => dataOrThrow(await api.POST('/recommendations/{sessionId}/feedback', { body, params: { path: { sessionId }, header: { 'Idempotency-Key': crypto.randomUUID() } } })),
    onSuccess: (_result, variables) => {
      showToast(variables.eventType === 'ACCEPTED' ? 'Choice accepted. FoodMind will use this signal.' : 'Feedback recorded.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.history() })
      void queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
  const save = useMutation({
    mutationFn: async () => dataOrThrow(await api.POST('/want-to-try', { body: { sourceType: 'PLACE', sourceId: candidate!.placeId! } })),
    onSuccess: () => { showToast('Added to Want to Try.'); void queryClient.invalidateQueries({ queryKey: ['saved'] }) },
  })
  const share = useMutation({
    mutationFn: async () => dataOrThrow(await api.POST('/groups/{groupId}/recommendation-shares', { body: { recommendationCandidateId: candidate!.candidateId }, params: { path: { groupId: shareGroupId } } })),
    onSuccess: () => { showToast('Recommendation shared with your group.'); void queryClient.invalidateQueries({ queryKey: queryKeys.groups.feed(shareGroupId) }) },
  })
  const rerecommend = useMutation({
    mutationFn: async () => {
      dataOrThrow(await api.POST('/recommendations/{sessionId}/feedback', { body: { eventType: 'RERECOMMEND_REQUESTED' }, params: { path: { sessionId }, header: { 'Idempotency-Key': crypto.randomUUID() } } }))
      return dataOrThrow<Recommendation>(await api.POST('/recommendations/generate', { body: { parentSessionId: sessionId }, params: { header: { 'Idempotency-Key': crypto.randomUUID() } } }))
    },
    onSuccess: (result) => { queryClient.setQueryData(queryKeys.recommendations.detail(result.sessionId), result); navigate(`/recommendations/${result.sessionId}`) },
  })

  if (recommendation.isLoading) return <div className="page"><LoadingState label="Opening your recommendation…" /></div>
  if (recommendation.isError) return <div className="page"><ErrorState error={recommendation.error} onRetry={() => void recommendation.refetch()} /></div>
  if (!candidate) return <div className="page"><section className="state-panel"><Sparkles /><p className="eyebrow">{sentenceCase(recommendation.data?.status)}</p><h1>No valid candidate yet.</h1><p>Your constraints protected the decision. Edit the context and try a new recommendation.</p><Link className="primary-action" to="/">Edit context</Link></section></div>

  const fallbackUsed = usesRecommendationFallback(recommendation.data?.status, recommendation.data?.fallbackStatus)
  const isRecordCandidate = candidate.candidateSourceType === 'FOOD_RECORD'
  const recordAgainQuery = new URLSearchParams({
    type: 'food', mealName: candidate.mealName, sessionId, candidateId: candidate.candidateId,
    ...(candidate.mealId ? { mealId: candidate.mealId } : {}),
    ...(candidate.placeId ? { placeId: candidate.placeId } : {}),
    ...(candidate.placeName ? { placeName: candidate.placeName } : {}),
  }).toString()
  return (
    <div className="page recommendation-page">
      <header className="section-page-heading"><div><p className="eyebrow">Candidate {candidateIndex + 1} of {items.length} · {sentenceCase(candidate.recommendationType)}</p><h1>{candidate.mealName}</h1><p>At {candidate.placeName}{candidate.area ? ` in ${candidate.area}` : ''}</p></div><span className="rank-orbit">#{candidate.rank}</span></header>
      {fallbackUsed && <FallbackBanner message="The model path was unavailable or unsuitable, so FoodMind used its deterministic rules-based recommender." />}
      <section className="result-card detailed-result" aria-live="polite">
        <div className="result-visual dynamic" aria-hidden="true"><span>{candidate.mealName.split(/\s+/).slice(0, 2).map((word) => word[0]).join('')}</span><small>{sentenceCase(candidate.recommendationType)}</small></div>
        <div className="result-copy">
          <div className="result-topline"><span className="match-pill"><Sparkles size={14} /> {sentenceCase(recommendation.data?.status)}</span>{!isRecordCandidate && candidate.placeId && <button className="save-button" type="button" onClick={() => save.mutate()} disabled={save.isPending} aria-label={`Save ${candidate.placeName || candidate.mealName}`}><Bookmark size={18} /></button>}</div>
          <p className="eyebrow">{candidate.placeName || (isRecordCandidate ? 'Saved food record' : 'Place not provided')}</p><h2>{candidate.mealName}</h2>
          <div className="result-meta"><span><MapPin size={15} /> {candidate.area || 'Area not provided'}</span><span>{candidate.priceKind === 'LAST_RECORDED' ? 'Last recorded price: ' : ''}{formatMoney(candidate.price?.amount, candidate.price?.currency)}</span>{candidate.modelScore != null && <span><Sparkles size={15} /> ML match {Math.round(candidate.modelScore * 100)}%</span>}</div>
          {isRecordCandidate && <p className="eyebrow">Historical record — current availability is unverified.</p>}
          <p className="eyebrow">Confirmed ML ranking basis</p>
          <p className="result-description">{candidate.explanation}</p>
          <div className="signal-list">{candidate.reasonCodes.map((reason) => <span key={reason}><Check size={14} /> {reasonLabels[reason] || sentenceCase(reason)}</span>)}</div>
          {(feedback.isError || save.isError || share.isError || rerecommend.isError) && <div className="inline-error" role="alert">{errorMessage(feedback.error || save.error || share.error || rerecommend.error)}</div>}
          <div className="decision-actions"><button className="primary-action" type="button" disabled={feedback.isPending} onClick={() => feedback.mutate({ eventType: 'ACCEPTED', candidateId: candidate.candidateId })}><Check size={17} /> Accept this choice</button><button className="secondary-action" type="button" disabled={candidateIndex >= items.length - 1} onClick={() => setCandidateIndex((index) => clampCandidateIndex(index + 1, items.length))}><RotateCcw size={16} /> Try another</button></div>
          <div className="reject-panel"><label>Not right tonight?<select value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)}><option value="">Choose a reason</option>{['TOO_EXPENSIVE', 'TOO_FAR', 'NOT_IN_MOOD', 'DIETARY_CONCERN', 'ALLERGEN_CONCERN', 'RECENTLY_EATEN', 'PLACE_CONCERN', 'OTHER'].map((reason) => <option value={reason} key={reason}>{sentenceCase(reason)}</option>)}</select></label><button className="text-button danger-link" type="button" disabled={!rejectionReason || feedback.isPending} onClick={() => feedback.mutate({ eventType: 'REJECTED', candidateId: candidate.candidateId, reasonCode: rejectionReason as Schema<'RecommendationFeedbackRequest'>['reasonCode'] })}>Reject this candidate</button></div>
        </div>
      </section>

      <div className="support-grid recommendation-support">
        <section className="group-card"><p className="eyebrow">Share the choice</p><h2>Bring your group in.</h2><label>Group<select value={shareGroupId} onChange={(event) => setShareGroupId(event.target.value)}><option value="">Choose a group</option>{groups.data?.filter((group) => group.status === 'ACTIVE').map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><button className="primary-action" type="button" disabled={!shareGroupId || share.isPending} onClick={() => share.mutate()}><Send size={17} /> Share recommendation</button></section>
        <section className="learn-card"><p className="eyebrow">Start a fresh decision</p><h2>Need an entirely new set?</h2><p>A true re-recommendation records your request and creates a new linked session.</p><button className="secondary-action inverse" type="button" disabled={rerecommend.isPending} onClick={() => rerecommend.mutate()}><WandSparkles size={17} /> Generate a new session</button></section>
      </div>
      <div className="contextual-links">
        {isRecordCandidate && candidate.foodRecordId && <Link to={`/records/food/${candidate.foodRecordId}`}><ChefHat size={17} /> Open original record</Link>}
        <Link to={`/records/new?${recordAgainQuery}`}><ChefHat size={17} /> Record this meal later</Link>
        {candidate.placeId && <Link to={`/catalogue/place/${candidate.placeId}`}>View place details <ArrowRight size={15} /></Link>}
      </div>
    </div>
  )
}
