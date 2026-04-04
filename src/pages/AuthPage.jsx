import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  const handle = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(form.email, form.password)
      } else {
        await signUp(form.email, form.password, form.name)
        setSent(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--surface)' }}>
      <div className="w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="mb-10">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
              spendly
            </span>
            <span className="text-sm font-mono" style={{ color: 'var(--ink-4)' }}>₹</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            {mode === 'login' ? 'Welcome back.' : 'Start tracking your spending.'}
          </p>
        </div>

        {sent ? (
          <div className="animate-fade-up rounded-lg border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="text-xl mb-2" aria-hidden="true">✉️</div>
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--ink)' }}>Check your email</h2>
            <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
              We sent a confirmation link to {form.email}. Click it to activate your account.
            </p>
            <p className="text-xs mt-3" style={{ color: 'var(--ink-4)' }}>
              Once confirmed, come back and sign in.
            </p>
            <button
              type="button"
              onClick={() => { setSent(false); setMode('login') }}
              className="mt-4 text-sm underline"
              style={{ color: 'var(--ink-3)' }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            {/* Form */}
            <form onSubmit={handle} className="space-y-3">
              {mode === 'signup' && (
                <div className="animate-fade-up">
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-3)' }}>Name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-all"
                    style={{
                      background: 'var(--surface-2)',
                      borderColor: 'var(--border)',
                      color: 'var(--ink)',
                    }}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-3)' }}>Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  autoFocus={mode === 'login'}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-all"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--border)',
                    color: 'var(--ink)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-3)' }}>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-all"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--border)',
                    color: 'var(--ink)',
                  }}
                />
              </div>

              {error && (
                <p className="text-xs px-3 py-2 rounded-lg animate-fade-in" style={{ color: 'var(--red)', background: 'var(--red-light)' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm font-medium rounded-lg transition-all mt-2"
                style={{
                  background: loading ? 'var(--surface-3)' : 'var(--ink)',
                  color: loading ? 'var(--ink-4)' : 'var(--surface)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            {/* Toggle */}
            <p className="mt-6 text-xs text-center" style={{ color: 'var(--ink-4)' }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
                className="underline"
                style={{ color: 'var(--ink-2)' }}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
