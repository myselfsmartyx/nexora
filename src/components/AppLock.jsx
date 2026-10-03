import { useCallback, useEffect, useRef, useState } from 'react'
import { Delete } from 'lucide-react'
import { isLockEnabled, lockPinLength, verifyPin, LOCK_EVENT } from '../lib/appLock.js'

const RELOCK_AFTER_MS = 60 * 1000 // lock again if the app was in the background this long

function LockScreen({ userId, onUnlock, onForgot }) {
  const len = lockPinLength(userId)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [shake, setShake] = useState(false)
  const [wait, setWait] = useState(0)
  const pinRef = useRef('') // source of truth, so we never verify twice in StrictMode

  // Countdown after too many wrong attempts
  useEffect(() => {
    if (wait <= 0) return undefined
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000)
    return () => clearInterval(t)
  }, [wait])

  const submit = useCallback(
    async (value) => {
      setBusy(true)
      const r = await verifyPin(userId, value)
      setBusy(false)
      if (r.ok) {
        onUnlock()
        return
      }
      pinRef.current = ''
      setPin('')
      setShake(true)
      setTimeout(() => setShake(false), 400)
      if (r.wait) {
        setWait(r.wait)
        setMsg('Too many attempts.')
      } else {
        setMsg('Wrong PIN')
      }
    },
    [userId, onUnlock]
  )

  const press = useCallback(
    (d) => {
      if (busy || wait > 0 || pinRef.current.length >= len) return
      setMsg('')
      const next = pinRef.current + d
      pinRef.current = next
      setPin(next)
      if (next.length === len) submit(next)
    },
    [busy, wait, len, submit]
  )

  const back = useCallback(() => {
    if (busy) return
    pinRef.current = pinRef.current.slice(0, -1)
    setPin(pinRef.current)
  }, [busy])

  // Hardware keyboard support
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, back])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

  return (
    <div className="min-h-screen bg-base-bg flex flex-col items-center justify-center px-lg">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-base-bg text-h1 font-extrabold shadow-glow">
        N
      </div>
      <h1 className="text-h2 text-ink-primary mt-lg">Enter your PIN</h1>
      <p className={`text-body-small mt-xs h-5 ${msg ? 'text-error' : 'text-ink-secondary'}`}>
        {wait > 0 ? `Try again in ${wait}s` : msg || 'Nexora is locked'}
      </p>

      <div className={`flex gap-3 my-lg ${shake ? 'animate-shake' : ''}`} aria-label={`${pin.length} of ${len} digits entered`}>
        {Array.from({ length: len }).map((_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full border transition-colors ${
              i < pin.length ? 'bg-primary border-primary' : 'border-base-border'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              onClick={() => (k === 'back' ? back() : press(k))}
              disabled={busy || (wait > 0 && k !== 'back')}
              aria-label={k === 'back' ? 'Delete' : k}
              className="h-16 rounded-full bg-base-surface border border-base-border text-h2 text-ink-primary flex items-center justify-center active:scale-95 active:bg-base-elevated transition disabled:opacity-40"
            >
              {k === 'back' ? <Delete size={22} /> : k}
            </button>
          )
        )}
      </div>

      <button onClick={onForgot} className="mt-xl text-body-small text-ink-secondary hover:text-primary transition-colors">
        Forgot PIN? Sign out
      </button>
    </div>
  )
}

export default function AppLock({ userId, onForgot, children }) {
  const [locked, setLocked] = useState(() => isLockEnabled(userId))
  const hiddenAt = useRef(null)

  // Lock again after the app was backgrounded for a while
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now()
        return
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0
      hiddenAt.current = null
      if (away > RELOCK_AFTER_MS && isLockEnabled(userId)) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [userId])

  // Turning the lock off in Settings must unlock immediately
  useEffect(() => {
    const onChange = () => {
      if (!isLockEnabled(userId)) setLocked(false)
    }
    window.addEventListener(LOCK_EVENT, onChange)
    return () => window.removeEventListener(LOCK_EVENT, onChange)
  }, [userId])

  if (locked) {
    return <LockScreen userId={userId} onUnlock={() => setLocked(false)} onForgot={onForgot} />
  }
  return children
}
