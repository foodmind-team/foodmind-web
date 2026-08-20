import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Clipboard, KeyRound, Plus, Send, UserMinus, Users, Utensils, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/States'
import { useToast } from '../components/feedback/ToastProvider'
import { api, dataOrThrow, errorMessage, type Schema } from '../lib/api/client'
import { queryKeys } from '../lib/api/query-keys'
import { formatDateTime, sentenceCase } from '../lib/format'

function useGroups() {
  return useQuery({ queryKey: queryKeys.groups.list(), queryFn: async () => dataOrThrow<Schema<'GroupResponse'>[]>(await api.GET('/groups')) })
}

function GroupFeedRow({ groupId, item }: { groupId: string; item: Schema<'GroupFeedItem'> }) {
  const content = (
    <>
      <span className="feed-icon">{item.sourceType === 'RECOMMENDATION_SHARE' ? <Send size={17} /> : <Utensils size={17} />}</span>
      <div>
        <p className="eyebrow">{item.actorDisplayName || 'Group member'} · {formatDateTime(item.occurredAt)}</p>
        <h3>{item.mealNameSnapshot || 'Shared recommendation'}</h3>
        {item.message && <p>{item.message}</p>}
      </div>
    </>
  )
  const mealName = item.mealNameSnapshot?.trim()
  if (item.sourceType !== 'FOOD_RECORD' || !item.foodRecordId || !mealName) {
    return <article className="feed-row">{content}</article>
  }
  return (
    <Link
      className="feed-row feed-row-link"
      to={`/records/food/${item.foodRecordId}?fromGroup=${encodeURIComponent(groupId)}`}
      aria-label={`Open ${mealName} food record`}
    >
      {content}
      <ArrowRight className="feed-row-arrow" size={17} aria-hidden="true" />
    </Link>
  )
}

export function GroupsPage() {
  const groups = useGroups()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const create = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'GroupResponse'>>(await api.POST('/groups', { body: { name, description: description || null } })),
    onSuccess: (group) => { queryClient.setQueryData<Schema<'GroupResponse'>[]>(queryKeys.groups.list(), (current = []) => [...current, group]); showToast('Group created.'); navigate(`/groups/${group.id}`) },
  })
  return (
    <div className="page section-page">
      <header className="section-page-heading"><div><p className="eyebrow">Trusted decisions</p><h1>Your groups</h1><p>Share records and recommendations with people you know—not a public feed.</p></div><div className="header-button-row"><Link className="secondary-action" to="/groups/join"><KeyRound size={17} /> Join group</Link><button className="primary-action" type="button" onClick={() => setShowCreate(true)}><Plus size={17} /> Create group</button></div></header>
      {showCreate && <section className="drawer-card"><div className="section-topline"><div><p className="eyebrow">New trusted space</p><h2>Create a group</h2></div></div>{create.isError && <div className="form-alert" role="alert">{errorMessage(create.error)}</div>}<div className="form-grid"><label>Group name<input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label><label>Description<textarea rows={3} value={description} maxLength={2_000} onChange={(event) => setDescription(event.target.value)} /></label></div><div className="form-actions"><button className="secondary-action" type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-action" type="button" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Creating…' : 'Create group'}</button></div></section>}
      {groups.isLoading && <LoadingState label="Opening your trusted groups…" />}
      {groups.isError && <ErrorState error={groups.error} onRetry={() => void groups.refetch()} />}
      {groups.isSuccess && groups.data.length === 0 && <EmptyState title="Make the first decision together" message="Create a group or join one with a private invitation token." action={<button className="primary-action" type="button" onClick={() => setShowCreate(true)}>Create group</button>} />}
      <section className="group-list-grid">
        {groups.data?.map((group, index) =>
            <Link className={`group-list-card ${index % 2 ? 'sage' : 'coral'}`} to={`/groups/${group.id}`} key={group.id}>
              <span className="group-list-icon"><Users size={20} /></span>
              <p className="eyebrow">{sentenceCase(group.status)}</p>
              <h2>{group.name}</h2>
              <p>{group.description || 'A private FoodMind decision space.'}</p>
              <span className="card-arrow"><ArrowRight size={17} /></span>
            </Link>)}
      </section>
    </div>
  )
}

