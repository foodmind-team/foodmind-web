import type { ReactNode } from 'react'
import { ToastProvider } from '../../components/feedback/ToastProvider'
import { AuthProvider } from './AuthProvider'
import { QueryProvider } from './QueryProvider'

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryProvider><AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider></QueryProvider>
}
