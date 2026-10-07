import { useEffect, useState } from 'react'
import { Lock, ShieldCheck, Eye, EyeOff, Copy, Download, KeyRound, AlertTriangle, Check } from 'lucide-react'
import { Sheet } from './ui.jsx'
import { copyText } from '../../lib/share.js'
import {
  useVault, setupVault, unlock, unlockWithRecovery, changePassphrase, regenerateRecovery,
  resetVault, resolvePrompt, lock,
} from '../../lib/journal/vault.js'
import { MIN_PASSPHRASE } from '../../lib/journal/crypto.js'

function PassField({ value, onChange, placeholder, autoFocus, onEnter, label }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'} value={value} autoFocus={autoFocus} aria-label={label || placeholder}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        autoComplete="off" autoCapitalize="off" spellCheck={false} className="input pr-11"
      />
      <button type="button" aria-label={show ? 'Hide' : 'Show'} onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-ink-secondary">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

function Msg({ children, tone = 'error' }) {
  if (!children) return null
  return <p className={`text-caption mt-sm ${tone === 'error' ? 'text-error' : 'text-ink-secondary'}`} role="alert">{children}</p>
}

// ---------------------------------------------------------------- first-time setup
function Setup({ onDone, onCancel, reason }) {
  const [step, setStep] = useState(1)
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [recovery, setRecovery] = useState('')
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  async function create() {
    setErr('')
    if (pass.length < MIN_PASSPHRASE) return setErr(`Use at least ${MIN_PASSPHRASE} characters — a short phrase of 3–4 words is ideal.`)
    if (pass !== pass2) return setErr("The two passphrases don't match.")
    setBusy(true)
    try {
      setRecovery(await setupVault(pass))
      setStep(2)
    } catch (e) {
      setErr(e.message || 'Could not create your vault. Try again.')
    } finally {
      setBusy(false)
    }
  }
  function download() {
    const blob = new Blob([`Nexora Journal — recovery key\n\n${recovery}\n\nKeep this somewhere safe and private. Anyone with this key AND access to your account could read your private entries.\nIf you lose both your passphrase and this key, private entries can never be recovered.\n`], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'nexora-recovery-key.txt'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  if (step === 2) {
    return (
      <Sheet open title="Save your recovery key" onClose={undefined} tall
        footer={<button className="btn-primary w-full py-3.5 disabled:opacity-50" disabled={!saved} onClick={onDone}>Done — vault is ready</button>}>
        <div className="flex flex-col gap-md">
          <div className="rounded-card border border-warning/40 bg-warning/10 p-md flex gap-sm">
            <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
            <p className="text-body-small text-ink-primary leading-relaxed">
              This is the <b>only</b> way back in if you forget your passphrase. Nexora can't recover it for you — your entries are encrypted on this device.
            </p>
          </div>
          <div className="rounded-card bg-base-elevated border border-base-border p-md text-center">
            <p className="font-mono text-h3 tracking-wider text-primary select-all break-all">{recovery}</p>
          </div>
          <div className="flex gap-sm">
            <button className="btn-secondary flex-1 py-2.5 flex items-center justify-center gap-2" onClick={async () => { setCopied(await copyText(recovery)); setTimeout(() => setCopied(false), 2000) }}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn-secondary flex-1 py-2.5 flex items-center justify-center gap-2" onClick={download}><Download size={16} /> Download</button>
          </div>
          <label className="flex items-start gap-sm text-body-small text-ink-secondary cursor-pointer">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-1 accent-[rgb(var(--c-primary))]" />
            I've saved my recovery key somewhere safe (password manager, paper, etc.).
          </label>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet open title="Create your private vault" onClose={onCancel}
      subtitle={reason === 'folder' ? 'Private folders keep entries locked.' : 'Private entries are encrypted on your device.'}
      footer={<button className="btn-primary w-full py-3.5 disabled:opacity-50" disabled={busy} onClick={create}>{busy ? 'Securing…' : 'Create vault'}</button>}>
      <div className="flex flex-col gap-md">
        <div className="flex gap-sm items-start rounded-card bg-primary/10 border border-primary/30 p-md">
          <ShieldCheck size={20} className="text-primary shrink-0 mt-0.5" />
          <p className="text-body-small text-ink-primary leading-relaxed">
            Your passphrase never leaves this device. Private entries are stored as scrambled text that <b>nobody — not even Nexora or our AI — can read</b>.
          </p>
        </div>
        <PassField value={pass} onChange={setPass} placeholder="Choose a passphrase" autoFocus />
        <PassField value={pass2} onChange={setPass2} placeholder="Repeat passphrase" onEnter={create} />
        <p className="text-caption text-ink-secondary">Tip: a short sentence like “blue-mango-train-42” is stronger and easier to remember than a complex password.</p>
        <Msg>{err}</Msg>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------- unlock (+ forgot passphrase)
function Unlock({ onDone, onCancel, reason }) {
  const [mode, setMode] = useState('pass')
  const [pass, setPass] = useState('')
  const [rec, setRec] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return undefined
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000)
    return () => clearInterval(t)
  }, [wait])

  async function go() {
    if (busy || wait) return
    setErr('')
    setBusy(true)
    try {
      const r = mode === 'pass' ? await unlock(pass) : await unlockWithRecovery(rec, next)
      if (r.ok) return onDone()
      setWait(r.wait || 0)
      setErr(r.wait ? `Too many attempts. Try again in ${r.wait}s.` : r.error || (mode === 'pass' ? 'Wrong passphrase.' : 'That recovery key is not right.'))
    } catch (e) {
      setErr(e.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onCancel} title={mode === 'pass' ? 'Unlock private entries' : 'Reset with recovery key'}
      subtitle={reason || (mode === 'pass' ? 'Enter your vault passphrase.' : 'Enter your recovery key and choose a new passphrase.')}
      footer={<button className="btn-primary w-full py-3.5 disabled:opacity-50" disabled={busy || !!wait || (mode === 'pass' ? !pass : !rec || !next)} onClick={go}>{busy ? 'Unlocking…' : wait ? `Wait ${wait}s` : mode === 'pass' ? 'Unlock' : 'Reset & unlock'}</button>}>
      <div className="flex flex-col gap-md">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary"><Lock size={26} /></div>
        {mode === 'pass' ? (
          <PassField value={pass} onChange={setPass} placeholder="Passphrase" autoFocus onEnter={go} />
        ) : (
          <>
            <input className="input font-mono tracking-wider uppercase" value={rec} onChange={(e) => setRec(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autoFocus autoComplete="off" spellCheck={false} />
            <PassField value={next} onChange={setNext} placeholder="New passphrase" onEnter={go} />
          </>
        )}
        <Msg>{err}</Msg>
        <button className="text-caption text-ink-secondary hover:text-primary underline underline-offset-2 self-center" onClick={() => { setMode(mode === 'pass' ? 'rec' : 'pass'); setErr('') }}>
          {mode === 'pass' ? 'Forgot passphrase?' : 'Back to passphrase'}
        </button>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------- vault settings
function VaultSettings({ onClose }) {
  const v = useVault()
  const [view, setView] = useState('home') // home | change | recovery | reset
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [newRec, setNewRec] = useState('')
  const [confirm, setConfirm] = useState('')

  const back = () => { setView('home'); setA(''); setB(''); setErr(''); setNewRec(''); setConfirm('') }
  async function run(fn) {
    setErr('')
    setBusy(true)
    try { await fn() } catch (e) { setErr(e.message === 'bad_secret' ? 'Wrong passphrase.' : e.message || 'Something went wrong.') } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title="Private vault" tall>
      {view === 'home' && (
        <div className="flex flex-col gap-sm">
          <div className="rounded-card bg-base-elevated border border-base-border p-md flex items-center gap-md">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${v.status === 'unlocked' ? 'bg-success/15 text-success' : 'bg-base-border/40 text-ink-secondary'}`}>
              {v.status === 'unlocked' ? <ShieldCheck size={20} /> : <Lock size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body text-ink-primary">{v.status === 'unlocked' ? 'Unlocked' : v.status === 'none' ? 'Not set up' : 'Locked'}</p>
              <p className="text-caption text-ink-secondary">Auto-locks after 10 minutes idle or 5 minutes in the background.</p>
            </div>
            {v.status === 'unlocked' && <button className="btn-secondary !py-2 !px-3 !text-xs" onClick={() => { lock(); onClose() }}>Lock now</button>}
          </div>
          {v.status === 'unlocked' && (
            <>
              <button className="card p-md text-left flex items-center gap-md hover:border-primary/50 transition" onClick={() => setView('change')}><KeyRound size={18} className="text-primary" /><span className="text-body text-ink-primary">Change passphrase</span></button>
              <button className="card p-md text-left flex items-center gap-md hover:border-primary/50 transition" onClick={() => setView('recovery')}><ShieldCheck size={18} className="text-primary" /><span className="text-body text-ink-primary">Get a new recovery key</span></button>
            </>
          )}
          {v.status === 'locked' && <p className="text-body-small text-ink-secondary px-1">Unlock the vault to change its settings.</p>}
          {v.status !== 'none' && (
            <button className="card p-md text-left flex items-center gap-md border-error/30 hover:border-error/60 transition mt-sm" onClick={() => setView('reset')}>
              <AlertTriangle size={18} className="text-error" /><span className="text-body text-error">Reset vault (delete private entries)</span>
            </button>
          )}
        </div>
      )}

      {view === 'change' && (
        <div className="flex flex-col gap-md">
          <PassField value={a} onChange={setA} placeholder="Current passphrase" autoFocus />
          <PassField value={b} onChange={setB} placeholder="New passphrase" />
          <Msg>{err}</Msg>
          <div className="flex gap-sm"><button className="btn-secondary flex-1 py-3" onClick={back}>Back</button>
            <button className="btn-primary flex-1 py-3 disabled:opacity-50" disabled={busy || !a || !b} onClick={() => run(async () => { await changePassphrase(a, b); back(); onClose() })}>{busy ? 'Saving…' : 'Change'}</button></div>
        </div>
      )}

      {view === 'recovery' && (
        <div className="flex flex-col gap-md">
          {!newRec ? (
            <>
              <p className="text-body-small text-ink-secondary">This creates a new recovery key and <b>invalidates the old one</b>.</p>
              <PassField value={a} onChange={setA} placeholder="Your passphrase" autoFocus />
              <Msg>{err}</Msg>
              <div className="flex gap-sm"><button className="btn-secondary flex-1 py-3" onClick={back}>Back</button>
                <button className="btn-primary flex-1 py-3 disabled:opacity-50" disabled={busy || !a} onClick={() => run(async () => setNewRec(await regenerateRecovery(a)))}>{busy ? 'Working…' : 'Generate'}</button></div>
            </>
          ) : (
            <>
              <div className="rounded-card bg-base-elevated border border-base-border p-md text-center"><p className="font-mono text-h3 tracking-wider text-primary select-all break-all">{newRec}</p></div>
              <p className="text-caption text-ink-secondary">Save it now — it won't be shown again.</p>
              <button className="btn-primary w-full py-3" onClick={() => { back(); onClose() }}>I've saved it</button>
            </>
          )}
        </div>
      )}

      {view === 'reset' && (
        <div className="flex flex-col gap-md">
          <div className="rounded-card border border-error/40 bg-error/10 p-md text-body-small text-ink-primary leading-relaxed">
            This <b>permanently deletes all your private entries</b> and the vault. Only use it if you've lost both your passphrase and recovery key. Normal entries are not affected.
          </div>
          <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder='Type "DELETE" to confirm' autoCapitalize="characters" />
          <Msg>{err}</Msg>
          <div className="flex gap-sm"><button className="btn-secondary flex-1 py-3" onClick={back}>Cancel</button>
            <button className="flex-1 py-3 rounded-button bg-error text-white font-semibold uppercase tracking-wider text-sm disabled:opacity-40" disabled={busy || confirm !== 'DELETE'} onClick={() => run(async () => { await resetVault(); back(); onClose() })}>{busy ? 'Deleting…' : 'Delete everything'}</button></div>
        </div>
      )}
    </Sheet>
  )
}

// Rendered once by JournalProvider; answers requestUnlock() and the "Vault settings" menu item.
export default function VaultHost() {
  const v = useVault()
  if (v.prompt === 'setup') return <Setup reason={v.promptReason} onDone={() => resolvePrompt(true)} onCancel={() => resolvePrompt(false)} />
  if (v.prompt === 'unlock') return <Unlock reason={v.promptReason} onDone={() => resolvePrompt(true)} onCancel={() => resolvePrompt(false)} />
  if (v.prompt === 'settings') return <VaultSettings onClose={() => resolvePrompt(false)} />
  return null
}