export function JoinGroupPage() {
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState(searchParams.get('token') || '')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const join = useMutation({
    mutationFn: async () => {
      const canonical = await api.POST('/group-invitations/join', { body: { token } })
      if (canonical.response.status !== 404 && canonical.response.status !== 405) return dataOrThrow<Schema<'GroupMemberResponse'>>(canonical)
      return dataOrThrow<Schema<'GroupMemberResponse'>>(await api.POST('/groups/join', { body: { token } }))
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.groups.list(), exact: true }); showToast('You joined the group.'); navigate('/groups') },
  })
  return <div className="page section-page narrow-page"><Link className="back-link" to="/groups"><ArrowLeft size={16} /> Groups</Link><header className="section-page-heading"><div><p className="eyebrow">Private invitation</p><h1>Join a trusted group</h1><p>Paste the one-time token shared by a group owner.</p></div></header><section className="card-form"><label>Invitation token<textarea rows={4} value={token} onChange={(event) => setToken(event.target.value.trim())} /></label><p className="field-note">Treat invitation tokens like passwords. FoodMind will never place one in public content.</p>{join.isError && <div className="form-alert" role="alert">{errorMessage(join.error)}</div>}<button className="primary-action" type="button" disabled={!token || join.isPending} onClick={() => join.mutate()}>{join.isPending ? 'Joining…' : <><Check size={17} /> Join group</>}</button></section></div>
}

