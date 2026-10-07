import { useEffect, useState } from 'react'
import { Sparkles, Loader2, Lightbulb, Trophy, AlertCircle, Target, HelpCircle } from 'lucide-react'
import { Sheet } from './ui.jsx'
import { aiReflection } from '../../lib/journal/ai.js'
import { fetchLatestReflection } from '../../lib/journal/data.js'
import { relativeTime } from '../../lib/journal/dates.js'
import { useJournal } from '../../lib/journal/context.jsx'

function Block({ icon, title, children }) {
  return (
    <div className="rounded-card bg-base-elevated border border-base-border p-md">
      <p className="text-caption uppercase tracking-wider text-ink-secondary flex items-center gap-1.5 mb-1.5">{icon}{title}</p>
      {children}
    </div>
  )
}

export default function ReflectionCard({ notify }) {
  const { isPro, openUpgrade, overview } = useJournal()
  const [latest, setLatest] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => { fetchLatestReflection().then(setLatest).catch(() => setLatest(null)) }, [])
  if (latest === undefined || !overview || overview.total < 2) return null

  const ageDays = latest ? (Date.now() - new Date(latest.created_at).getTime()) / 86400000 : Infinity
  const fresh = latest && ageDays < 6
  const c = latest?.content

  async function generate() {
    if (busy) return
    setBusy(true)
    try {
      const r = await aiReflection()
      setLatest(r.reflection)
      setOpen(true)
    } catch (e) {
      if (e.code === 'reflection_limit') openUpgrade('reflection')
      else notify(e.message)
    } finally { setBusy(false) }
  }

  return (
    <>
      {fresh ? (
        <button onClick={() => setOpen(true)} className="card p-md text-left w-full hover:border-primary/50 transition animate-rise">
          <p className="text-caption uppercase tracking-wider text-primary flex items-center gap-1.5 mb-1"><Sparkles size={13} /> Weekly reflection · {relativeTime(latest.created_at)}</p>
          <p className="text-body font-semibold text-ink-primary leading-snug">{c.headline || 'Your week in review'}</p>
          <p className="text-body-small text-ink-secondary line-clamp-2 mt-1">{c.summary}</p>
        </button>
      ) : (
        <div className="card p-md animate-rise" style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary) / .08), rgb(var(--c-surface)))' }}>
          <p className="text-caption uppercase tracking-wider text-primary flex items-center gap-1.5 mb-1"><Sparkles size={13} /> Weekly reflection</p>
          <p className="text-body-small text-ink-secondary mb-md leading-relaxed">See the themes, wins and one focus for next week — drawn from what you wrote in the last 7 days.</p>
          <div className="flex items-center gap-md">
            <button onClick={generate} disabled={busy} className="btn-primary !normal-case !tracking-normal py-2.5 px-md flex items-center gap-2 disabled:opacity-60">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Reflecting…</> : <><Sparkles size={16} /> Reflect on my week</>}
            </button>
            <span className="text-caption text-ink-tertiary">{isPro ? 'Unlimited' : '1 free per month'}</span>
          </div>
        </div>
      )}

      <Sheet open={open && !!c} onClose={() => setOpen(false)} tall title={c?.headline || 'Weekly reflection'}
        subtitle={latest ? `${latest.period_start} → ${latest.period_end} · ${latest.entry_count} entries` : ''}
        footer={!isPro ? <p className="text-caption text-ink-tertiary text-center">Free: 1 reflection a month. <button className="text-primary font-semibold" onClick={() => { setOpen(false); openUpgrade('reflection') }}>Get unlimited</button></p> : null}>
        {c && (
          <div className="flex flex-col gap-md">
            <p className="text-body text-ink-primary leading-relaxed">{c.summary}</p>
            {c.themes?.length > 0 && (
              <Block icon={<Lightbulb size={13} />} title="Themes">
                <ul className="flex flex-col gap-1.5">{c.themes.map((t) => <li key={t.name} className="text-body-small text-ink-secondary"><b className="text-ink-primary">{t.name}.</b> {t.note}</li>)}</ul>
              </Block>
            )}
            {c.mood_pattern && <Block icon={<Sparkles size={13} />} title="Mood"><p className="text-body-small text-ink-secondary leading-relaxed">{c.mood_pattern}</p></Block>}
            {c.wins?.length > 0 && <Block icon={<Trophy size={13} />} title="Wins"><ul className="list-disc pl-4 text-body-small text-ink-secondary flex flex-col gap-1">{c.wins.map((w) => <li key={w}>{w}</li>)}</ul></Block>}
            {c.watch_outs?.length > 0 && <Block icon={<AlertCircle size={13} />} title="Watch out for"><ul className="list-disc pl-4 text-body-small text-ink-secondary flex flex-col gap-1">{c.watch_outs.map((w) => <li key={w}>{w}</li>)}</ul></Block>}
            {c.focus_next_week && <Block icon={<Target size={13} />} title="Focus next week"><p className="text-body-small text-ink-primary leading-relaxed">{c.focus_next_week}</p></Block>}
            {c.question && <Block icon={<HelpCircle size={13} />} title="Sit with this"><p className="text-body-small text-ink-primary italic leading-relaxed">{c.question}</p></Block>}
            <p className="text-caption text-ink-tertiary">AI reflections are a writing aid, not professional advice. Private entries are never read by AI.</p>
          </div>
        )}
      </Sheet>
    </>
  )
}
