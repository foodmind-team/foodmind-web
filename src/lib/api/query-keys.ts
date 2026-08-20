function normalized<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined && entry !== '')
      .map(([key, entry]) => [key, Array.isArray(entry) ? [...entry].sort() : entry]),
  )
}

export const queryKeys = {
  catalogue: {
    reference: () => ['catalogue', 'reference'] as const,
    detail: (type: string, id: string) => ['catalogue', type, id] as const,
  },
  users: {
    me: () => ['users', 'me'] as const,
    preferences: () => ['users', 'preferences'] as const,
  },
  records: {
    history: (filters: Record<string, unknown>) => ['records', 'history', normalized(filters)] as const,
    list: (type: string, filters: Record<string, unknown>) => ['records', type, 'list', normalized(filters)] as const,
    detail: (type: string, id: string) => ['records', type, id] as const,
  },
  groups: {
    list: () => ['groups', 'list'] as const,
    detail: (id: string) => ['groups', id] as const,
    members: (id: string) => ['groups', id, 'members'] as const,
    feed: (id: string) => ['groups', id, 'feed'] as const,
  },
  recommendations: {
    detail: (id: string) => ['recommendations', id] as const,
    history: () => ['recommendations', 'history'] as const,
  },
  saved: {
    list: (page = 0) => ['saved', page] as const,
  },
  explore: {
    feed: (filters: Record<string, unknown>) => ['explore', normalized(filters)] as const,
    search: (filters: Record<string, unknown>) => ['search', normalized(filters)] as const,
  },
  cooking: {
    detail: (id: string) => ['cooking', id] as const,
    history: () => ['cooking', 'history'] as const,
    saved: () => ['cooking', 'saved'] as const,
    execution: (id: string) => ['cooking', id, 'execution'] as const,
    task: (id: string) => ['cooking', id, 'task'] as const,
  },
  recipes: {
    list: () => ['recipes', 'list'] as const,
    detail: (id: string) => ['recipes', id] as const,
  },
  recipeImports: {
    detail: (id: string) => ['recipe-imports', id] as const,
  },
  inventory: {
    list: () => ['inventory', 'lots'] as const,
    detail: (id: string) => ['inventory', 'lots', id] as const,
  },
  shopping: {
    list: (status?: string) => ['shopping', 'lists', status || 'ALL'] as const,
    detail: (id: string) => ['shopping', id] as const,
  },
  chat: {
    sessions: () => ['chat', 'sessions'] as const,
    detail: (id: string) => ['chat', id] as const,
    messages: (id: string) => ['chat', id, 'messages'] as const,
  },
  analytics: {
    dashboard: (filters: Record<string, unknown>) => ['analytics', normalized(filters)] as const,
    recap: (week: string) => ['analytics', 'recap', week] as const,
  },
}
