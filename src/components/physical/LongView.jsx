import { useMemo } from 'react'
import { Sparkles, Loader2, Lock, Eye, Lightbulb, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react'
import { directionPhrase, evidenceLine } from '../../lib/physical/analysis.js'
import { ProBadge } from '../journal/ui.jsx'
import { daysBetween, todayLocal, relativeTime } from '../../lib/journal/dates.js'

const TONE = { calm: 'text-success', change: 'text-primary', muted: 'text-ink-tertiary' }
const DIR_ICON = { up: '↗', down: '↘', steady: '→', unknown: '·' }

export function DirectionChips({ dirs, hideNumbers }) {
  const items = [['energy', 'Energy'], ['sleep', 'Sleep'], ['activity', 'Movement'], ...(hideNumbers ? [] : [['weight', 'Weight']])]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm">
      {items.map(([k, label]) => {
        const p = directionPhrase(k, dirs[k])
        return (
          <div key={k} className="rounded-card border border-base-border bg-base-surface px-md py-sm">
            <p className="text-caption text-ink-tertiary">{label}</p>
            <p className={`text-body-small font-semibold flex items-center gap-1.5 ${TONE[p.tone]}`}><span aria-hidden>{DIR_ICON[dirs[k].state]}</span>{p.word}</p>
            <p className="text-[11px] text-ink-tertiary truncate">{p.hint}</p>
          </div>
        )
      })}
    </div>
  )
}

// Time on a real axis: gaps look like gaps (no guilt), points are tappable.
export function TrendRibbon({ snapshots, hideNumbers, onSelect }) {
  const today = todayLocal()
  const pts = useMemo(() => [...snapshots].filter((s) => daysBetween(s.taken_on, today) <= 400).sort((a, b) => a.taken_on.localeCompare(b.taken_on)), [snapshots, today])
  if (pts.length === 0) {
    return <div className="rounded-card border border-dashed border-base-border p-md text-center text-body-small text-ink-secondary">Your long view will draw itself here. Two or three snapshots over a few months is plenty.</div>
  }
  const start = pts.length > 1 ? Math.min(daysBetween(pts[0].taken_on, today), 365) : 120
  const W = 330, H = 120, padL = 10, padR = 10
  const x = (iso) => padL + (1 - Math.min(daysBetween(iso, today), start) / start) * (W - padL - padR)
  const yE = (v) => 14 + (1 - (v - 1) / 4) * (H - 40)
  const wts = pts.filter((p) => p.weight_kg != null).map((p) => Number(p.weight_kg))
  const wMin = Math.min(...wts), wMax = Math.max(...wts)
  const yW = (v) => 14 + (1 - (wMax === wMin ? 0.5 : (v - wMin) / (wMax - wMin))) * (H - 40)
  const months = []
  for (let i = 0; i <= Math.min(Math.floor(start / 30), 12); i++) { const d = new Date(); d.setMonth(d.getMonth() - i); months.push({ label: d.toLocaleDateString(undefined, { month: 'short' }), iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15` }) }
  const line = (key, y) => {
    const s = pts.filter((p) => p[key] != null)
    let d = ''
    s.forEach((p, i) => { const gap = i > 0 && daysBetween(s[i - 1].taken_on, p.taken_on) > 75; d += `${i === 0 || gap ? 'M' : 'L'}${x(p.taken_on).toFixed(1)},${y(Number(p[key])).toFixed(1)} ` })
    return d
  }
  return (
    <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[300px]" role="img" aria-label="Energy and sleep over time, with gaps shown honestly">
        {[1, 3, 5].map((v) => <line key={v} x1={padL} x2={W - padR} y1={yE(v)} y2={yE(v)} stroke="rgb(var(--c-border))" strokeDasharray="2 5" opacity=".7" />)}
        {!hideNumbers && wts.length > 1 && <path d={line('weight_kg', yW)} fill="none" stroke="rgb(var(--c-ink-3))" strokeWidth="1.5" strokeDasharray="1 4" strokeLinecap="round" opacity=".8" />}
        <path d={line('sleep', yE)} fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
        <path d={line('energy', yE)} fill="none" stroke="rgb(var(--c-primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p) => (
          <g key={p.id} onClick={() => onSelect(p)} style={{ cursor: 'pointer' }} role="button" aria-label={`Snapshot ${p.taken_on}`}>
            <circle cx={x(p.taken_on)} cy={p.energy != null ? yE(p.energy) : p.sleep != null ? yE(p.sleep) : H - 22} r="9" fill="transparent" />
            <circle cx={x(p.taken_on)} cy={p.energy != null ? yE(p.energy) : p.sleep != null ? yE(p.sleep) : H - 22} r="4" fill={p.energy != null ? 'rgb(var(--c-primary))' : 'rgb(var(--c-ink-3))'} />
          </g>
        ))}
        {months.filter((_, i) => i % (start > 200 ? 2 : 1) === 0).map((m) => <text key={m.iso} x={x(m.iso)} y={H - 4} fontSize="9" textAnchor="middle" fill="rgb(var(--c-ink-3))">{m.label}</text>)}
      </svg>
      <div className="flex items-center gap-md text-[11px] text-ink-tertiary mt-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Energy</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary" /> Sleep</span>
        {!hideNumbers && wts.length > 1 && <span>┄ Weight (shape only)</span>}
        <span className="ml-auto">Gaps are normal</span>
      </div>
    </div>
  )
}

function Dots({ level }) {
  const n = { none: 0, low: 1, medium: 2, high: 3 }[level]
  return <span className="inline-flex gap-0.5" aria-label={`Confidence: ${level}`}>{[0, 1, 2].map((i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < n ? 'bg-primary' : 'bg-base-border'}`} />)}</span>
}

