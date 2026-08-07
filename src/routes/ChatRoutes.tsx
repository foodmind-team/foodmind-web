import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowLeft, ArrowRight, Bot, Check, Link2, MessageCircle, Plus, Search, Send, Sparkles, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { formatDateTime, sentenceCase } from '../lib/format'

const CHAT_STARTERS = [
  { title: 'Find a past favourite', detail: 'Search only the FoodMind content you can access.', prompt: 'Find my highest-rated meals and show the sources.' },
  { title: 'Summarise recent meals', detail: 'Turn authorised history into a grounded recap.', prompt: 'Summarise the patterns in my recent food history.' },
  { title: 'Compare saved options', detail: 'Attach two sources, then ask for a factual comparison.', prompt: 'Help me compare two FoodMind sources I attach.' },
  { title: 'Navigate FoodMind', detail: 'Find the right screen for a task without guessing.', prompt: 'Where in FoodMind can I review my eating patterns?' },
] as const

type StartChatInput = { title: string | null; draft?: string }

function useChatSessions() {
  return useQuery({ queryKey: queryKeys.chat.sessions(), queryFn: async () => dataOrThrow<Schema<'ChatSessionPageResponse'>>(await api.GET('/chat/sessions', { params: { query: { page: 0, size: 50 } } })) })
}

function ChatSessionSidebar({ sessions, currentId, creating, onCreate }: { sessions: ReturnType<typeof useChatSessions>; currentId?: string; creating: boolean; onCreate: () => void }) {
  return <aside className="chat-sidebar">
    <div className="chat-sidebar-heading"><div><p className="eyebrow">Messages</p><h2>FoodMind Chat</h2></div><button className="icon-button" type="button" aria-label="Start a new chat" disabled={creating} onClick={onCreate}><Plus size={18} /></button></div>
    <div className="chat-sidebar-list">
      {sessions.isLoading && <LoadingState label="Loading conversations…" />}
      {sessions.isError && <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />}
      {sessions.isSuccess && !sessions.data.items.length && <p className="chat-sidebar-empty">No conversations yet. Start with one of the prompts.</p>}
      {sessions.data?.items.map((item) => <Link className={item.id === currentId ? 'active' : ''} to={`/chat/${item.id}`} key={item.id}><span className="chat-session-avatar"><MessageCircle size={17} /></span><span><strong>{item.title || 'Untitled conversation'}</strong><small>{formatDateTime(item.updatedAt)}</small></span><ArrowRight size={15} /></Link>)}
    </div>
  </aside>
}

export function ChatIndexPage() {
  const sessions = useChatSessions()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [naming, setNaming] = useState(false)
  const create = useMutation({
    mutationFn: async (input: StartChatInput) => dataOrThrow<Schema<'ChatSessionResponse'>>(await api.POST('/chat/sessions', { body: { title: input.title } })),
    onSuccess: (session, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() })
      navigate(`/chat/${session.id}`, { state: { draft: input.draft || '' } })
    },
  })
  const startNamedChat = () => {
    const named = title.trim()
    if (named) create.mutate({ title: named })
  }

  return (
    <div className="chat-layout chat-index-workspace page">
      <ChatSessionSidebar sessions={sessions} creating={create.isPending} onCreate={() => create.mutate({ title: null })} />
      <section className="conversation-panel chat-landing-panel">
        <header className="conversation-header"><div><p className="eyebrow">Grounded FoodMind help</p><h1>Ask FoodMind</h1></div><button className="secondary-action" type="button" onClick={() => setNaming((shown) => !shown)} aria-expanded={naming}>{naming ? 'Close naming' : 'Name a chat'}</button></header>
        <div className="chat-landing-content">
          <span className="chat-landing-mark"><Sparkles size={25} /></span><h2>What would you like help with?</h2><p>Search, summarise, compare, or navigate the FoodMind content you are already authorised to use.</p>
          <div className="chat-landing-scope"><Check size={18} /><span><strong>Permission-aware by design</strong><small>No public internet search, invented recommendations, or permission bypasses.</small></span></div>
          <div className="chat-starter-grid">{CHAT_STARTERS.map((starter) => <button type="button" disabled={create.isPending} onClick={() => create.mutate({ title: starter.title, draft: starter.prompt })} key={starter.title}><span><MessageCircle size={18} /></span><strong>{starter.title}</strong><small>{starter.detail}</small><ArrowRight size={16} /></button>)}</div>
          {naming && <section className="drawer-card compact-chat-create"><label>Conversation title<input value={title} maxLength={160} autoFocus onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Compare saved lunch options" onKeyDown={(event) => { if (event.key === 'Enter') startNamedChat() }} /></label><div className="form-actions"><button className="secondary-action" type="button" onClick={() => setNaming(false)}>Cancel</button><button className="primary-action" type="button" onClick={startNamedChat} disabled={!title.trim() || create.isPending}>Start named chat</button></div></section>}
          {create.isError && <div className="form-alert" role="alert">{errorMessage(create.error)}</div>}
        </div>
      </section>
    </div>
  )
}

