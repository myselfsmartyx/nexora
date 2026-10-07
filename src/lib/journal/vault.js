// Vault store: holds the unlocked key IN MEMORY ONLY (never localStorage), auto-locks when idle,
// and lets any screen ask "please unlock" via requestUnlock() — the VaultHost sheet answers it.
import { useSyncExternalStore } from 'react'
import { supabase } from '../supabase.js'
import * as C from './crypto.js'

const IDLE_MS = 10 * 60 * 1000 // lock after 10 min of no vault activity
const HIDDEN_MS = 5 * 60 * 1000 // …or after the tab/app was in the background for 5 min

let state = { userId: null, status: 'unknown', row: null, key: null, prompt: null, promptReason: null }
const listeners = new Set()
const emit = (patch) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const getState = () => state
export const useVault = () => useSyncExternalStore(subscribe, getState)

let idleTimer = null
let hiddenAt = 0
function arm() {
  clearTimeout(idleTimer)
  if (state.key) idleTimer = setTimeout(() => lock(), IDLE_MS)
}
export function touch() {
  if (state.key) arm()
}

export function lock() {
  clearTimeout(idleTimer)
  emit({ key: null, status: state.row ? 'locked' : state.status === 'unknown' ? 'unknown' : 'none' })
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now()
    else if (hiddenAt && Date.now() - hiddenAt > HIDDEN_MS) lock()
  })
}
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') emit({ userId: null, row: null, key: null, status: 'unknown', prompt: null })
})

export function bindUser(userId) {
  if (state.userId && state.userId !== userId) {
    clearTimeout(idleTimer)
    emit({ userId, row: null, key: null, status: 'unknown' })
  } else if (!state.userId) {
    emit({ userId })
  }
}

export async function loadVault(userId = state.userId) {
  const { data, error } = await supabase.from('journal_vault').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  emit({ userId, row: data || null, status: data ? (state.key ? 'unlocked' : 'locked') : 'none' })
  return data
}

// ---- brute-force slowdown (client-side; the real protection is the 600k-round KDF) ----
const FAIL_KEY = 'nexora_vault_fails'
function readFails() {
  try { return JSON.parse(sessionStorage.getItem(FAIL_KEY) || '{"n":0,"until":0}') } catch { return { n: 0, until: 0 } }
}
function writeFails(v) {
  try { sessionStorage.setItem(FAIL_KEY, JSON.stringify(v)) } catch { /* ignore */ }
}
function waitLeft() {
  const f = readFails()
  return f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0
}
function registerFail() {
  const f = readFails()
  const n = f.n + 1
  const until = n >= 5 ? Date.now() + Math.min(30 * 2 ** Math.min(n - 5, 5), 900) * 1000 : 0
  writeFails({ n, until })
  return until ? Math.ceil((until - Date.now()) / 1000) : 0
}

function validPassphrase(p) {
  if (typeof p !== 'string' || p.length < C.MIN_PASSPHRASE) throw new Error(`Use at least ${C.MIN_PASSPHRASE} characters.`)
}

// Returns the recovery key (show it ONCE; it is not stored anywhere in readable form).
export async function setupVault(passphrase) {
  validPassphrase(passphrase)
  const userId = state.userId
  const { row, recoveryKey, key } = await C.createVault(passphrase)
  const { error } = await supabase.from('journal_vault').insert({ user_id: userId, ...row })
  if (error) throw error
  emit({ row: { user_id: userId, ...row }, key, status: 'unlocked' })
  arm()
  return recoveryKey
}

// -> { ok, wait }
export async function unlock(passphrase) {
  const wait = waitLeft()
  if (wait) return { ok: false, wait }
  try {
    const row = state.row || (await loadVault())
    if (!row) return { ok: false, wait: 0, error: 'No vault found.' }
    const master = await C.unwrapMaster(row.wrapped_key, passphrase, row.kdf_salt, row.kdf_iter)
    writeFails({ n: 0, until: 0 })
    emit({ key: master, status: 'unlocked' })
    arm()
    return { ok: true, wait: 0 }
  } catch (err) {
    if (err.message === 'bad_secret') return { ok: false, wait: registerFail() }
    return { ok: false, wait: 0, error: 'Could not unlock. Check your connection and try again.' }
  }
}

