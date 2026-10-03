import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, User, Palette, Bell, Cloud, ShieldCheck, Info, LogOut,
  Check, Download, Trash2, Smartphone, Monitor, Moon, Sun, RefreshCw, Loader2,
  Wifi, WifiOff,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { ACCENTS, applyTheme } from '../lib/theme.js'
import {
  isLockEnabled, setPin, verifyPin, disableLock, isValidPin, MIN_PIN, MAX_PIN,
} from '../lib/appLock.js'

const APP_VERSION = '0.1.0'

const DEFAULTS = {
  dark_mode: 'system',
  accent_color: '#00d4aa',
  push_notifications: true,
  vocab_reminders: true,
  journal_reminders: true,
  habit_reminders: true,
}
const SETTING_KEYS = Object.keys(DEFAULTS)

const MODES = [
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light', label: 'Light', icon: Sun },
]
const modeLabel = (id) => MODES.find((m) => m.id === id)?.label || 'System'

// ---------- data hook ----------
function useUserSettings(userId) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const ref = useRef(settings)
  ref.current = settings

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('user_settings')
        .select(SETTING_KEYS.join(','))
        .eq('user_id', userId)
        .maybeSingle()
      if (cancelled) return
      if (!error && data) {
        const clean = {}
        SETTING_KEYS.forEach((k) => {
          if (data[k] !== null && data[k] !== undefined) clean[k] = data[k]
        })
        setSettings({ ...DEFAULTS, ...clean })
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  // Optimistic update; rolls back and returns false if saving fails.
  const update = useCallback(
    async (patch) => {
      const prev = ref.current
      setSettings({ ...prev, ...patch })
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
      if (error) {
        console.warn('settings save failed:', error.message)
        setSettings(prev)
        return false
      }
      return true
    },
    [userId]
  )

  return { settings, loading, update }
}

async function readInvokeError(error) {
  try {
    const body = await error.context.json()
    return { message: body?.error || error.message, code: body?.code }
  } catch {
    return { message: error.message }
  }
}

// ---------- small UI pieces ----------
function Group({ children }) {
  return <section className="card overflow-hidden divide-y divide-base-border">{children}</section>
}

function IconBubble({ icon: Icon, tint = 'text-primary' }) {
  return (
    <div className={`w-10 h-10 rounded-full bg-base-elevated border border-base-border flex items-center justify-center shrink-0 ${tint}`}>
      <Icon size={20} />
    </div>
  )
}

function NavRow({ icon, tint, title, subtitle, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-md hover:bg-base-elevated transition-colors text-left">
      <div className="flex items-center gap-md min-w-0">
        <IconBubble icon={icon} tint={tint} />
        <div className="min-w-0">
          <h3 className="text-body text-ink-primary">{title}</h3>
          <p className="text-caption text-ink-secondary truncate">{subtitle}</p>
        </div>
      </div>
      <ChevronRight size={20} className="text-ink-secondary shrink-0" />
    </button>
  )
}

function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 disabled:opacity-40 ${
        checked ? 'bg-primary' : 'bg-base-border'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}