function sourceDestination(type: string, id: string) {
  if (type === 'FOOD_RECORD') return `/records/food/${id}`
  if (type === 'FOOD_PRODUCT') return `/catalogue/product/${id}`
  return `/catalogue/place/${id}`
}

export function ChatConversationPage() {
  const { sessionId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const sessions = useChatSessions()
  const session = useQuery({ queryKey: queryKeys.chat.detail(sessionId), queryFn: async () => dataOrThrow<Schema<'ChatSessionResponse'>>(await api.GET('/chat/sessions/{sessionId}', { params: { path: { sessionId } } })) })
  const messages = useInfiniteQuery({
    queryKey: queryKeys.chat.messages(sessionId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => dataOrThrow<Schema<'ChatMessagePageResponse'>>(await api.GET('/chat/sessions/{sessionId}/messages', { params: { path: { sessionId }, query: { after: pageParam, size: 30 } } })),
    getNextPageParam: (page) => page.nextCursor || undefined,
  })
  const initialDraft = (location.state as { draft?: string } | null)?.draft || ''
  const [content, setContent] = useState(initialDraft)
  const [showSources, setShowSources] = useState(false)
  const [sourceQuery, setSourceQuery] = useState('')
  const [attachedSources, setAttachedSources] = useState<Schema<'ChatReferenceResponse'>[]>([])
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const messageEnd = useRef<HTMLDivElement | null>(null)
  const sourceSearch = useQuery({
    queryKey: queryKeys.explore.search({ q: sourceQuery }),
    enabled: sourceQuery.trim().length >= 2,
    queryFn: async () => dataOrThrow<Schema<'SearchPageResponse'>>(await api.GET('/search', { params: { query: { q: sourceQuery.trim(), page: 0, size: 10 } } })),
  })
  const send = useMutation({
    mutationFn: async (message: string) => dataOrThrow<Schema<'ChatMessageResponse'>>(await api.POST('/chat/sessions/{sessionId}/messages', { body: { content: message, referenceIds: attachedSources.map((source) => source.id) }, params: { path: { sessionId } } })),
    onMutate: () => setContent(''),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(sessionId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() }),
      ])
    },
    onError: (_error, message) => setContent((current) => current || message),
  })
  const attach = useMutation({
    mutationFn: async (source: Schema<'SearchResultResponse'>) => dataOrThrow<Schema<'ChatReferenceResponse'>>(await api.POST('/chat/sessions/{sessionId}/references', { body: { sourceType: source.sourceType, sourceId: source.sourceId }, params: { path: { sessionId } } })),
    onSuccess: (reference) => {
      setAttachedSources((current) => current.some((item) => item.id === reference.id) ? current : [...current, reference])
      showToast(reference.available ? 'Source attached to this conversation.' : 'The source is no longer available.', reference.available ? 'success' : 'error')
    },
  })
  const create = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'ChatSessionResponse'>>(await api.POST('/chat/sessions', { body: { title: null } })),
    onSuccess: (created) => { void queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() }); navigate(`/chat/${created.id}`) },
  })
  const archive = useMutation({
    mutationFn: async () => dataOrThrow<void>(await api.DELETE('/chat/sessions/{sessionId}', { params: { path: { sessionId } } })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() }); showToast('Conversation archived.'); navigate('/chat') },
  })
  const allMessages = messages.data?.pages.flatMap((page) => page.items) || []

  useEffect(() => {
    setContent(initialDraft)
    setSourceQuery('')
    setAttachedSources([])
    setShowSources(false)
  }, [initialDraft, sessionId])

  useEffect(() => {
    messageEnd.current?.scrollIntoView?.({ block: 'end' })
  }, [allMessages.length, send.isPending])

  const submitMessage = () => {
    const message = content.trim()
    if (message && !send.isPending) send.mutate(message)
  }
  const handleComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submitMessage()
    }
  }

  if (session.isLoading) return <div className="page"><LoadingState label="Opening the conversation…" /></div>
  if (session.isError) return <div className="page"><ErrorState error={session.error} onRetry={() => void session.refetch()} /></div>
  return (
    <div className="chat-layout page">
      <ChatSessionSidebar sessions={sessions} currentId={sessionId} creating={create.isPending} onCreate={() => create.mutate()} />
      <section className="conversation-panel"><header className="conversation-header"><div><Link className="mobile-chat-back" to="/chat"><ArrowLeft size={16} /> Chats</Link><p className="eyebrow">Grounded conversation</p><h1>{session.data?.title || 'Untitled conversation'}</h1></div><button className="icon-button" type="button" aria-label="Archive this conversation" disabled={archive.isPending} onClick={() => setConfirmingArchive(true)}><Archive size={18} /></button></header>
        <div className="route-guide" aria-label="Supported chatbot capabilities"><strong>FoodMind chooses the right path:</strong><span>Search</span><span>Summary</span><span>Compare</span><span>Navigation</span></div>
        {confirmingArchive && <div className="chat-confirm" role="alert"><div><strong>Archive this conversation?</strong><p>It will leave your active chat list, while its messages and references remain retained by the backend.</p>{archive.isError && <span className="inline-error">{errorMessage(archive.error)}</span>}</div><button className="secondary-action" type="button" onClick={() => setConfirmingArchive(false)}>Cancel</button><button className="primary-action danger" type="button" disabled={archive.isPending} onClick={() => archive.mutate()}>Archive</button></div>}
        <div className="message-list" aria-live="polite">{messages.isLoading && <LoadingState label="Loading messages…" />}{messages.isError && <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />}{messages.isSuccess && allMessages.length === 0 && !send.isPending && <div className="chat-empty"><span><Bot /></span><h2>What can FoodMind help you find?</h2><p>Ask naturally. The backend will select search, summary, comparison, or navigation and keep every answer tied to authorised sources.</p><div className="empty-prompt-grid">{CHAT_STARTERS.map((starter) => <button type="button" onClick={() => setContent(starter.prompt)} key={starter.title}>{starter.title}<ArrowRight size={14} /></button>)}</div></div>}{messages.hasNextPage && <button className="text-button" type="button" onClick={() => void messages.fetchNextPage()}>Load earlier messages</button>}{allMessages.map((message) => <article className={`message ${message.role.toLowerCase()}`} key={message.id}><span className="message-avatar">{message.role === 'ASSISTANT' ? <Bot size={18} /> : <UserRound size={18} />}</span><div><div className="message-meta"><strong>{message.role === 'ASSISTANT' ? 'FoodMind' : 'You'}</strong><span>{message.route ? sentenceCase(message.route) : ''}{message.responseStatus ? ` · ${sentenceCase(message.responseStatus)}` : ''}</span></div><p>{message.content}</p>{message.sources.length > 0 && <div className="message-sources">{message.sources.map((source) => <Link to={sourceDestination(source.sourceType, source.sourceId)} key={source.referenceId}><Link2 size={14} /><span><strong>{source.title || sentenceCase(source.sourceType)}</strong><small>{source.snippet || 'Open to recheck availability and permission.'}</small></span></Link>)}</div>}</div></article>)}{send.isPending && <><article className="message user pending-message"><span className="message-avatar"><UserRound size={18} /></span><div><div className="message-meta"><strong>You</strong><span>Sending</span></div><p>{send.variables}</p></div></article><article className="message assistant thinking-message" role="status"><span className="message-avatar"><Bot size={18} /></span><div><div className="message-meta"><strong>FoodMind</strong><span>Checking authorised sources</span></div><p><span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" /><span className="sr-only">FoodMind is working…</span></p></div></article></>}<div ref={messageEnd} /></div>
        {showSources && <section className="source-picker"><div className="section-topline"><div><p className="eyebrow">Authorised grounding</p><h2>Attach a FoodMind source</h2><p>Attached sources are available to future questions in this conversation.</p></div><button className="icon-button" type="button" aria-label="Close source picker" onClick={() => setShowSources(false)}><X size={17} /></button></div>{attachedSources.length > 0 && <div className="attached-source-list" aria-label="Sources attached during this visit">{attachedSources.map((source) => <span key={source.id}><Check size={13} /> {source.title || sentenceCase(source.sourceType)}</span>)}</div>}<label className="explore-search"><Search size={17} /><span className="sr-only">Search sources</span><input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Search records, products, or places" /></label>{sourceSearch.isLoading && <LoadingState label="Searching sources…" />}{sourceSearch.isError && <ErrorState error={sourceSearch.error} />}{sourceSearch.isSuccess && sourceQuery.trim().length >= 2 && !sourceSearch.data.items.length && <p className="source-empty">No authorised sources match that search.</p>}{sourceSearch.data?.items.map((source) => { const attached = attachedSources.some((item) => item.sourceType === source.sourceType && item.sourceId === source.sourceId); return <div className="source-result" key={`${source.sourceType}-${source.sourceId}`}><div><strong>{source.title}</strong><small>{source.subtitle || sentenceCase(source.sourceType)}</small></div><button className="secondary-action" type="button" disabled={attach.isPending || attached} onClick={() => attach.mutate(source)}>{attached ? 'Attached' : 'Attach'}</button></div> })}{attach.isError && <div className="inline-error" role="alert">{errorMessage(attach.error)}</div>}</section>}
        <form className="message-composer" onSubmit={(event) => { event.preventDefault(); submitMessage() }}><button className={`icon-button${showSources ? ' active' : ''}`} type="button" aria-label="Attach authorised source" aria-expanded={showSources} onClick={() => setShowSources((shown) => !shown)}><Link2 size={18} /></button><label className="message-input"><span className="sr-only">Message</span><textarea rows={1} maxLength={12_000} value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={handleComposerKey} placeholder="Ask about your FoodMind history, places, products, or app navigation…" /></label><span className={`character-count${content.length > 10_000 ? ' visible' : ''}`}>{content.length.toLocaleString()} / 12,000</span><button className="send-button" type="submit" aria-label="Send message" disabled={!content.trim() || send.isPending}><Send size={18} /></button></form>{send.isError && <div className="composer-error" role="alert">{errorMessage(send.error)}</div>}
      </section>
    </div>
  )
}
