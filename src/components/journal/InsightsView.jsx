import { useEffect, useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import { fetchDailyStats } from '../../lib/journal/data.js'
import { addDaysISO, fromISO, todayLocal } from '../../lib/journal/dates.js'
import { ProBadge, Skeleton, TagChip } from './ui.jsx'
import { useJournal } from '../../lib/journal/context.jsx'

const level = (n) => (n >= 3 ? 1 : n === 2 ? 0.7 : n === 1 ? 0.45 : 0)

function Heat({ days, byDay, small }) {
  const today = todayLocal()
  const start = addDaysISO(today, -(days - 1))
  const lead = (fromISO(start).getDay() + 6) % 7
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => addDaysISO(start, i))]
  const size = small ? 14 : 11
  return (
    <div className="overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      <div className="grid gap-[3px] w-max" style={{ gridAutoFlow: 'column', gridTemplateRows: `repeat(7, ${size}px)`, gridAutoColumns: `${size}px` }}>
        {cells.map((iso, i) => {
          if (!iso) return <div key={`b${i}`} />
          const n = byDay.get(iso)?.entries || 0
          return <div key={iso} title={`${iso}: ${n} entr${n === 1 ? 'y' : 'ies'}`} className="rounded-[3px] transition-colors"
            style={{ background: n ? `rgb(var(--c-primary) / ${level(n)})` : 'rgb(var(--c-elevated))', outline: iso === today ? '1px solid rgb(var(--c-primary))' : 'none' }} />
        })}
      </div>
    </div>
  )
}

function MoodTrend({ stats }) {
  // weekly average of daily mood scores, last 12 weeks (1 = stressed … 5 = excited)
  const today = todayLocal()
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const end = addDaysISO(today, -7 * (11 - i))
    const begin = addDaysISO(end, -6)
    const inWeek = stats.filter((s) => s.entry_date >= begin && s.entry_date <= end && s.mood_score != null)
    const w = inWeek.reduce((a, s) => a + s.entries, 0)
    return { end, v: w ? inWeek.reduce((a, s) => a + Number(s.mood_score) * s.entries, 0) / w : null }
  })
  const pts = weeks.map((w, i) => (w.v == null ? null : [20 + i * 26, 70 - ((w.v - 1) / 4) * 60])).filter(Boolean)
  if (pts.length < 2) return <p className="text-body-small text-ink-secondary py-md">Add moods to a few entries across different weeks to see your trend.</p>
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
  return (
    <svg viewBox="0 0 330 90" className="w-full" role="img" aria-label="Mood trend over the last 12 weeks">
      {[1, 3, 5].map((v) => <line key={v} x1="12" x2="318" y1={70 - ((v - 1) / 4) * 60} y2={70 - ((v - 1) / 4) * 60} stroke="rgb(var(--c-border))" strokeDasharray="3 4" opacity=".6" />)}
      <path d={d} fill="none" stroke="rgb(var(--c-primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="rgb(var(--c-primary))" />)}
      <text x="2" y="14" fontSize="10" fill="rgb(var(--c-ink-3))">😄</text><text x="2" y="76" fontSize="10" fill="rgb(var(--c-ink-3))">😣</text>
      <text x="20" y="88" fontSize="9" fill="rgb(var(--c-ink-3))">12 weeks ago</text><text x="282" y="88" fontSize="9" fill="rgb(var(--c-ink-3))">now</text>
    </svg>
  )
}

