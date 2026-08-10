import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Bot, Check, ChefHat, ListChecks, RefreshCw, Sparkles, Users } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../components/feedback/States'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'

type ImportSession = Schema<'RecipeImportResponse'>
type ImportDraft = Schema<'RecipeImportDraft'>
type ImportQuestion = Schema<'RecipeImportQuestion'>

const starterText = `Recipe: Lemon Pasta
4 servings
Ingredients:
200 g spaghetti
1 lemon
Steps:
1. Boil the spaghetti for 10 minutes.
2. Toss with lemon.
---
Recipe: Tomato Salad
Ingredients:
2 tomatoes
1 tbsp olive oil
Steps:
1. Slice the tomatoes.
2. Toss with olive oil.`

export function RecipeImportStartPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fromRecipeLibrary = location.pathname.startsWith('/saved/recipes')
  const backPath = fromRecipeLibrary ? '/saved/recipes' : '/cooking'
  const backLabel = fromRecipeLibrary ? 'My recipes' : 'Cooking'
  const [text, setText] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const textInput = useRef<HTMLTextAreaElement>(null)
  const create = useMutation({
    mutationFn: async (body: Schema<'CreateRecipeImportRequest'>) =>
      dataOrThrow<ImportSession>(await api.POST('/recipe-imports', { body })),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.recipeImports.detail(session.importId), session)
      navigate(`/cooking/import/${session.importId}`)
    },
  })

  const submit = () => {
    const value = text.trim()
    if (!value) {
      setValidationError('Enter at least one recipe before continuing.')
      textInput.current?.focus()
      return
    }
    setValidationError(null)
    create.mutate({ text: value })
  }

  return (
    <div className="page section-page cooking-recipe-editor-page recipe-import-page">
      <Link className="back-link" to={backPath}><ArrowLeft size={16} /> {backLabel}</Link>
      <header className="section-page-heading">
        <div><p className="eyebrow">Recipes · Agent</p><h1>Describe the recipes you want to add.</h1><p>Write in any language. FoodMind converts the recipe data to English, asks only for required missing details, then saves every recipe to your account.</p></div>
        <span className="cooking-mark"><Bot /></span>
      </header>
      <section className="recipe-import-composer">
        <div className="recipe-import-guide">
          <div><Sparkles size={19} /><span><strong>Multiple dishes are welcome.</strong><small>Separate recipes with “---”, a Recipe heading, or Markdown headings.</small></span></div>
          <button type="button" className="text-button" onClick={() => { setText(starterText); setValidationError(null) }}>Use an example</button>
        </div>
        <label htmlFor="recipe-import-text">Recipe text</label>
        <textarea ref={textInput} id="recipe-import-text" className="paste-box" value={text} onChange={(event) => setText(event.target.value)} placeholder="Describe one or more recipes in any language…" aria-describedby="recipe-import-help recipe-import-error" />
        <p id="recipe-import-help" className="section-support">Any language is supported. Recipe fields are saved in English, while your original text and follow-up progress are preserved.</p>
        {(validationError || create.isError) && <div id="recipe-import-error" className="form-alert" role="alert">{validationError || errorMessage(create.error)}</div>}
        <div className="recipe-import-actions"><Link className="secondary-action" to={backPath}>Cancel</Link><button className="primary-action" type="button" disabled={create.isPending} onClick={submit}>{create.isPending ? <><RefreshCw className="spin-icon" size={17} /> Asking the Agent…</> : <><Bot size={17} /> Parse recipes <ArrowRight size={16} /></>}</button></div>
      </section>
    </div>
  )
}

export function RecipeImportSessionPage() {
  const { importId = '' } = useParams()
  const session = useQuery({
    queryKey: queryKeys.recipeImports.detail(importId),
    queryFn: async () => dataOrThrow<ImportSession>(await api.GET('/recipe-imports/{importId}', { params: { path: { importId } } })),
  })

  if (session.isLoading) return <div className="page"><LoadingState label="Opening your recipe import…" /></div>
  if (session.isError) return <div className="page"><ErrorState error={session.error} onRetry={() => void session.refetch()} /></div>
  if (!session.data) return <div className="page"><LoadingState label="Opening your recipe import…" /></div>
  return <RecipeImportSessionView key={session.data.version} session={session.data} />
}

