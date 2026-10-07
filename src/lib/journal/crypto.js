// End-to-end encryption for private journal entries (WebCrypto, no dependencies).
//
//   passphrase ──PBKDF2(600k, SHA-256)──► KEK ──wraps──► master key (random AES-256-GCM)
//   recovery key ─PBKDF2──────────────► KEK2 ─wraps──►  (same master key)
//   master key encrypts every private entry's {title, content}; only ciphertext reaches Supabase.
//
// The passphrase and the master key never leave the device. Forgetting BOTH the passphrase and
// the recovery key makes private entries unreadable — by design (nobody, including Nexora, can help).

const enc = new TextEncoder()
const dec = new TextDecoder()

export const KDF_ITER = 600000
export const MIN_PASSPHRASE = 8
export const PAYLOAD_PREFIX = 'nxv1.'

export function toB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
  return btoa(s)
}
export function fromB64(b64) {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}
const rand = (n) => crypto.getRandomValues(new Uint8Array(n))

// 25 chars from a 32-letter alphabet (125 bits), shown as XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function generateRecoveryKey() {
  const bytes = rand(25)
  let s = ''
  for (let i = 0; i < 25; i++) s += ALPHABET[bytes[i] % 32] // 256 % 32 === 0 → unbiased
  return s.match(/.{5}/g).join('-')
}
export const normalizeRecoveryKey = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

async function deriveKek(secret, saltB64, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: iter },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  )
}

async function wrap(masterKey, kek) {
  const iv = rand(12)
  const wrapped = await crypto.subtle.wrapKey('raw', masterKey, kek, { name: 'AES-GCM', iv })
  const out = new Uint8Array(12 + wrapped.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(wrapped), 12)
  return toB64(out)
}

export async function unwrapMaster(wrappedB64, secret, saltB64, iter, extractable = false) {
  const kek = await deriveKek(secret, saltB64, iter)
  const data = fromB64(wrappedB64)
  try {
    return await crypto.subtle.unwrapKey(
      'raw', data.subarray(12), kek, { name: 'AES-GCM', iv: data.subarray(0, 12) },
      { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']
    )
  } catch {
    throw new Error('bad_secret')
  }
}

// A non-extractable copy for day-to-day use (so page scripts can't read the raw key back out).
export async function toUsableKey(masterKey) {
  const raw = await crypto.subtle.exportKey('raw', masterKey)
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function createVault(passphrase, iter = KDF_ITER) {
  const master = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const recoveryKey = generateRecoveryKey()
  const kdf_salt = toB64(rand(16))
  const rec_salt = toB64(rand(16))
  const [kek, rkek] = await Promise.all([
    deriveKek(passphrase, kdf_salt, iter),
    deriveKek(normalizeRecoveryKey(recoveryKey), rec_salt, iter),
  ])
  const row = {
    kdf_salt, kdf_iter: iter, rec_salt,
    wrapped_key: await wrap(master, kek),
    rec_wrapped_key: await wrap(master, rkek),
  }
  return { row, recoveryKey, key: await toUsableKey(master) }
}

// Re-wrap an (extractable) master key under a new passphrase.
export async function wrapWithPassphrase(master, passphrase, iter) {
  const kdf_salt = toB64(rand(16))
  const kek = await deriveKek(passphrase, kdf_salt, iter)
  return { kdf_salt, kdf_iter: iter, wrapped_key: await wrap(master, kek) }
}
// Fresh recovery key for the same master key.
export async function wrapWithNewRecovery(master, iter) {
  const recoveryKey = generateRecoveryKey()
  const rec_salt = toB64(rand(16))
  const rkek = await deriveKek(normalizeRecoveryKey(recoveryKey), rec_salt, iter)
  return { recoveryKey, rec_salt, rec_wrapped_key: await wrap(master, rkek) }
}

const aad = (userId) => enc.encode('nexora-journal:' + userId)

export async function encryptPayload(key, userId, obj) {
  const iv = rand(12)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(userId) }, key, enc.encode(JSON.stringify(obj))
  )
  return `${PAYLOAD_PREFIX}${toB64(iv)}.${toB64(ct)}`
}

export async function decryptPayload(key, userId, payload) {
  if (!isEncryptedPayload(payload)) throw new Error('not_encrypted')
  const [ivB64, ctB64] = payload.slice(PAYLOAD_PREFIX.length).split('.')
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64), additionalData: aad(userId) }, key, fromB64(ctB64)
  )
  return JSON.parse(dec.decode(pt))
}
export const isEncryptedPayload = (s) => typeof s === 'string' && s.startsWith(PAYLOAD_PREFIX)
