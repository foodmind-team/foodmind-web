import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  api,
  clearAccessSession,
  dataOrThrow,
  getSessionSnapshot,
  refreshAccessSession,
  registerAuthenticationFailureHandler,
  setAccessSession,
  subscribeToSession,
  type Schema,
} from '../../lib/api/client'
import { queryClient } from './QueryProvider'

type User = Schema<'CurrentUserResponse'>
type LoginRequest = Schema<'LoginRequest'>
type RegisterRequest = Schema<'RegisterRequest'>
type AuthStatus = 'checking' | 'anonymous' | 'authenticated'

type AuthContextValue = {
  status: AuthStatus
  user: User | null
  login: (values: Omit<LoginRequest, 'clientType'>) => Promise<void>
  register: (values: Omit<RegisterRequest, 'clientType'>) => Promise<void>
  logout: (all?: boolean) => Promise<void>
  refreshUser: () => Promise<User>
}

const AuthContext = createContext<AuthContextValue | null>(null)
let bootstrapPromise: Promise<User | null> | null = null

async function fetchCurrentUser() {
  const result = await api.GET('/users/me')
  return dataOrThrow<User>(result)
}

function bootstrap() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const refreshed = await refreshAccessSession()
      return refreshed ? fetchCurrentUser() : null
    })()
  }
  return bootstrapPromise
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<User | null>(null)
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, getSessionSnapshot)

  const becomeAnonymous = useCallback(() => {
    clearAccessSession()
    setUser(null)
    setStatus('anonymous')
    queryClient.clear()
  }, [])

  useEffect(() => {
    registerAuthenticationFailureHandler(becomeAnonymous)
    bootstrap()
      .then((currentUser) => {
        setUser(currentUser)
        setStatus(currentUser ? 'authenticated' : 'anonymous')
      })
      .catch(() => {
        bootstrapPromise = null
        becomeAnonymous()
      })
    return () => registerAuthenticationFailureHandler(null)
  }, [becomeAnonymous])

  useEffect(() => {
    if (!session || status !== 'authenticated') return
    const delay = Math.max(1_000, session - Date.now() - 60_000)
    const refresh = () => void refreshAccessSession().then((success) => {
      if (!success) becomeAnonymous()
    })
    const timer = window.setTimeout(refresh, delay)
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && session && session - Date.now() < 60_000) refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [becomeAnonymous, session, status])

  const refreshUser = useCallback(async () => {
    const currentUser = await fetchCurrentUser()
    setUser(currentUser)
    queryClient.setQueryData(['users', 'me'], currentUser)
    return currentUser
  }, [])

  const completeAuthentication = useCallback(async (tokens: Schema<'AuthTokenResponse'>) => {
    setAccessSession(tokens)
    const currentUser = await refreshUser()
    setStatus('authenticated')
    return currentUser
  }, [refreshUser])

  const login = useCallback(async (values: Omit<LoginRequest, 'clientType'>) => {
    const result = await api.POST('/auth/login', { body: { ...values, clientType: 'WEB' } })
    await completeAuthentication(dataOrThrow(result))
  }, [completeAuthentication])

  const register = useCallback(async (values: Omit<RegisterRequest, 'clientType'>) => {
    const result = await api.POST('/auth/register', { body: { ...values, clientType: 'WEB' } })
    await completeAuthentication(dataOrThrow(result))
  }, [completeAuthentication])

  const logout = useCallback(async (all = false) => {
    try {
      if (all) await api.POST('/auth/logout-all')
      else await api.POST('/auth/logout', { body: { clientType: 'WEB' } })
    } finally {
      bootstrapPromise = null
      becomeAnonymous()
    }
  }, [becomeAnonymous])

  const value = useMemo<AuthContextValue>(() => ({ status, user, login, register, logout, refreshUser }), [status, user, login, register, logout, refreshUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- colocating the hook keeps the context private.
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
