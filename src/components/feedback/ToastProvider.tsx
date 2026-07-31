import { CheckCircle2, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type Toast = { id: string; message: string; tone: 'success' | 'error' }
type ToastContextValue = { showToast: (message: string, tone?: Toast['tone']) => void }
const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const showToast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4_000)
  }, [])
  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`toast ${toast.tone}`} role="status" key={toast.id}>
            {toast.tone === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components -- colocating the hook keeps the context private.
export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider.')
  return value
}
