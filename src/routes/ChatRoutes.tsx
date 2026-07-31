import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowLeft, ArrowRight, Bot, Link2, MessageCircle, Plus, Search, Send, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { formatDateTime, sentenceCase } from '../lib/format'

function useChatSessions() {
  return useQuery({ queryKey: queryKeys.chat.sessions(), queryFn: async () => dataOrThrow<Schema<'ChatSessionPageResponse'>>(await api.GET('/chat/sessions', { params: { query: { page: 0, size: 50 } } })) })
}

export function ChatIndexPage() {
  const sessions = useChatSessions()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const create = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'ChatSessionResponse'>>(await api.POST('/chat/sessions', { body: { title: title || null } })),
    onSuccess: (session) => { void queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() }); navigate(`/chat/${session.id}`) },
  })
  return <div className="page section-page"><header className="section-page-heading"><div><p className="eyebrow">Grounded FoodMind help</p><h1>Chat</h1><p>Search, summarise, compare, or navigate authorised FoodMind content. Recommendation and Cooking stay in their dedicated flows.</p></div><button className="primary-action" type="button" onClick={() => setCreating(true)}><Plus size={17} /> New chat</button></header>{creating && <section className="drawer-card"><label>Conversation title<input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Compare saved lunch options" /></label>{create.isError && <div className="form-alert">{errorMessage(create.error)}</div>}<div className="form-actions"><button className="secondary-action" type="button" onClick={() => setCreating(false)}>Cancel</button><button className="primary-action" type="button" onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Start chat'}</button></div></section>}{sessions.isLoading && <LoadingState label="Loading your conversations…" />}{sessions.isError && <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />}{sessions.isSuccess && !sessions.data.items.length && <EmptyState title="Start a grounded conversation" message="Create a session, optionally attach authorised FoodMind sources, and choose the kind of help you need." action={<button className="primary-action" type="button" onClick={() => setCreating(true)}>New chat</button>} />}<section className="chat-session-grid">{sessions.data?.items.map((session) => <Link className="chat-session-card" to={`/chat/${session.id}`} key={session.id}><span><MessageCircle /></span><div><p className="eyebrow">{sentenceCase(session.status)}</p><h2>{session.title || 'Untitled conversation'}</h2><p>Updated {formatDateTime(session.updatedAt)}</p></div><ArrowRight size={17} /></Link>)}</section></div>
}

function sourceDestination(type: string, id: string) {
  if (type === 'FOOD_RECORD') return `/records/food/${id}`
  if (type === 'FOOD_PRODUCT') return `/catalogue/product/${id}`
  return `/catalogue/place/${id}`
}

