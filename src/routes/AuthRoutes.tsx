import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Leaf, LoaderCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../app/providers/AuthProvider'
import { ApiError, isSafeReturnPath } from '../lib/api/client'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

const registrationSchema = loginSchema.extend({
  displayName: z.string().trim().min(2, 'Use at least 2 characters.').max(100),
  password: z.string().min(8, 'Use at least 8 characters.').max(128),
  timeZone: z.string().min(1),
  privacyConsentAccepted: z.boolean().refine((accepted) => accepted, {
    message: 'You must agree before creating an account.',
  }),
})

type LoginForm = z.infer<typeof loginSchema>
type RegistrationForm = z.infer<typeof registrationSchema>

const PRIVACY_POLICY_SECTIONS = [
  { heading: 'What we collect', body: 'We collect your account details (display name and email), the food preferences you set, your meal and cooking history, content you upload, and your location only when you choose to share it.' },
  { heading: 'How we use your information', body: 'We use this information to personalise recommendations, build cooking plans, keep your records in sync across devices, and improve the FoodMind service.' },
  { heading: 'Food preferences & history', body: 'Your liked and disliked cuisines, allergens, dietary requirements, meal logs, ratings, saves, skips, and repeats help FoodMind learn what works for you.' },
  { heading: 'Uploaded content', body: 'Photos and notes you attach to your records are stored to support your history and are only visible to you unless you share them with a group you trust.' },
  { heading: 'Location data', body: 'Location is used only when you allow it, to filter nearby restaurants and delivery options. We never log your location in access or audit logs.' },
  { heading: 'Sharing & protection', body: 'We do not sell your personal data. Data is shared only with services that help us run FoodMind, under strict data-protection terms, and within groups you explicitly join.' },
  { heading: 'Data retention & your rights', body: 'You may access, correct, export, or delete your data at any time. Signing out clears your local private cache, and your tokens are never written to logs.' },
  { heading: 'Contact', body: 'Questions about this policy or your data can be sent to privacy@foodmind.example.' },
]

function AuthLayout({ eyebrow, title, support, children }: { eyebrow: string; title: string; support: string; children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About FoodMind">
        <Link className="brand auth-brand" to="/"><span className="brand-mark"><Leaf size={19} /></span><span>FoodMind</span></Link>
        <div>
          <p className="eyebrow">Decide with confidence</p>
          <h1>Less scrolling.<br />More good meals.</h1>
          <p>FoodMind connects your real food history, trusted groups, and tonight's needs—then gives you one clear place to start.</p>
        </div>
        <p className="auth-privacy">Your records and groups stay permission-controlled.</p>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{support}</p>{children}
        </div>
      </section>
    </main>
  )
}

function PrivacyPolicyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (dialog.open && typeof dialog.close === 'function') {
      dialog.close()
    }
  }, [open])
  return (
    <dialog ref={dialogRef} className="privacy-overlay" aria-labelledby="privacy-dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="privacy-dialog">
        <header className="privacy-dialog-header">
          <h2 id="privacy-dialog-title">Privacy Policy</h2>
          <button className="privacy-close" type="button" aria-label="Close privacy policy" autoFocus onClick={onClose}><X size={21} /></button>
        </header>
        <div className="privacy-body">
          {PRIVACY_POLICY_SECTIONS.map((section) => (
            <section key={section.heading}>
              <h3>{section.heading}</h3>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </section>
    </dialog>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login({ ...values, deviceLabel: 'FoodMind Web' })
      const returnTo = searchParams.get('returnTo')
      navigate(isSafeReturnPath(returnTo) ? returnTo : '/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        error.fieldErrors.forEach((fieldError) => {
          if (fieldError.field === 'email' || fieldError.field === 'password') setError(fieldError.field, { message: fieldError.message })
        })
      }
      setFormError(error instanceof Error ? error.message : 'Sign in failed.')
    }
  })

  return (
    <AuthLayout eyebrow="Welcome back" title="Sign in to FoodMind" support="Return to your recommendations, groups, and food history.">
      <form className="stack-form" onSubmit={submit} noValidate>
        {formError && <div className="form-alert" role="alert">{formError}</div>}
        <label>Email<input type="email" autoComplete="email" {...register('email')} aria-invalid={Boolean(errors.email)} />{errors.email && <small>{errors.email.message}</small>}</label>
        <label>Password<input type="password" autoComplete="current-password" {...register('password')} aria-invalid={Boolean(errors.password)} />{errors.password && <small>{errors.password.message}</small>}</label>
        <button className="generate-button" type="submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle className="spin" size={19} /> Signing in…</> : <>Sign in <ArrowRight size={18} /></>}</button>
      </form>
      <p className="auth-switch">New to FoodMind? <Link to="/register">Create an account</Link></p>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const { register: registerAccount } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Singapore',
      privacyConsentAccepted: false,
    },
  })

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const { privacyConsentAccepted: _privacyConsentAccepted, ...registration } = values
      await registerAccount({ ...registration, deviceLabel: 'FoodMind Web' })
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        error.fieldErrors.forEach((fieldError) => {
          if (['email', 'displayName', 'password', 'timeZone'].includes(fieldError.field)) {
            setError(fieldError.field as keyof RegistrationForm, { message: fieldError.message })
          }
        })
      }
      setFormError(error instanceof Error ? error.message : 'Registration failed.')
    }
  })

  return (
    <AuthLayout eyebrow="Start your food story" title="Create your account" support="A few details now, better decisions from your first meal onward.">
      <form className="stack-form" onSubmit={submit} noValidate>
        {formError && <div className="form-alert" role="alert">{formError}</div>}
        <label>Display name<input autoComplete="name" {...register('displayName')} aria-invalid={Boolean(errors.displayName)} />{errors.displayName && <small>{errors.displayName.message}</small>}</label>
        <label>Email<input type="email" autoComplete="email" {...register('email')} aria-invalid={Boolean(errors.email)} />{errors.email && <small>{errors.email.message}</small>}</label>
        <label>Password<input type="password" autoComplete="new-password" {...register('password')} aria-invalid={Boolean(errors.password)} />{errors.password && <small>{errors.password.message}</small>}</label>
        <label>Time zone<input {...register('timeZone')} aria-invalid={Boolean(errors.timeZone)} />{errors.timeZone && <small>{errors.timeZone.message}</small>}</label>
        <label className="privacy-consent-control">
          <input type="checkbox" {...register('privacyConsentAccepted')} aria-invalid={Boolean(errors.privacyConsentAccepted)} />
          <span>I agree that FoodMind may collect and use my account details, food preferences and history, uploaded content, and location when I allow it, to provide, protect, and improve the service.{' '}<button type="button" className="privacy-link" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setPrivacyOpen(true) }}>Read the Privacy Policy</button></span>
        </label>
        {errors.privacyConsentAccepted && <small className="privacy-consent-error" role="alert">{errors.privacyConsentAccepted.message}</small>}
        <button className="generate-button" type="submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle className="spin" size={19} /> Creating account…</> : <>Create account <ArrowRight size={18} /></>}</button>
      </form>
      <PrivacyPolicyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthLayout>
  )
}