function Rhythm({ stats }) {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const counts = Array(7).fill(0)
  stats.forEach((s) => { counts[(fromISO(s.entry_date).getDay() + 6) % 7] += s.entries })
  const max = Math.max(1, ...counts)
  const best = counts.indexOf(Math.max(...counts))
  return (
    <div>
      <div className="flex items-end gap-2 h-24">
        {counts.map((c, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
            <div className="w-full rounded-t-md transition-all duration-700" style={{ height: `${Math.max(4, (c / max) * 100)}%`, background: i === best && c ? 'rgb(var(--c-primary))' : 'rgb(var(--c-primary) / .3)' }} title={`${names[i]}: ${c}`} />
            <span className="text-[10px] text-ink-tertiary">{names[i]}</span>
          </div>
        ))}
      </div>
      {counts[best] > 0 && <p className="text-caption text-ink-secondary mt-2">You write most on <b className="text-ink-primary">{names[best]}days</b>.</p>}
    </div>
  )
}

function Panel({ title, pro, children }) {
  return (
    <section className="card p-md animate-rise">
      <h3 className="text-body font-semibold text-ink-primary mb-md flex items-center gap-2">{title}{pro && <ProBadge />}</h3>
      {children}
    </section>
  )
}

// Shows the REAL chart, softly blurred, with a clear unlock card — free users see exactly what they'd get.
function ProGate({ locked, onUnlock, children }) {
  if (!locked) return children
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[5px] opacity-60" aria-hidden>{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <button onClick={onUnlock} className="flex items-center gap-2 bg-base-surface/95 border border-warning/50 text-ink-primary rounded-button px-md py-2.5 shadow-card active:scale-95 transition">
          <Lock size={16} className="text-warning" /><span className="text-body-small font-semibold">Unlock with Pro</span>
        </button>
      </div>
    </div>
  )
}

export default function InsightsView({ onFilterTag, dataVersion }) {
  const { isPro, tags, tagColor, openUpgrade, overview } = useJournal()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    const today = todayLocal()
    fetchDailyStats(addDaysISO(today, -364), today).then((r) => !cancelled && setStats(r)).catch(() => !cancelled && setStats([]))
    return () => { cancelled = true }
  }, [dataVersion])

  const byDay = useMemo(() => new Map((stats || []).map((s) => [s.entry_date, s])), [stats])
  const top = tags.filter((t) => t.uses > 0).slice(0, 8)
  const maxUse = Math.max(1, ...top.map((t) => t.uses))

  if (stats === null) return <div className="flex flex-col gap-md"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
  if (!overview?.total) return <div className="card p-lg text-center text-body-small text-ink-secondary">Write a few entries and your patterns will show up here.</div>

  return (
    <div className="flex flex-col gap-md">
      <Panel title="Last 8 weeks"><Heat days={56} byDay={byDay} small /></Panel>

      {top.length > 0 && (
        <Panel title="Top tags">
          <div className="flex flex-col gap-2">
            {top.map((t) => (
              <button key={t.tag} onClick={() => onFilterTag(t.tag)} className="flex items-center gap-sm text-left group">
                <span className="w-24 shrink-0"><TagChip name={t.tag} color={tagColor(t.tag)} size="xs" /></span>
                <span className="flex-1 h-2 rounded-full bg-base-elevated overflow-hidden"><span className="block h-full rounded-full transition-all duration-700" style={{ width: `${(t.uses / maxUse) * 100}%`, background: tagColor(t.tag) }} /></span>
                <span className="text-caption text-ink-tertiary tabular-nums w-8 text-right">{t.uses}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Your year" pro={!isPro}>
        <ProGate locked={!isPro} onUnlock={() => openUpgrade('insights')}>
          <Heat days={364} byDay={byDay} />
          <p className="text-caption text-ink-secondary mt-2">{(stats || []).length} days written in the last 12 months</p>
        </ProGate>
      </Panel>

      <Panel title="Mood trend" pro={!isPro}>
        <ProGate locked={!isPro} onUnlock={() => openUpgrade('insights')}><MoodTrend stats={stats} /></ProGate>
      </Panel>

      <Panel title="Weekly rhythm" pro={!isPro}>
        <ProGate locked={!isPro} onUnlock={() => openUpgrade('insights')}><Rhythm stats={stats} /></ProGate>
      </Panel>
    </div>
  )
}
