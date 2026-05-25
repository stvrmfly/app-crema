import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import { labelCls } from '../styles.js'
import { EyeIcon, EyeOffIcon, SpinnerIcon, ChevronRightIcon } from '../components/Icons.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [shaking, setShaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [devOpen, setDevOpen] = useState(false)

  function validate() {
    const next = {}
    if (!form.email.trim()) next.email = 'Email is required'
    else if (!EMAIL_RE.test(form.email)) next.email = 'Enter a valid email'
    if (!form.password) next.password = 'Password is required'
    else if (form.password.length < 8) next.password = 'Password must be at least 8 characters'
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    const v = validate()
    setErrors(v)
    if (Object.keys(v).length) {
      setShaking(true)
      setTimeout(() => setShaking(false), 400)
      return
    }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setForm({ email: '', password: '' })
        navigate('/')
      }, 800)
    }, 600)
  }

  function set(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      if (errors[field]) setErrors((err) => ({ ...err, [field]: undefined }))
    }
  }

  return (
    <>
    <AuthLayout>
      <div className="w-full max-w-[420px]">
        <div
          className={`rounded-2xl border p-8 sm:p-10 ${shaking ? 'animate-shake' : ''}`}
          style={{
            background: 'linear-gradient(180deg, rgb(255,253,249) 0%, rgb(250,247,240) 100%)',
            borderColor: 'rgba(225,219,208,0.6)',
            boxShadow:
              '0 0 0 1px rgba(38,38,36,0.04), 0 2px 4px rgba(38,38,36,0.04), 0 8px 24px rgba(38,38,36,0.06)',
          }}
        >
          <p className="mb-8 animate-fade-in-up text-center text-sm text-ink-secondary">
            Create your account
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="animate-fade-in-up" style={{ animationDelay: '80ms' }}>
              <label className={labelCls}>
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-tertiary outline-none transition-colors duration-[180ms] ${
                  errors.email
                    ? 'border-danger'
                    : 'border-divider focus:ring-2 focus:ring-accent/40 focus:ring-offset-0'
                }`}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-danger">{errors.email}</p>
              )}
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '160ms' }}>
              <label className={labelCls}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Create a password"
                  className={`w-full rounded-xl border bg-white px-4 py-3 pr-12 text-sm text-ink placeholder:text-ink-tertiary outline-none transition-colors duration-[180ms] ${
                    errors.password
                      ? 'border-danger'
                      : 'border-divider focus:ring-2 focus:ring-accent/40 focus:ring-offset-0'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-tertiary transition-colors duration-[180ms] hover:text-ink-secondary"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOffIcon className="w-[18px] h-[18px]" />
                    : <EyeIcon className="w-[18px] h-[18px]" />}
                </button>
              </div>
              {errors.password ? (
                <p className="mt-1.5 text-xs text-danger">{errors.password}</p>
              ) : (
                <p className="mt-1.5 text-xs text-ink-tertiary">At least 8 characters</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className={`btn-press btn-glint flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all duration-300 disabled:cursor-not-allowed ${
                success
                  ? 'animate-btn-success bg-success'
                  : loading
                    ? 'bg-accent opacity-70'
                    : 'animate-fade-in-up bg-accent hover:bg-accent-hover'
              }`}
              style={{ animationDelay: !loading && !success ? '240ms' : undefined }}
            >
              {loading && <SpinnerIcon className="w-4 h-4" />}
              {success && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" className="animate-check-draw" style={{ strokeDasharray: 20 }} />
                </svg>
              )}
              {loading ? 'Creating account…' : success ? 'You\'re all set' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 animate-fade-in-up text-center text-sm text-ink-secondary" style={{ animationDelay: '320ms' }}>
            Already have an account?{' '}
            <Link
              to="/"
              className="font-medium text-accent transition-colors duration-[180ms] hover:text-accent-hover"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>

    {/* Dev tools — fixed to bottom-left of viewport (outside AuthLayout to escape
        transformed ancestors). Gated to dev builds. */}
    {import.meta.env.DEV && (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          type="button"
          onClick={() => setDevOpen((o) => !o)}
          aria-expanded={devOpen}
          className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-ink-tertiary transition-colors duration-[180ms] hover:text-ink-secondary"
        >
          <ChevronRightIcon
            className="w-3 h-3 transition-transform duration-150"
            style={{ transform: devOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          Dev tools
        </button>
        {devOpen && (
          <div className="mt-2 flex animate-fade-in gap-2">
            <button
              type="button"
              onClick={() => {
                setForm({ email: 'demo@crema.app', password: 'password123' })
                setErrors({})
              }}
              className="btn-press rounded-lg border border-divider bg-white px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-ink-secondary transition-colors duration-[180ms] hover:bg-elevated"
            >
              Fill form
            </button>
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="btn-press rounded-lg border border-divider bg-white px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-ink-secondary transition-colors duration-[180ms] hover:bg-elevated"
            >
              Skip login
            </button>
          </div>
        )}
      </div>
    )}
    </>
  )
}

export default RegisterPage