export function localStory({ profile, dirs, ev, goalName }) {
  const known = Object.entries({ energy: 'energy', sleep: 'sleep', activity: 'movement' }).filter(([k]) => dirs[k].state !== 'unknown')
  if (!known.length) {
    return profile && !profile.skipped
      ? `There isn’t enough over time yet to say much about direction${goalName ? ` toward “${goalName.toLowerCase()}”` : ''}. That’s expected — a couple of snapshots a few weeks apart is all it takes. Meanwhile, one small experiment below is the most useful thing you can do.`
      : 'Nothing logged yet, and that’s completely fine. Nexora works with whatever you give it — a baseline, a snapshot now and then, or just your journal.'
  }
  const bits = known.map(([k, name]) => `${name} has been ${dirs[k].state === 'steady' ? 'steady' : dirs[k].state === 'up' ? (k === 'sleep' ? 'improving' : 'rising') : (k === 'sleep' ? 'getting worse' : 'lower')}`)
  return `Looking across ${Math.max(...known.map(([k]) => Math.round(dirs[k].spanDays / 7)))} weeks: ${bits.join(', ')}. Small shifts between snapshots are noise; the direction is what counts.`
}

export default function LongView({ profile, snapshots, dirs, ev, confidence, reading, isPro, hideNumbers, goalName, canRefresh, refreshing, onRefresh, onSelectSnapshot, onUpgrade }) {
  const c = reading?.content
  const headline = c?.headline || 'Your long view'
  const story = c?.story || localStory({ profile, dirs, ev, goalName })
  const age = reading ? daysBetween(reading.created_at.slice(0, 10), todayLocal()) : null
  return (
    <section className="flex flex-col gap-md" aria-label="Your long view">
      <div className="card p-md flex flex-col gap-md animate-rise" style={{ background: 'linear-gradient(160deg, rgb(var(--c-primary) / .07), rgb(var(--c-surface)) 55%)' }}>
        <div className="flex items-start justify-between gap-md">
          <div className="min-w-0">
            <p className="text-caption uppercase tracking-wider text-primary flex items-center gap-1.5"><TrendingUp size={13} /> The long view</p>
            <h2 className="text-h3 text-ink-primary mt-1 leading-snug">{headline}</h2>
          </div>
          <div className="text-right shrink-0"><Dots level={confidence} /><p className="text-[10px] text-ink-tertiary mt-0.5">{{ none: 'no data', low: 'early read', medium: 'fair read', high: 'solid read' }[confidence]}</p></div>
        </div>
        <p className="text-body text-ink-primary leading-relaxed">{story}</p>
        <p className="text-caption text-ink-tertiary">{evidenceLine(ev)}</p>

        {c?.strengths?.length > 0 && (
          <div className="flex flex-col gap-1.5">{c.strengths.map((s) => <p key={s} className="text-body-small text-ink-secondary flex gap-2"><CheckCircle2 size={15} className="text-success shrink-0 mt-0.5" />{s}</p>)}</div>
        )}
        {c?.watch?.length > 0 && (
          <div className="flex flex-col gap-1.5">{c.watch.map((s) => <p key={s} className="text-body-small text-ink-secondary flex gap-2"><Eye size={15} className="text-warning shrink-0 mt-0.5" />{s}</p>)}</div>
        )}
        {c?.leverage?.title && (
          <div className="rounded-card bg-base-elevated border border-base-border p-md">
            <p className="text-caption uppercase tracking-wider text-ink-secondary flex items-center gap-1.5 mb-1"><Lightbulb size={13} /> Highest-impact area</p>
            <p className="text-body-small text-ink-primary font-semibold">{c.leverage.title}</p>
            {c.leverage.why && <p className="text-body-small text-ink-secondary mt-0.5">{c.leverage.why}</p>}
          </div>
        )}

        {c?.reasons?.length > 0 && (
          <div className="flex flex-col gap-sm">
            <p className="text-caption uppercase tracking-wider text-ink-secondary flex items-center gap-1.5"><AlertCircle size={13} /> Possible reasons <span className="normal-case tracking-normal text-ink-tertiary">· not proven</span></p>
            {c.reasons.map((r) => (
              <div key={r.hypothesis} className="rounded-card border border-base-border bg-base-surface p-md">
                <p className="text-body-small text-ink-primary">{r.hypothesis}</p>
                <p className="text-caption text-ink-tertiary mt-1">Because: {r.because} · {r.strength === 'moderate' ? 'moderate' : 'weak'} signal</p>
              </div>
            ))}
          </div>
        )}
        {!isPro && c?.reasons_locked && (
          <button onClick={onUpgrade} className="rounded-card border border-warning/40 bg-warning/5 p-md text-left flex items-center gap-md active:scale-[0.99] transition">
            <Lock size={18} className="text-warning shrink-0" />
            <span className="flex-1"><span className="block text-body-small text-ink-primary font-semibold flex items-center gap-2">I found possible reasons behind your patterns <ProBadge /></span><span className="block text-caption text-ink-secondary">Pro shows what in your journal and snapshots points to each one.</span></span>
          </button>
        )}

        <div className="flex items-center justify-between gap-md pt-1">
          <p className="text-caption text-ink-tertiary">{reading ? `Written ${relativeTime(reading.created_at)}` : 'Not generated yet'}</p>
          {canRefresh ? (
            <button onClick={onRefresh} disabled={refreshing} className="btn-primary !normal-case !tracking-normal py-2 px-md flex items-center gap-1.5 disabled:opacity-60">
              {refreshing ? <><Loader2 size={15} className="animate-spin" /> Reading…</> : <><Sparkles size={15} /> {reading ? 'Update my long view' : 'Read my long view'}</>}
            </button>
          ) : <span className="text-caption text-ink-tertiary">Up to date{age != null && age > 0 ? '' : ' · nothing new yet'}</span>}
        </div>
      </div>
    </section>
  )
}