function ToggleRow({ title, subtitle, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-md p-md">
      <div className="min-w-0">
        <h3 className="text-body text-ink-primary">{title}</h3>
        {subtitle && <p className="text-caption text-ink-secondary">{subtitle}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 className="text-caption uppercase tracking-wider text-ink-tertiary px-xs mb-sm">{children}</h2>
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-caption text-ink-secondary mb-xs block">{label}</span>
      {children}
    </label>
  )
}

// ---------- sections ----------
function AccountSection({ session, notify }) {
  const email = session.user.email || ''
  const [name, setName] = useState('')
  const [nameLoaded, setNameLoaded] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [plan, setPlan] = useState('Free')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ data: prof }, { data: sub }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', session.user.id).maybeSingle(),
        supabase.from('subscriptions').select('plan_tier, is_active').eq('user_id', session.user.id).maybeSingle(),
      ])
      if (cancelled) return
      setName(prof?.display_name || '')
      setNameLoaded(true)
      if (sub?.is_active && sub.plan_tier && sub.plan_tier !== 'free') {
        setPlan(sub.plan_tier.charAt(0).toUpperCase() + sub.plan_tier.slice(1))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [session.user.id])

  async function saveName() {
    const clean = name.trim()
    if (!clean || clean.length > 50) {
      notify('Name must be 1–50 characters.')
      return
    }
    setSavingName(true)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, display_name: clean }, { onConflict: 'id' })
    setSavingName(false)
    if (error) notify("Couldn't save your name.")
    else {
      setName(clean)
      notify('Name updated.')
    }
  }

  async function changePassword() {
    if (pw.length < 8) return notify('Use at least 8 characters.')
    if (pw !== pw2) return notify("Passwords don't match.")
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSavingPw(false)
    if (error) notify(error.message)
    else {
      setPw('')
      setPw2('')
      notify('Password updated.')
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <SectionTitle>Profile</SectionTitle>
        <div className="card p-md flex flex-col gap-md">
          <Field label="Email">
            <div className="input opacity-70 select-text">{email}</div>
          </Field>
          <Field label="Display name">
            <input
              className="input"
              value={name}
              maxLength={50}
              disabled={!nameLoaded}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </Field>
          <button onClick={saveName} disabled={savingName || !nameLoaded} className="btn-primary py-3 disabled:opacity-50">
            {savingName ? 'Saving…' : 'Save name'}
          </button>
        </div>
      </div>

      <div>
        <SectionTitle>Plan</SectionTitle>
        <div className="card p-md flex items-center justify-between">
          <div>
            <p className="text-body text-ink-primary">{plan}</p>
            <p className="text-caption text-ink-secondary">
              {plan === 'Free' ? 'Upgrade options are coming soon.' : 'Thanks for supporting Nexora.'}
            </p>
          </div>
          <span className="chip chip-active">{plan}</span>
        </div>
      </div>

      <div>
        <SectionTitle>Change password</SectionTitle>
        <div className="card p-md flex flex-col gap-md">
          <Field label="New password">
            <input type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <input type="password" autoComplete="new-password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <button onClick={changePassword} disabled={savingPw || !pw} className="btn-secondary disabled:opacity-50">
            {savingPw ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        className="btn-secondary flex items-center justify-center gap-sm text-error"
      >
        <LogOut size={18} /> Sign out
      </button>
    </div>
  )
}

function AppearanceSection({ settings, update, notify }) {
  async function save(patch, themeNext) {
    const prevTheme = { mode: settings.dark_mode, accent: settings.accent_color }
    applyTheme(themeNext) // instant preview
    const ok = await update(patch)
    if (!ok) {
      applyTheme(prevTheme)
      notify("Couldn't save that change.")
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <SectionTitle>Theme</SectionTitle>
        <div className="grid grid-cols-3 gap-sm">
          {MODES.map(({ id, label, icon: Icon }) => {
            const active = settings.dark_mode === id
            return (
              <button
                key={id}
                onClick={() => save({ dark_mode: id }, { mode: id, accent: settings.accent_color })}
                aria-pressed={active}
                className={`card p-md flex flex-col items-center gap-sm transition-colors ${
                  active ? 'border-primary text-primary' : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <Icon size={24} />
                <span className="text-body-small">{label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-caption text-ink-tertiary mt-sm px-xs">System follows your device's light/dark setting.</p>
      </div>

      <div>
        <SectionTitle>Accent color</SectionTitle>
        <div className="card p-md flex flex-wrap gap-md">
          {ACCENTS.map(({ hex, label }) => {
            const active = settings.accent_color.toLowerCase() === hex.toLowerCase()
            return (
              <button
                key={hex}
                onClick={() => save({ accent_color: hex.toLowerCase() }, { mode: settings.dark_mode, accent: hex })}
                aria-label={label}
                aria-pressed={active}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90 ${
                  active ? 'ring-2 ring-offset-2 ring-offset-[rgb(var(--c-surface))] ring-ink-primary' : ''
                }`}
                style={{ backgroundColor: hex }}
              >
                {active && <Check size={20} className="text-black/70" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function NotificationsSection({ settings, update, notify }) {
  async function set(key, value) {
    const ok = await update({ [key]: value })
    if (!ok) notify("Couldn't save that change.")
  }
  const off = !settings.push_notifications
  return (
    <div className="flex flex-col gap-lg">
      <Group>
        <ToggleRow
          title="Push notifications"
          subtitle="Master switch for all reminders"
          checked={settings.push_notifications}
          onChange={(v) => set('push_notifications', v)}
        />
      </Group>
      <div>
        <SectionTitle>Reminders</SectionTitle>
        <Group>
          <ToggleRow title="Daily vocabulary" subtitle="Your 10 new words each day" checked={settings.vocab_reminders && !off} disabled={off} onChange={(v) => set('vocab_reminders', v)} />
          <ToggleRow title="Journaling prompts" subtitle="A nudge to reflect" checked={settings.journal_reminders && !off} disabled={off} onChange={(v) => set('journal_reminders', v)} />
          <ToggleRow title="Habits & tasks" subtitle="Scheduled habit reminders" checked={settings.habit_reminders && !off} disabled={off} onChange={(v) => set('habit_reminders', v)} />
        </Group>
      </div>
      <p className="text-caption text-ink-tertiary px-xs">
        Your choices are saved to your account. Reminder delivery starts working once notifications launch in the mobile apps.
      </p>
    </div>
  )
}

// ----- Data & Backup -----
const EXPORT_TABLES = [
  'profiles', 'user_settings', 'knowledge_items', 'journal_entries', 'habits', 'habit_logs',
  'vocabulary_words', 'user_principles', 'free_time_suggestions', 'neuro_plus_scores',
  'ai_conversations', 'ai_messages', 'subscriptions', 'payments',
]

async function fetchAll(table) {
  const rows = []
  for (let from = 0; rows.length < 50000; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order('id', { ascending: true }).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

function csvCell(v) {
  if (v === null || v === undefined) return ''
  let s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v)
  // Stop spreadsheet formula injection (=, +, -, @ at the start of a cell)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\r\n')
}
function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function DataSection({ session, notify }) {
  const [busy, setBusy] = useState('')
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [checking, setChecking] = useState(false)
  const [lastCheck, setLastCheck] = useState(null)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  async function checkSync() {
    setChecking(true)
    const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' })
    setChecking(false)
    if (error) notify("Couldn't reach your cloud storage.")
    else setLastCheck(new Date())
  }
  useEffect(() => {
    checkSync()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stamp = new Date().toISOString().slice(0, 10)

  async function exportJson() {
    setBusy('json')
    try {
      const out = {
        app: 'Nexora',
        exported_at: new Date().toISOString(),
        account: { id: session.user.id, email: session.user.email },
        data: {},
      }
      for (const t of EXPORT_TABLES) out.data[t] = await fetchAll(t)
      download(`nexora-export-${stamp}.json`, JSON.stringify(out, null, 2), 'application/json')
      notify('Export ready.')
    } catch (err) {
      console.warn('export failed:', err.message)
      notify('Export failed. Please try again.')
    } finally {
      setBusy('')
    }
  }

  async function exportCsv(kind) {
    setBusy(kind)
    try {
      if (kind === 'knowledge') {
        const rows = await fetchAll('knowledge_items')
        download(`nexora-knowledge-${stamp}.csv`,
          toCsv(rows, ['captured_at', 'title', 'category', 'source_type', 'source_url', 'tags', 'content']), 'text/csv')
      } else {
        const rows = await fetchAll('journal_entries')
        download(`nexora-journal-${stamp}.csv`,
          toCsv(rows, ['entry_date', 'title', 'mood', 'category', 'tags', 'content']), 'text/csv')
      }
      notify('Export ready.')
    } catch (err) {
      console.warn('export failed:', err.message)
      notify('Export failed. Please try again.')
    } finally {
      setBusy('')
    }
  }

  const ExportRow = ({ id, title, subtitle, onClick }) => (
    <button onClick={onClick} disabled={!!busy} className="w-full flex items-center justify-between p-md hover:bg-base-elevated transition-colors text-left disabled:opacity-60">
      <div>
        <h3 className="text-body text-ink-primary">{title}</h3>
        <p className="text-caption text-ink-secondary">{subtitle}</p>
      </div>
      {busy === id ? <Loader2 size={20} className="animate-spin text-primary" /> : <Download size={20} className="text-ink-secondary" />}
    </button>
  )

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <SectionTitle>Sync status</SectionTitle>
        <div className="card p-md flex items-center justify-between gap-md">
          <div className="flex items-center gap-md">
            <IconBubble icon={online ? Wifi : WifiOff} tint={online ? 'text-success' : 'text-warning'} />
            <div>
              <p className="text-body text-ink-primary">{online ? 'Synced to your cloud' : 'You are offline'}</p>
              <p className="text-caption text-ink-secondary">
                {online
                  ? lastCheck ? `Last checked ${lastCheck.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Checking…'
                  : 'Changes need a connection'}
              </p>
            </div>
          </div>
          <button onClick={checkSync} disabled={checking || !online} aria-label="Check sync now" className="text-ink-secondary hover:text-primary disabled:opacity-40">
            <RefreshCw size={20} className={checking ? 'animate-spin' : ''} />
          </button>
        </div>
        <p className="text-caption text-ink-tertiary mt-sm px-xs">
          Your data lives in your private Nexora cloud, so every device you sign in on sees the same thing.
        </p>
      </div>

      <div>
        <SectionTitle>Export your data</SectionTitle>
        <Group>
          <ExportRow id="json" title="Everything (JSON)" subtitle="Notes, knowledge, habits, chats and more" onClick={exportJson} />
          <ExportRow id="knowledge" title="Knowledge (CSV)" subtitle="Opens in Excel or Google Sheets" onClick={() => exportCsv('knowledge')} />
          <ExportRow id="journal" title="Journal (CSV)" subtitle="All your entries" onClick={() => exportCsv('journal')} />
        </Group>
      </div>

      <div>
        <SectionTitle>Restore</SectionTitle>
        <div className="card p-md opacity-60">
          <h3 className="text-body text-ink-primary">Restore from a backup file</h3>
          <p className="text-caption text-ink-secondary">Coming soon.</p>
        </div>
      </div>
    </div>
  )
}

// ----- Privacy & Security -----
function PinForm({ mode, userId, onDone, onCancel, notify }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const needsCurrent = mode === 'change' || mode === 'disable'
  const needsNew = mode === 'set' || mode === 'change'
  const digits = (setter) => (e) => setter(e.target.value.replace(/\D/g, '').slice(0, MAX_PIN))

  async function submit() {
    if (needsNew) {
      if (!isValidPin(next)) return notify(`PIN must be ${MIN_PIN}–${MAX_PIN} digits.`)
      if (next !== confirm) return notify("PINs don't match.")
    }
    setBusy(true)
    try {
      if (needsCurrent) {
        const r = await verifyPin(userId, current)
        if (!r.ok) {
          notify(r.wait ? `Too many attempts. Try again in ${r.wait}s.` : 'Current PIN is incorrect.')
          return
        }
      }
      if (mode === 'disable') {
        disableLock()
        notify('App lock turned off.')
      } else {
        await setPin(userId, next)
        notify(mode === 'set' ? 'App lock turned on.' : 'PIN changed.')
      }
      onDone()
    } catch (err) {
      notify(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const pinInput = (value, setter, label) => (
    <Field label={label}>
      <input type="password" inputMode="numeric" autoComplete="off" className="input tracking-[0.4em]" value={value} onChange={digits(setter)} />
    </Field>
  )

  return (
    <div className="p-md flex flex-col gap-md">
      {needsCurrent && pinInput(current, setCurrent, 'Current PIN')}
      {needsNew && pinInput(next, setNext, `New PIN (${MIN_PIN}–${MAX_PIN} digits)`)}
      {needsNew && pinInput(confirm, setConfirm, 'Confirm PIN')}
      <div className="flex gap-sm">
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button onClick={submit} disabled={busy} className="btn-primary flex-1 py-3 disabled:opacity-50">
          {busy ? 'Working…' : mode === 'disable' ? 'Turn off' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function PrivacySection({ session, notify }) {
  const userId = session.user.id
  const [lockOn, setLockOn] = useState(() => isLockEnabled(userId))
  const [pinMode, setPinMode] = useState(null) // 'set' | 'change' | 'disable' | null
  const [signingOut, setSigningOut] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  function pinDone() {
    setPinMode(null)
    setLockOn(isLockEnabled(userId))
  }

  async function signOutOthers() {
    setSigningOut(true)
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    setSigningOut(false)
    notify(error ? "Couldn't sign out other devices." : 'Signed out of all other devices.')
  }

  async function deleteAccount() {
    setDeleting(true)
    const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } })
    if (error) {
      const info = await readInvokeError(error)
      setDeleting(false)
      notify(info.code === 'active_subscription' ? info.message : "Couldn't delete your account. Please try again.")
      return
    }
    try {
      disableLock()
      localStorage.clear()
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut().catch(() => {})
  }

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <SectionTitle>App lock</SectionTitle>
        <Group>
          {pinMode ? (
            <PinForm mode={pinMode} userId={userId} onDone={pinDone} onCancel={() => setPinMode(null)} notify={notify} />
          ) : (
            <>
              <ToggleRow
                title="Lock with a PIN"
                subtitle="Asked when you open Nexora or return after a minute away"
                checked={lockOn}
                onChange={(v) => setPinMode(v ? 'set' : 'disable')}
              />
              {lockOn && (
                <button onClick={() => setPinMode('change')} className="w-full flex items-center justify-between p-md hover:bg-base-elevated text-left">
                  <span className="text-body text-ink-primary">Change PIN</span>
                  <ChevronRight size={20} className="text-ink-secondary" />
                </button>
              )}
            </>
          )}
        </Group>
        <p className="text-caption text-ink-tertiary mt-sm px-xs">
          The PIN stays on this device and protects against someone using your unlocked phone or computer. Biometric unlock will arrive with the mobile apps.
        </p>
      </div>

      <div>
        <SectionTitle>Devices</SectionTitle>
        <button onClick={signOutOthers} disabled={signingOut} className="card w-full p-md flex items-center justify-between text-left disabled:opacity-60">
          <div className="flex items-center gap-md">
            <IconBubble icon={Smartphone} tint="text-secondary" />
            <div>
              <h3 className="text-body text-ink-primary">Sign out of other devices</h3>
              <p className="text-caption text-ink-secondary">Keeps this device signed in</p>
            </div>
          </div>
          {signingOut && <Loader2 size={20} className="animate-spin text-primary" />}
        </button>
      </div>

      <div>
        <SectionTitle>How your data is protected</SectionTitle>
        <div className="card p-md text-body-small text-ink-secondary leading-relaxed flex flex-col gap-sm">
          <p>Your data is encrypted in transit (HTTPS) and at rest, and account-level access rules stop other users from reading it.</p>
          <p>When you chat with the AI, the message and a short summary of your recent saved items are sent to our AI provider to write a reply.</p>
        </div>
      </div>

      <div>
        <SectionTitle>Danger zone</SectionTitle>
        <div className="card p-md border-error/40 flex flex-col gap-md">
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="flex items-center gap-sm text-error text-body">
              <Trash2 size={18} /> Delete my account
            </button>
          ) : (
            <>
              <p className="text-body-small text-ink-secondary">
                This permanently deletes your account, notes, knowledge, journal, chats and files. It can't be undone.
                Consider exporting your data first. Type <span className="text-ink-primary font-semibold">DELETE</span> to confirm.
              </p>
              <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" placeholder="DELETE" />
              <div className="flex gap-sm">
                <button onClick={() => { setShowDelete(false); setConfirmText('') }} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={deleteAccount}
                  disabled={confirmText !== 'DELETE' || deleting}
                  className="flex-1 rounded-button bg-error text-white font-semibold uppercase tracking-wider text-sm py-3 disabled:opacity-40"
                >
                  {deleting ? 'Deleting…' : 'Delete forever'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AboutSection() {
  return (
    <div className="flex flex-col gap-lg">
      <div className="card p-lg flex flex-col items-center text-center gap-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-base-bg text-h1 font-extrabold shadow-glow">N</div>
        <h2 className="text-h2 text-ink-primary">Nexora</h2>
        <p className="text-body-small text-ink-secondary">Your Personal Operating System</p>
        <span className="chip mt-xs">Version {APP_VERSION}</span>
      </div>
    </div>
  )
}

// ---------- page ----------
const SECTIONS = {
  account: { title: 'Account' },
  appearance: { title: 'Appearance' },
  notifications: { title: 'Notifications' },
  data: { title: 'Data & Backup' },
  privacy: { title: 'Privacy & Security' },
  about: { title: 'About' },
}

export default function Settings({ session }) {
  const navigate = useNavigate()
  const { section } = useParams()
  const { settings, loading, update } = useUserSettings(session.user.id)
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const notify = useCallback((msg) => {
    setToast(msg)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 3500)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const current = section && SECTIONS[section] ? section : null
  const back = () => (current ? navigate('/settings') : navigate('/capture'))

  let body
  if (!current) {
    body = (
      <div className="flex flex-col gap-lg">
        <Group>
          <NavRow icon={User} tint="text-primary" title="Account" subtitle="Profile, password, plan" onClick={() => navigate('/settings/account')} />
        </Group>
        <Group>
          <NavRow icon={Palette} tint="text-secondary" title="Appearance" subtitle={`${modeLabel(settings.dark_mode)} theme, accent color`} onClick={() => navigate('/settings/appearance')} />
          <NavRow icon={Bell} tint="text-warning" title="Notifications" subtitle={settings.push_notifications ? 'On' : 'Off'} onClick={() => navigate('/settings/notifications')} />
          <NavRow icon={Cloud} tint="text-primary" title="Data & Backup" subtitle="Sync status, export" onClick={() => navigate('/settings/data')} />
          <NavRow icon={ShieldCheck} tint="text-success" title="Privacy & Security" subtitle="App lock, devices, delete account" onClick={() => navigate('/settings/privacy')} />
        </Group>
        <Group>
          <NavRow icon={Info} tint="text-ink-secondary" title="About" subtitle={`Version ${APP_VERSION}`} onClick={() => navigate('/settings/about')} />
        </Group>
      </div>
    )
  } else if (current === 'account') body = <AccountSection session={session} notify={notify} />
  else if (current === 'appearance') body = <AppearanceSection settings={settings} update={update} notify={notify} />
  else if (current === 'notifications') body = <NotificationsSection settings={settings} update={update} notify={notify} />
  else if (current === 'data') body = <DataSection session={session} notify={notify} />
  else if (current === 'privacy') body = <PrivacySection session={session} notify={notify} />
  else body = <AboutSection />

  return (
    <div className="pb-lg">
      <header className="sticky top-0 z-10 bg-base-bg/90 backdrop-blur flex items-center justify-between h-14 px-md border-b border-base-border">
        <button onClick={back} aria-label="Back" className="p-sm -ml-sm text-ink-primary hover:opacity-80">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-h3 text-ink-primary">{current ? SECTIONS[current].title : 'Settings'}</h1>
        <span className="w-10" />
      </header>

      <div className="px-md pt-lg">
        {loading && !current ? <div className="card h-40 animate-pulse" /> : body}
      </div>

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 -translate-x-1/2 max-w-[90%] bg-base-elevated border border-base-border text-ink-primary text-body-small rounded-button px-md py-sm shadow-card z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
