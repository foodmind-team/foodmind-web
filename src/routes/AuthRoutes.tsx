import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Leaf, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
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
})

type LoginForm = z.infer<typeof loginSchema>
type RegistrationForm = z.infer<typeof registrationSchema>

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
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Singapore' },
  })

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await registerAccount({ ...values, deviceLabel: 'FoodMind Web' })
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
        <button className="generate-button" type="submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle className="spin" size={19} /> Creating account…</> : <>Create account <ArrowRight size={18} /></>}</button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthLayout>
  )
}