// Forgot the passphrase: recovery key + a NEW passphrase. Old entries stay readable.
export async function unlockWithRecovery(recoveryKey, newPassphrase) {
  validPassphrase(newPassphrase)
  const wait = waitLeft()
  if (wait) return { ok: false, wait }
  const row = state.row || (await loadVault())
  try {
    const master = await C.unwrapMaster(row.rec_wrapped_key, C.normalizeRecoveryKey(recoveryKey), row.rec_salt, row.kdf_iter, true)
    const next = await C.wrapWithPassphrase(master, newPassphrase, row.kdf_iter)
    const { error } = await supabase.from('journal_vault').update(next).eq('user_id', state.userId)
    if (error) throw error
    writeFails({ n: 0, until: 0 })
    emit({ row: { ...row, ...next }, key: await C.toUsableKey(master), status: 'unlocked' })
    arm()
    return { ok: true, wait: 0 }
  } catch (err) {
    if (err.message === 'bad_secret') return { ok: false, wait: registerFail(), error: 'That recovery key is not right.' }
    return { ok: false, wait: 0, error: err.message || 'Could not reset. Try again.' }
  }
}

export async function changePassphrase(oldPassphrase, newPassphrase) {
  validPassphrase(newPassphrase)
  const row = state.row || (await loadVault())
  const master = await C.unwrapMaster(row.wrapped_key, oldPassphrase, row.kdf_salt, row.kdf_iter, true)
  const next = await C.wrapWithPassphrase(master, newPassphrase, row.kdf_iter)
  const { error } = await supabase.from('journal_vault').update(next).eq('user_id', state.userId)
  if (error) throw error
  emit({ row: { ...row, ...next }, key: await C.toUsableKey(master), status: 'unlocked' })
  arm()
}

// Issue a fresh recovery key (invalidates the old one). Requires the passphrase.
export async function regenerateRecovery(passphrase) {
  const row = state.row || (await loadVault())
  const master = await C.unwrapMaster(row.wrapped_key, passphrase, row.kdf_salt, row.kdf_iter, true)
  const next = await C.wrapWithNewRecovery(master, row.kdf_iter)
  const { recoveryKey, ...cols } = next
  const { error } = await supabase.from('journal_vault').update(cols).eq('user_id', state.userId)
  if (error) throw error
  emit({ row: { ...row, ...cols } })
  return recoveryKey
}

// Last resort when BOTH secrets are lost: permanently deletes private entries + vault.
export async function resetVault() {
  const { error: e1 } = await supabase.from('journal_entries').delete().eq('user_id', state.userId).eq('is_locked', true)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('journal_vault').delete().eq('user_id', state.userId)
  if (e2) throw e2
  clearTimeout(idleTimer)
  emit({ row: null, key: null, status: 'none' })
}

// ---- encrypt / decrypt entry payloads ----
export async function encryptEntry({ title, content }) {
  if (!state.key) throw new Error('vault_locked')
  touch()
  return C.encryptPayload(state.key, state.userId, { t: title || '', c: content || '' })
}
export async function decryptEntry(payload) {
  if (!state.key) throw new Error('vault_locked')
  touch()
  const o = await C.decryptPayload(state.key, state.userId, payload)
  return { title: o.t || '', content: o.c || '' }
}

// ---- "please unlock" requests (answered by <VaultHost/>) ----
let waiters = []
export async function requestUnlock(reason) {
  if (state.status === 'unlocked') return true
  if (state.status === 'unknown') {
    try { await loadVault() } catch { return false }
    if (state.status === 'unlocked') return true
  }
  return new Promise((resolve) => {
    waiters.push(resolve)
    emit({ prompt: state.status === 'none' ? 'setup' : 'unlock', promptReason: reason || null })
  })
}
export function resolvePrompt(ok) {
  const w = waiters
  waiters = []
  emit({ prompt: null, promptReason: null })
  w.forEach((r) => r(ok))
}
export function openVaultSettings() {
  emit({ prompt: 'settings' })
}
