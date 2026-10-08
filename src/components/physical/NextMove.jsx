import { useState } from 'react'
import { Loader2, Sparkles, Check, FlaskConical, ChevronDown } from 'lucide-react'
import { Sheet } from '../journal/ui.jsx'
import { KINDS, OUTCOMES } from '../../lib/physical/constants.js'
import { daysBetween, todayLocal } from '../../lib/journal/dates.js'

// ONE suggestion at a time. Not a list, not a plan. "Easier" and "Something else" are always one tap away.
export function NextMoveCard({ move, busy, onStart, onEasier, onElse, evidenceNote, atLimit }) {
  if (!move) return null
  const k = KINDS[move.kind] || KINDS.move
  return (
    <section className="card p-md flex flex-col gap-md border-l-4 border-l-primary animate-rise" aria-label="Your next move">
      <div className="flex items-center justify-between">
        <p className="text-caption uppercase tracking-wider text-primary flex items-center gap-1.5"><Sparkles size={13} /> Your next move</p>
        <span className="text-caption text-ink-tertiary">{k.emoji} {k.label}{move.minutes ? ` · ~${move.minutes} min` : ''}</span>
      </div>
      <div>
        <h3 className="text-body font-semibold text-ink-primary leading-snug">{move.title}</h3>
        {move.why && <p className="text-body-small text-ink-secondary mt-1 leading-relaxed">{move.why}</p>}
      </div>
      <p className="text-caption text-ink-tertiary">A one-week trial. At the end I’ll ask one question: did it help?{evidenceNote ? ` ${evidenceNote}` : ''}</p>
      <div className="flex flex-wrap gap-sm items-center">
        <button className="btn-primary !normal-case !tracking-normal py-2 px-md disabled:opacity-60" disabled={busy} onClick={onStart}>{atLimit ? 'Replace current experiment…' : 'Try it for a week'}</button>
        <button className="btn-secondary !normal-case !tracking-normal !py-2 disabled:opacity-60" disabled={busy} onClick={onEasier}>{busy ? <Loader2 size={15} className="animate-spin" /> : 'Make it easier'}</button>
        <button className="text-body-small text-ink-secondary hover:text-ink-primary px-2 disabled:opacity-60" disabled={busy} onClick={onElse}>Something else</button>
      </div>
    </section>
  )
}

function OutcomeSheet({ exp, onClose, onSave }) {
  const [outcome, setOutcome] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Sheet open={!!exp} onClose={onClose} title="How did it go?" subtitle={exp?.title}
      footer={<div className="flex gap-sm">
        <button className="btn-secondary px-md py-3" onClick={() => onSave(exp, { status: 'dropped' })}>Drop it</button>
        <button className="btn-primary flex-1 py-3 disabled:opacity-50" disabled={!outcome || busy} onClick={async () => { setBusy(true); await onSave(exp, { outcome, note, status: 'done' }); setBusy(false) }}>Save</button>
      </div>}>
      <div className="flex flex-col gap-md">
        <p className="text-body-small text-ink-secondary">Did it make a noticeable difference to how you feel?</p>
        <div className="grid grid-cols-2 gap-sm">{OUTCOMES.map((o) => <button key={o.id} onClick={() => setOutcome(o.id)} className={`py-3 rounded-card border text-body-small transition active:scale-[0.98] ${outcome === o.id ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-base-border bg-base-surface text-ink-secondary'}`}>{o.label}</button>)}</div>
        <textarea className="input min-h-[72px]" maxLength={400} placeholder="Anything worth remembering? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-caption text-ink-tertiary">“Not really” is a useful answer — it tells me what to stop suggesting.</p>
      </div>
    </Sheet>
  )
}

export function Experiments({ experiments, onCheckin, onFinish, busyId }) {
  const [rating, setRating] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const today = todayLocal()
  const active = experiments.filter((e) => e.status === 'active')
  const done = experiments.filter((e) => e.status === 'done')
  const works = done.filter((e) => e.outcome === 'clear' || e.outcome === 'slight')
  if (!active.length && !done.length) return null
  return (
    <section className="flex flex-col gap-sm" aria-label="Experiments">
      {active.map((e) => {
        const dayN = Math.min(daysBetween(e.start_on, today) + 1, daysBetween(e.start_on, e.ends_on) + 1)
        const total = daysBetween(e.start_on, e.ends_on) + 1
        const over = today > e.ends_on
        const k = KINDS[e.kind] || KINDS.move
        return (
          <div key={e.id} className="card p-md flex flex-col gap-sm">
            <div className="flex items-start gap-sm">
              <FlaskConical size={17} className="text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-body-small font-semibold text-ink-primary leading-snug">{e.title}</p>
                <p className="text-caption text-ink-tertiary">{k.emoji} {over ? 'Time to look back' : `Day ${dayN} of ${total}`}{e.checkins ? ` · tried ${e.checkins} time${e.checkins === 1 ? '' : 's'}` : ''}</p>
              </div>
            </div>
            <div className="flex gap-sm">
              {over ? (
                <button className="btn-primary !normal-case !tracking-normal py-2 px-md flex-1" onClick={() => setRating(e)}>How did it go?</button>
              ) : (
                <>
                  <button disabled={e.last_checkin === today || busyId === e.id} onClick={() => onCheckin(e)} className="btn-secondary !normal-case !tracking-normal !py-2 flex-1 flex items-center justify-center gap-1.5 disabled:opacity-60">
                    <Check size={15} /> {e.last_checkin === today ? 'Noted today' : 'I did it today'}
                  </button>
                  <button className="text-body-small text-ink-secondary px-2" onClick={() => setRating(e)}>Wrap up</button>
                </>
              )}
            </div>
            {!over && <p className="text-[11px] text-ink-tertiary">No streak to protect. Skip days freely — tapping is optional.</p>}
          </div>
        )
      })}

      {works.length > 0 && (
        <div className="rounded-card border border-base-border bg-base-surface p-md">
          <p className="text-caption uppercase tracking-wider text-success mb-sm">What works for you</p>
          <ul className="flex flex-col gap-1.5">
            {(showAll ? works : works.slice(0, 3)).map((e) => (
              <li key={e.id} className="text-body-small text-ink-primary flex gap-2"><span className="text-success">✓</span><span className="flex-1">{e.title}<span className="text-ink-tertiary"> · {e.outcome === 'clear' ? 'clearly helped' : 'helped a little'}</span></span></li>
            ))}
          </ul>
          {works.length > 3 && <button className="text-caption text-primary mt-sm flex items-center gap-1" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : `Show all ${works.length}`}<ChevronDown size={13} className={showAll ? 'rotate-180' : ''} /></button>}
        </div>
      )}
      <OutcomeSheet exp={rating} onClose={() => setRating(null)} onSave={async (exp, v) => { await onFinish(exp, v); setRating(null) }} />
    </section>
  )
}