function RecipeImportSessionView({ session }: { session: ImportSession }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(session.answers.map((answer) => [answer.questionId, answer.value])))
  const [formError, setFormError] = useState<string | null>(null)
  const groupedQuestions = useMemo(() => session.drafts.map((draft) => ({
    draft,
    questions: session.questions.filter((question) => question.draftId === draft.draftId),
  })).filter((group) => group.questions.length), [session.drafts, session.questions])

  const answer = useMutation({
    mutationFn: async (body: Schema<'RecipeImportAnswersRequest'>) => dataOrThrow<ImportSession>(await api.POST('/recipe-imports/{importId}/answers', {
      params: { path: { importId: session.importId }, header: { 'If-Match': `"${session.version}"` } },
      body,
    })),
    onSuccess: (updated) => queryClient.setQueryData(queryKeys.recipeImports.detail(updated.importId), updated),
    onError: (error) => setFormError(errorMessage(error)),
  })
  const confirm = useMutation({
    mutationFn: async () => dataOrThrow<ImportSession>(await api.POST('/recipe-imports/{importId}/confirm', {
      params: { path: { importId: session.importId }, header: { 'If-Match': `"${session.version}"` } },
    })),
    onSuccess: (completed) => {
      queryClient.setQueryData(queryKeys.recipeImports.detail(completed.importId), completed)
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipes.list() })
      openCookingSelection(completed)
    },
    onError: (error) => setFormError(errorMessage(error)),
  })

  const openCookingSelection = (completed: ImportSession) => {
    const recipeIds = completed.createdRecipes.map((recipe) => recipe.id)
    if (!recipeIds.length) return setFormError('No saved recipes were returned. Reload the import and try again.')
    navigate(`/cooking?selected=${recipeIds.map(encodeURIComponent).join(',')}`)
  }
  const submitAnswers = () => {
    const values = session.questions.map((question) => ({ questionId: question.questionId, value: (answers[question.questionId] || '').trim() }))
    if (values.some((item) => !item.value)) return setFormError('Answer every required question before continuing.')
    setFormError(null)
    answer.mutate({ answers: values })
  }

  return (
    <div className="page section-page recipe-import-page">
      <Link className="back-link" to="/cooking/import"><ArrowLeft size={16} /> New import</Link>
      <header className="section-page-heading">
        <div><p className="eyebrow">Agent import · {session.status.toLowerCase().replaceAll('_', ' ')}</p><h1>{session.status === 'NEEDS_CLARIFICATION' ? 'A few details will finish these recipes.' : session.status === 'COMPLETED' ? 'Your recipes are saved.' : 'Review recipes before saving.'}</h1><p>Your progress is stored in Backend and survives a reload.</p></div>
        <span className="cooking-mark">{session.status === 'COMPLETED' ? <Check /> : <Bot />}</span>
      </header>

      <section className="recipe-import-draft-grid" aria-label="Parsed recipe drafts">
        {session.drafts.map((draft, index) => <ImportDraftCard draft={draft} index={index} key={draft.draftId} />)}
      </section>

      {session.status === 'NEEDS_CLARIFICATION' && <section className="recipe-import-questions">
        <div className="section-topline"><div><p className="eyebrow">Agent follow-up</p><h2>Complete the missing details</h2></div><span className="status-chip"><Bot size={14} /> {session.questions.length} question{session.questions.length === 1 ? '' : 's'}</span></div>
        {groupedQuestions.map(({ draft, questions }) => <QuestionGroup draft={draft} questions={questions} answers={answers} onChange={(questionId, value) => setAnswers((current) => ({ ...current, [questionId]: value }))} key={draft.draftId} />)}
        <div className="recipe-import-actions"><Link className="secondary-action" to="/cooking">Finish later</Link><button className="primary-action" type="button" disabled={answer.isPending} onClick={submitAnswers}>{answer.isPending ? 'Checking answers…' : <>Continue <ArrowRight size={16} /></>}</button></div>
      </section>}

      {session.status === 'READY' && <section className="recipe-import-ready"><div><Check size={20} /><span><strong>Every recipe is ready to save.</strong><small>Nothing is written to your recipe library until you confirm.</small></span></div><button className="primary-action" type="button" disabled={confirm.isPending} onClick={() => confirm.mutate()}>{confirm.isPending ? 'Saving recipes…' : <><ChefHat size={17} /> Save recipes and choose for cooking</>}</button></section>}
      {session.status === 'COMPLETED' && <section className="recipe-import-ready"><div><ListChecks size={20} /><span><strong>{session.createdRecipes.length} recipe{session.createdRecipes.length === 1 ? '' : 's'} saved to Backend.</strong><small>You can now review the selection and servings before generating a plan.</small></span></div><button className="primary-action" type="button" onClick={() => openCookingSelection(session)}><ChefHat size={17} /> Choose recipes for cooking</button></section>}
      {session.status === 'PROCESSING' && <LoadingState label="The Agent is parsing your recipes…" />}
      {session.status === 'FAILED' && <div className="form-alert" role="alert">{session.failureMessage || 'This recipe import could not be completed.'}</div>}
      {formError && <div className="form-alert" role="alert">{formError}</div>}
    </div>
  )
}

function ImportDraftCard({ draft, index }: { draft: ImportDraft; index: number }) {
  return <article className="recipe-import-draft"><div className={`recipe-import-draft-number tone-${index % 3}`}>{index + 1}</div><div><p className="eyebrow">{draft.servings ? <><Users size={13} /> {draft.servings} servings</> : 'Servings needed'}</p><h2>{draft.name || 'Dish name needed'}</h2><p>{draft.ingredients.length} ingredients · {draft.steps.length} steps</p><small>{draft.ingredients.slice(0, 3).join(' · ') || 'Ingredients needed'}</small></div></article>
}

function QuestionGroup({ draft, questions, answers, onChange }: { draft: ImportDraft; questions: ImportQuestion[]; answers: Record<string, string>; onChange: (questionId: string, value: string) => void }) {
  return <fieldset className="recipe-import-question-group"><legend>{draft.name || 'Unnamed dish'}</legend>{questions.map((question) => <label key={question.questionId}>{question.prompt}{question.fieldPath === 'ingredients' || question.fieldPath === 'steps' ? <textarea rows={5} value={answers[question.questionId] || ''} onChange={(event) => onChange(question.questionId, event.target.value)} placeholder="One item per line" /> : <input inputMode={question.fieldPath === 'servings' ? 'numeric' : 'text'} value={answers[question.questionId] || ''} onChange={(event) => onChange(question.questionId, event.target.value)} />}</label>)}</fieldset>
}
