import { useEffect, useState } from 'react'
import { Footprints, Leaf, Heart } from 'lucide-react'
import { Sheet } from '../journal/ui.jsx'
import { fromISO } from '../../lib/journal/dates.js'

const KEY = 'nexora_step_away_v1'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null } }

// "Step away": the app's only job is to get out of your way. No counting, no streak, nothing to win.
export function StepAway({ onLog }) {
  const [session, setSession] = useState(read)
  const [pick, setPick] = useState(false)
  const [, tick] = useState(0)
  const [note, setNote] = useState('')
  const [back, setBack] = useState(null) // minutes, when returning

  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t) }, [])
  useEffect(() => {
    const onVis = () => { if (!document.hidden) setSession(read()) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const start = (minutes) => { const s = { start: Date.now(), minutes }; localStorage.setItem(KEY, JSON.stringify(s)); setSession(s); setPick(false) }
  const end = () => {
    const mins = Math.max(1, Math.round((Date.now() - session.start) / 60000))
    localStorage.removeItem(KEY); setSession(null); setBack(mins); setNote('')
  }
  const away = session ? Math.max(0, Math.round((Date.now() - session.start) / 60000)) : 0

  return (
    <>
      <button onClick={() => setPick(true)} className="card p-md text-left flex items-center gap-md hover:border-primary/50 active:scale-[0.99] transition w-full">
        <span className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Footprints size={20} className="text-primary" /></span>
        <span className="flex-1"><span className="block text-body font-semibold text-ink-primary">Step away</span><span className="block text-body-small text-ink-secondary">Put the phone down. I’ll be here when you’re back.</span></span>
      </button>

      <Sheet open={pick} onClose={() => setPick(false)} title="How long?" subtitle="Nothing is tracked while you’re gone.">
        <div className="grid grid-cols-3 gap-sm">{[15, 30, 60].map((m) => <button key={m} onClick={() => start(m)} className="card py-md text-center hover:border-primary/50 active:scale-95 transition"><span className="block text-h3 text-ink-primary">{m}</span><span className="block text-caption text-ink-tertiary">minutes</span></button>)}</div>
        <button className="text-caption text-ink-secondary mt-md w-full text-center" onClick={() => start(0)}>No set time — just go</button>
      </Sheet>

      {session && (
        <div className="fixed inset-0 z-[75] bg-base-bg flex flex-col items-center justify-center text-center px-lg animate-fade-in">
          <div className="w-24 h-24 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-lg animate-pulse"><Leaf size={36} className="text-primary" /></div>
          <h2 className="text-h1 text-ink-primary">Go.</h2>
          <p className="text-body text-ink-secondary mt-sm max-w-xs">Leave the phone. {session.minutes ? `Around ${session.minutes} minutes.` : 'Take the time you need.'} Nothing here needs you.</p>
          <p className="text-caption text-ink-tertiary mt-lg">{away} min so far</p>
          <button className="btn-secondary px-lg py-3 mt-xl" onClick={end}>I’m back</button>
        </div>
      )}

      <Sheet open={back != null} onClose={() => setBack(null)} title={`Welcome back — ${back} minutes`} subtitle="Anything you noticed? Totally optional.">
        <div className="flex flex-col gap-md">
          <input className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A thought, a smell, a face…" />
          <div className="flex gap-sm">
            <button className="btn-secondary flex-1 py-3" onClick={() => setBack(null)}>Skip</button>
            <button className="btn-primary flex-1 py-3" onClick={() => { onLog({ kind: 'step_away', minutes: Math.min(back, 1440), note: note.trim() || null }); setBack(null) }}>Remember it</button>
          </div>
        </div>
      </Sheet>
    </>
  )
}

export function NudgeCard({ nudge, onDone, onLater, onNever }) {
  if (!nudge) return null
  return (
    <section className="rounded-card border border-base-border bg-base-elevated/60 p-md flex flex-col gap-md animate-rise" aria-label="A quiet thought">
      <p className="text-caption uppercase tracking-wider text-ink-tertiary flex items-center gap-1.5"><Heart size={12} /> A quiet thought</p>
      <p className="text-body text-ink-primary leading-relaxed">{nudge.text}</p>
      {nudge.action && <p className="text-body-small text-ink-secondary">If you feel like it: <span className="text-ink-primary">{nudge.action.toLowerCase()}</span>.</p>}
      <div className="flex gap-sm items-center">
        {nudge.action && <button className="btn-secondary !normal-case !tracking-normal !py-1.5 !px-3 !text-xs" onClick={onDone}>I did</button>}
        <button className="text-caption text-ink-secondary px-2 py-1" onClick={onLater}>Later</button>
        <button className="text-caption text-ink-tertiary px-2 py-1 ml-auto" onClick={onNever}>Not for me</button>
      </div>
    </section>
  )
}

export function Moments({ moments }) {
  if (!moments.length) return null
  const label = { step_away: 'Stepped away', nature: 'Outside', connect: 'With someone', play: 'For fun', rest: 'Rested' }
  return (
    <div className="rounded-card border border-base-border bg-base-surface p-md">
      <p className="text-caption uppercase tracking-wider text-ink-secondary mb-sm">Moments you kept</p>
      <ul className="flex flex-col gap-1.5">
        {moments.slice(0, 4).map((m) => (
          <li key={m.id} className="text-body-small text-ink-secondary flex gap-2">
            <span className="text-ink-tertiary w-14 shrink-0">{fromISO(m.happened_on).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <span><span className="text-ink-primary">{label[m.kind] || 'Moment'}</span>{m.minutes ? ` · ${m.minutes} min` : ''}{m.note ? ` — ${m.note}` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