export function GroupWorkspacePage() {
  const { groupId = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [invitation, setInvitation] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const group = useQuery({ queryKey: queryKeys.groups.detail(groupId), queryFn: async () => dataOrThrow<Schema<'GroupResponse'>>(await api.GET('/groups/{groupId}', { params: { path: { groupId } } })) })
  const members = useQuery({ queryKey: queryKeys.groups.members(groupId), queryFn: async () => dataOrThrow<Schema<'GroupMemberResponse'>[]>(await api.GET('/groups/{groupId}/members', { params: { path: { groupId } } })) })
  const feed = useInfiniteQuery({
    queryKey: queryKeys.groups.feed(groupId), initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => dataOrThrow<Schema<'GroupFeedResponse'>>(await api.GET('/groups/{groupId}/feed', { params: { path: { groupId }, query: { after: pageParam, limit: 20 } } })),
    getNextPageParam: (page) => page.nextCursor || undefined,
  })
  const currentMembership = members.data?.find((member) => member.userId === user?.id)
  const isOwner = currentMembership?.role === 'OWNER'
  const edit = useMutation({
    mutationFn: async (body: Schema<'UpdateGroupRequest'>) => dataOrThrow<Schema<'GroupResponse'>>(await api.PATCH('/groups/{groupId}', { body, params: { path: { groupId } } })),
    onSuccess: (updated) => { queryClient.setQueryData(queryKeys.groups.detail(groupId), updated); void queryClient.invalidateQueries({ queryKey: queryKeys.groups.list(), exact: true }); setEditing(false); setConfirmingArchive(false); showToast(updated.status === 'ARCHIVED' ? 'Group archived.' : 'Group updated.') },
  })
  const invite = useMutation({
    mutationFn: async () => dataOrThrow<Schema<'GroupInvitationResponse'>>(await api.POST('/groups/{groupId}/invitations', { body: { expiresInHours: 72, maxUses: 1 }, params: { path: { groupId } } })),
    onSuccess: (created) => setInvitation(created.token || null),
  })
  const removeMember = useMutation({
    mutationFn: async (userId: string) => dataOrThrow<void>(await api.DELETE('/groups/{groupId}/members/{userId}', { params: { path: { groupId, userId } } })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.groups.members(groupId) }); void queryClient.invalidateQueries({ queryKey: queryKeys.groups.list(), exact: true }); showToast('Membership updated.') },
  })

  if (group.isLoading) return <div className="page"><LoadingState label="Opening this group…" /></div>
  if (group.isError) return <div className="page"><ErrorState error={group.error} onRetry={() => void group.refetch()} /></div>
  const feedItems = feed.data?.pages.flatMap((page) => page.items || []) || []
  return (
    <div className="page section-page">
      <Link className="back-link" to="/groups"><ArrowLeft size={16} /> Your groups</Link>
      <header className="featured-group compact-feature"><div className="featured-group-copy"><span className="group-label"><Users size={15} /> {sentenceCase(group.data?.status)}</span><h1>{group.data?.name}</h1><p>{group.data?.description || 'A private FoodMind decision space.'}</p><div className="header-button-row">{group.data?.status === 'ACTIVE' && <Link className="generate-button small" to={`/?groupId=${groupId}`}><WandSparkles size={18} /> Recommend for this group</Link>}{isOwner && <><button className="secondary-action inverse" type="button" onClick={() => { setName(group.data!.name); setDescription(group.data!.description || ''); setEditing(true) }}>Edit group</button><button className="text-button inverse" type="button" disabled={edit.isPending} onClick={() => group.data?.status === 'ARCHIVED' ? edit.mutate({ status: 'ACTIVE' }) : setConfirmingArchive(true)}>{group.data?.status === 'ARCHIVED' ? 'Reactivate group' : 'Archive group'}</button></>}</div></div><div className="group-privacy-card"><p className="eyebrow">Permission safe</p><h2>Shared here, not everywhere.</h2><p>Only active members can read this workspace and its live feed.</p></div></header>
      {editing && <section className="drawer-card"><h2>Edit group</h2><div className="form-grid"><label>Name<input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label><label>Description<textarea rows={3} value={description} maxLength={2_000} onChange={(event) => setDescription(event.target.value)} /></label></div>{edit.isError && <div className="form-alert">{errorMessage(edit.error)}</div>}<div className="form-actions"><button className="secondary-action" type="button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-action" type="button" onClick={() => edit.mutate({ name, description: description || null })} disabled={!name.trim() || edit.isPending}>Save group</button></div></section>}
      {confirmingArchive && <section className="confirm-panel" role="alert" aria-labelledby="archive-group-title"><h2 id="archive-group-title">Archive this group?</h2><p>New invitations and recommendation actions will stop until an owner reactivates it. Existing history remains permission-controlled.</p><div className="form-actions"><button className="secondary-action" type="button" onClick={() => setConfirmingArchive(false)}>Keep active</button><button className="primary-action danger" type="button" disabled={edit.isPending} onClick={() => edit.mutate({ status: 'ARCHIVED' })}>Archive group</button></div></section>}
      <div className="workspace-grid">
        <section className="workspace-card"><div className="section-topline"><div><p className="eyebrow">Active members</p><h2>{members.data?.length || 0} people</h2></div>{isOwner && group.data?.status === 'ACTIVE' && <button className="text-button" type="button" onClick={() => invite.mutate()} disabled={invite.isPending}><KeyRound size={16} /> Invite</button>}</div>{members.isLoading && <LoadingState label="Loading group members…" />}{members.isError && <ErrorState error={members.error} onRetry={() => void members.refetch()} />}<div className="member-list">{members.data?.map((member) => <div className="member-row" key={member.userId}><span className="member-avatar mint">{(member.displayName || '?').slice(0, 2).toUpperCase()}</span><div><strong>{member.displayName || 'Member'}</strong><small>{sentenceCase(member.role)} · joined {formatDateTime(member.joinedAt)}</small></div>{(isOwner && member.userId !== user?.id) || member.userId === user?.id ? <button className="icon-button" type="button" aria-label={member.userId === user?.id ? 'Leave group' : `Remove ${member.displayName}`} onClick={() => member.userId && removeMember.mutate(member.userId)}><UserMinus size={17} /></button> : null}</div>)}</div>{invitation && <div className="invitation-once" role="status"><strong>Copy this token now—it is shown once.</strong><code>{invitation}</code><button className="secondary-action" type="button" onClick={() => void navigator.clipboard.writeText(invitation).then(() => showToast('Invitation token copied.')).catch(() => showToast('Copy failed. Select the token and copy it manually.'))}><Clipboard size={16} /> Copy token</button></div>}{invite.isError && <div className="inline-error">{errorMessage(invite.error)}</div>}</section>
        <section className="workspace-card feed-card"><div className="section-topline"><div><p className="eyebrow">Group activity</p><h2>Trusted feed</h2></div></div>{feed.isLoading && <LoadingState label="Loading group activity…" />}{feed.isError && <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />}{feed.isSuccess && feedItems.length === 0 && <EmptyState title="Nothing shared yet" message="Add a group-visible record or share a recommendation to begin." />}{feedItems.map((item) => <GroupFeedRow groupId={groupId} item={item} key={`${item.sourceType}-${item.sourceId}`} />)}{feed.hasNextPage && <button className="secondary-action load-more" type="button" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>{feed.isFetchingNextPage ? 'Loading…' : 'Load more activity'}</button>}</section>
      </div>
      {(edit.isError || invite.isError || removeMember.isError) && <div className="soft-warning" role="alert">{errorMessage(edit.error || invite.error || removeMember.error)}</div>}
    </div>
  )
}
