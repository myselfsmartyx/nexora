import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const GOOGLE_SVG = (
  <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null) // { type: 'error' | 'success', text }

  async function handleSubmit(e) {
    e.preventDefault()
    setNotice(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setNotice({
          type: 'success',
          text: 'Account created! Check your email to confirm, then sign in.',
        })
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // Session change is picked up by App.jsx → app opens automatically
      }
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setNotice(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setNotice({ type: 'error', text: error.message })
  }

  async function handleForgot() {
    setNotice(null)
    if (!email) {
      setNotice({ type: 'error', text: 'Enter your email above first, then tap Forgot Password.' })
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) {
      setNotice({ type: 'error', text: error.message })
    } else {
      setNotice({ type: 'success', text: 'Password reset email sent — check your inbox.' })
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-md py-2xl">
      <main className="w-full max-w-sm mx-auto flex flex-col space-y-xl">
        {/* Header */}
        <header className="flex flex-col items-center text-center space-y-xs">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-base-bg text-h1 font-extrabold shadow-glow">
            N
          </div>
          <div>
            <h1 className="text-h1 text-ink-primary tracking-tight">Nexora</h1>
            <p className="text-body-small text-ink-secondary mt-xs">
              Your Personal Operating System
            </p>
          </div>
        </header>

        {/* Form */}
        <section className="w-full">
          <form className="space-y-lg flex flex-col" onSubmit={handleSubmit}>
            <div className="space-y-md">
              {/* Email */}
              <div className="relative group input-glow rounded-input transition-all duration-300">
                <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
                  <Mail
                    size={20}
                    className="text-ink-secondary group-focus-within:text-primary transition-colors duration-300"
                  />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="block w-full pl-xl pr-sm py-sm bg-base-surface border border-base-border rounded-input text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-0 transition-colors duration-300 h-12"
                />
              </div>

              {/* Password */}
              <div className="space-y-xs">
                <div className="relative group input-glow rounded-input transition-all duration-300">
                  <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
                    <Lock
                      size={20}
                      className="text-ink-secondary group-focus-within:text-primary transition-colors duration-300"
                    />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="block w-full pl-xl pr-xl py-sm bg-base-surface border border-base-border rounded-input text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-0 transition-colors duration-300 h-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-sm flex items-center text-ink-secondary hover:text-ink-primary transition-colors duration-200"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {mode === 'signin' && (
                  <div className="flex justify-end pt-xs">
                    <button
                      type="button"
                      onClick={handleForgot}
                      className="text-body-small text-primary hover:text-primary-dark transition-colors duration-200"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>
            </div>

            {notice && (
              <p
                className={`text-body-small rounded-input px-md py-sm border ${
                  notice.type === 'error'
                    ? 'text-error border-error/40 bg-error/10'
                    : 'text-primary border-primary/40 bg-primary/10'
                }`}
              >
                {notice.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary h-[56px] rounded-input flex items-center justify-center gap-2 shadow-glow disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center justify-center space-x-sm py-lg">
            <div className="h-px bg-base-border flex-1 opacity-30"></div>
            <span className="text-caption text-ink-tertiary uppercase tracking-wider">OR</span>
            <div className="h-px bg-base-border flex-1 opacity-30"></div>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full bg-base-surface border border-base-border rounded-input flex items-center justify-center space-x-sm hover:bg-base-elevated hover:border-ink-secondary transition-all duration-200 h-[56px] active:scale-[0.98]"
          >
            {GOOGLE_SVG}
            <span className="text-body-small font-semibold text-ink-primary">
              Continue with Google
            </span>
          </button>
        </section>

        {/* Footer */}
        <footer className="flex flex-col items-center space-y-xl pt-lg">
          <p className="text-body text-ink-secondary">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setNotice(null)
              }}
              className="text-primary font-bold hover:text-primary-dark transition-colors duration-200"
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
          <p className="text-caption text-ink-tertiary text-center max-w-[280px]">
            By continuing, you agree to our Terms and Privacy Policy.
          </p>
        </footer>
      </main>
    </div>
  )
}
