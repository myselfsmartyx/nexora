import { useEffect, useRef, useState } from 'react'
import { Flame } from 'lucide-react'
import { MOODS } from '../../lib/journal/constants.js'

function useCountUp(target, ms = 650) {
  const [v, setV] = useState(typeof target === 'number' ? target : 0)
  const prev = useRef(v)
  useEffect(() => {
    if (typeof target !== 'number') return undefined
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || prev.current === target) { setV(target); prev.current = target; return undefined }
    const from = prev.current
    const t0 = performance.now()
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(Math.round(from + (target - from) * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
      else prev.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

const compact = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toLocaleString())

function Stat({ label, value, icon, sub }) {
  const n = useCountUp(value)
  return (
    <div className="flex-1 min-w-0 text-center">
      <p className="text-h2 text-ink-primary tabular-nums leading-none flex items-center justify-center gap-1">{icon}{compact(n)}</p>
      <p className="text-caption text-ink-tertiary mt-1.5 truncate">{label}</p>
      {sub && <p className="text-[10px] text-ink-tertiary/80 truncate">{sub}</p>}
    </div>
  )
}

export default function StatsStrip({ overview }) {
  if (!overview) return <div className="card h-[108px] animate-shimmer" />
  const total = overview.total || 0
  const moods = overview.moods || {}
  const moodTotal = MOODS.reduce((s, m) => s + (moods[m.id] || 0), 0)
  return (
    <section className="card p-md animate-rise" aria-label="Journal stats">
      <div className="flex items-start divide-x divide-base-border/60">
        <Stat label="day streak" value={overview.streak || 0} sub={overview.best_streak > (overview.streak || 0) ? `best ${overview.best_streak}` : null}
          icon={<Flame size={18} className={overview.streak ? 'text-warning' : 'text-ink-tertiary'} />} />
        <Stat label="entries" value={total} />
        <Stat label="words" value={overview.words || 0} />
        <Stat label="days written" value={overview.active_days || 0} />
      </div>
      {moodTotal > 0 && (
        <div className="mt-md">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-base-elevated" role="img" aria-label="Mood distribution">
            {MOODS.map((m) => (moods[m.id] ? <div key={m.id} title={`${m.label}: ${moods[m.id]}`} style={{ width: `${(moods[m.id] / moodTotal) * 100}%`, background: m.color }} className="transition-all duration-500" /> : null))}
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-2">
            {MOODS.filter((m) => moods[m.id]).map((m) => (
              <span key={m.id} className="text-[11px] text-ink-tertiary inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />{m.label} {moods[m.id]}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