export function ChatConversationPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const sessions = useChatSessions()
  const session = useQuery({ queryKey: queryKeys.chat.detail(sessionId), queryFn: async () => dataOrThrow<Schema<'ChatSessionResponse'>>(await api.GET('/chat/sessions/{sessionId}', { params: { path: { sessionId } } })) })
  const messages = useInfiniteQuery({
    queryKey: queryKeys.chat.messages(sessionId), initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => dataOrThrow<Schema<'ChatMessagePageResponse'>>(await api.GET('/chat/sessions/{sessionId}/messages', { params: { path: { sessionId }, query: { after: pageParam, size: 30 } } })),
    getNextPageParam: (page) => page.nextCursor || undefined,
  })
  const [content, setContent] = useState('')
  const [route, setRoute] = useState<NonNullable<Schema<'PostChatMessageRequest'>['route']>>('SEARCH')
  const [showSources, setShowSources] = useState(false)
  const [sourceQuery, setSourceQuery] = useState('')
  const sourceSearch = useQuery({
    queryKey: queryKeys.explore.search({ q: sourceQuery }), enabled: sourceQuery.trim().length >= 2,
    queryFn: async () => dataOrThrow<Schema<'SearchPageResponse'>>(await api.GET('/search', { params: { query: { q: sourceQuery.trim(), page: 0, size: 10 } } })),
  })
  const send = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'ChatMessageResponse'>>(await api.POST('/chat/sessions/{sessionId}/messages', { body: { content: content.trim(), route }, params: { path: { sessionId } } })),
    onSuccess: () => { setContent(''); void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(sessionId) }); void queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() }) },
  })
  const attach = useMutation({
    mutationFn: async (source: Schema<'SearchResultResponse'>) => dataOrThrow<Schema<'ChatReferenceResponse'>>(await api.POST('/chat/sessions/{sessionId}/references', { body: { sourceType: source.sourceType, sourceId: source.sourceId }, params: { path: { sessionId } } })),
    onSuccess: (reference) => showToast(reference.available ? 'Source attached to this conversation.' : 'The source is no longer available.', reference.available ? 'success' : 'error'),
  })
  const archive = useMutation({
    mutationFn: async () => dataOrThrow<void>(await api.DELETE('/chat/sessions/{sessionId}', { params: { path: { sessionId } } })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() }); showToast('Conversation archived.'); navigate('/chat') },
  })
  const allMessages = messages.data?.pages.flatMap((page) => page.items) || []

  if (session.isLoading) return <div className="page"><LoadingState label="Opening the conversation…" /></div>
  if (session.isError) return <div className="page"><ErrorState error={session.error} onRetry={() => void session.refetch()} /></div>
  return (
    <div className="chat-layout page">
      <aside className="chat-sidebar"><div className="section-topline"><div><p className="eyebrow">Conversations</p><h2>FoodMind Chat</h2></div><Link className="icon-button" to="/chat" aria-label="New or all chats"><Plus size={18} /></Link></div><div className="chat-sidebar-list">{sessions.data?.items.map((item) => <Link className={item.id === sessionId ? 'active' : ''} to={`/chat/${item.id}`} key={item.id}><strong>{item.title || 'Untitled conversation'}</strong><small>{formatDateTime(item.updatedAt)}</small></Link>)}</div></aside>
      <section className="conversation-panel"><header className="conversation-header"><div><Link className="mobile-chat-back" to="/chat"><ArrowLeft size={16} /> Chats</Link><p className="eyebrow">Grounded conversation</p><h1>{session.data?.title || 'Untitled conversation'}</h1></div><button className="icon-button" type="button" aria-label="Archive this conversation" disabled={archive.isPending} onClick={() => archive.mutate()}><Archive size={18} /></button></header>
        <div className="route-guide" aria-label="Supported chat routes"><span>Search</span><span>Summary</span><span>Compare</span><span>Navigation</span><span>Out of Scope</span></div>
        <div className="message-list" aria-live="polite">{messages.isLoading && <LoadingState label="Loading messages…" />}{messages.isError && <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />}{messages.isSuccess && allMessages.length === 0 && <EmptyState title="What can FoodMind help you find?" message="Attach authorised sources if useful, choose a route, and ask a bounded question." />}{messages.hasNextPage && <button className="text-button" type="button" onClick={() => void messages.fetchNextPage()}>Load earlier messages</button>}{allMessages.map((message) => <article className={`message ${message.role.toLowerCase()}`} key={message.id}><span className="message-avatar">{message.role === 'ASSISTANT' ? <Bot size={18} /> : <UserRound size={18} />}</span><div><div className="message-meta"><strong>{message.role === 'ASSISTANT' ? 'FoodMind' : 'You'}</strong><span>{message.route ? sentenceCase(message.route) : ''}{message.responseStatus ? ` · ${sentenceCase(message.responseStatus)}` : ''}</span></div><p>{message.content}</p>{message.sources.length > 0 && <div className="message-sources">{message.sources.map((source) => <Link to={sourceDestination(source.sourceType, source.sourceId)} key={source.referenceId}><Link2 size={14} /><span><strong>{source.title || sentenceCase(source.sourceType)}</strong><small>{source.snippet || 'Open to recheck availability and permission.'}</small></span></Link>)}</div>}</div></article>)}</div>
        {showSources && <section className="source-picker"><div className="section-topline"><div><p className="eyebrow">Authorised grounding</p><h2>Attach a FoodMind source</h2></div><button className="text-button" type="button" onClick={() => setShowSources(false)}>Done</button></div><label className="explore-search"><Search size={17} /><span className="sr-only">Search sources</span><input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Search records, products, or places" /></label>{sourceSearch.isLoading && <LoadingState label="Searching sources…" />}{sourceSearch.isError && <ErrorState error={sourceSearch.error} />}{sourceSearch.data?.items.map((source) => <div className="source-result" key={`${source.sourceType}-${source.sourceId}`}><div><strong>{source.title}</strong><small>{source.subtitle || sentenceCase(source.sourceType)}</small></div><button className="secondary-action" type="button" disabled={attach.isPending} onClick={() => attach.mutate(source)}>Attach</button></div>)}{attach.isError && <div className="inline-error">{errorMessage(attach.error)}</div>}</section>}
        <form className="message-composer" onSubmit={(event) => { event.preventDefault(); if (content.trim()) send.mutate() }}><button className="icon-button" type="button" aria-label="Attach authorised source" onClick={() => setShowSources((shown) => !shown)}><Link2 size={18} /></button><label><span className="sr-only">Chat route</span><select value={route} onChange={(event) => setRoute(event.target.value as typeof route)}><option value="SEARCH">Search</option><option value="SUMMARY">Summary</option><option value="COMPARE">Compare</option><option value="NAVIGATION">Navigation</option><option value="OUT_OF_SCOPE">Out of Scope</option></select></label><label className="message-input"><span className="sr-only">Message</span><textarea rows={1} maxLength={4_000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Ask about authorised FoodMind content…" /></label><button className="send-button" type="submit" aria-label="Send message" disabled={!content.trim() || send.isPending}><Send size={18} /></button></form>{send.isError && <div className="composer-error" role="alert">{errorMessage(send.error)}</div>}
      </section>
    </div>
  )
}
