// App Lock (PIN). Client-side only: it stops someone who picks up your unlocked
// device, it is NOT a substitute for the account password or device encryption.
// The PIN is never stored — only a salted PBKDF2 hash, tied to the signed-in user.

const KEY = 'nexora_lock_v1'
const ITERATIONS = 310000
export const MIN_PIN = 4
export const MAX_PIN = 6
export const LOCK_EVENT = 'nexora-lock-changed'

const enc = new TextEncoder()
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(pin, saltB64, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: iter },
    key,
    256
  )
  return toB64(bits)
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function read(userId) {
  try {
    const rec = JSON.parse(localStorage.getItem(KEY) || 'null')
    return rec && rec.uid === userId ? rec : null
  } catch {
    return null
  }
}
function write(rec) {
  localStorage.setItem(KEY, JSON.stringify(rec))
}
const notifyChange = () => window.dispatchEvent(new Event(LOCK_EVENT))

export const isLockEnabled = (userId) => !!read(userId)
export const lockPinLength = (userId) => read(userId)?.len || MIN_PIN
export const isValidPin = (pin) => new RegExp(`^\\d{${MIN_PIN},${MAX_PIN}}$`).test(pin)

export async function setPin(userId, pin) {
  if (!isValidPin(pin)) throw new Error(`PIN must be ${MIN_PIN}–${MAX_PIN} digits`)
  const salt = toB64(crypto.getRandomValues(new Uint8Array(16)))
  const hash = await derive(pin, salt, ITERATIONS)
  write({ uid: userId, salt, hash, iter: ITERATIONS, len: pin.length, fails: 0, until: 0 })
  notifyChange()
}

export function disableLock() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  notifyChange()
}

// Returns { ok, wait } — wait is seconds the user must wait after repeated failures.
export async function verifyPin(userId, pin) {
  const rec = read(userId)
  if (!rec) return { ok: false, wait: 0 }
  const now = Date.now()
  if (rec.until && rec.until > now) return { ok: false, wait: Math.ceil((rec.until - now) / 1000) }

  const hash = await derive(pin, rec.salt, rec.iter)
  if (safeEqual(hash, rec.hash)) {
    write({ ...rec, fails: 0, until: 0 })
    return { ok: true, wait: 0 }
  }
  const fails = (rec.fails || 0) + 1
  let until = 0
  if (fails >= 5) {
    // 30s, 60s, 2m, 4m, 8m, then capped at 15m
    until = now + Math.min(30 * 2 ** Math.min(fails - 5, 5), 900) * 1000
  }
  write({ ...rec, fails, until })
  return { ok: false, wait: until ? Math.ceil((until - now) / 1000) : 0 }
}
