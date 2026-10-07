import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, PenLine } from 'lucide-react'
import { fetchDailyStats } from '../../lib/journal/data.js'
import { moodInfo } from '../../lib/journal/constants.js'
import { fromISO, toISO, todayLocal } from '../../lib/journal/dates.js'
import { Skeleton } from './ui.jsx'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarView({ onOpenDay, onWriteDay, dataVersion }) {
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [stats, setStats] = useState(null)
  const today = todayLocal()

  const first = toISO(cursor)
  const last = toISO(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0))

  useEffect(() => {
    let cancelled = false
    setStats(null)
    fetchDailyStats(first, last).then((r) => !cancelled && setStats(r)).catch(() => !cancelled && setStats([]))
    return () => { cancelled = true }
  }, [first, last, dataVersion])

  const byDay = useMemo(() => new Map((stats || []).map((s) => [s.entry_date, s])), [stats])
  const cells = useMemo(() => {
    const lead = (cursor.getDay() + 6) % 7 // Monday-first
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => toISO(new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)))]
  }, [cursor])

  const total = (stats || []).reduce((s, d) => s + d.entries, 0)
  const words = (stats || []).reduce((s, d) => s + d.words, 0)
  const move = (delta) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))
  const isCurrentMonth = first.slice(0, 7) === today.slice(0, 7)

  return (
    <section className="card p-md animate-rise" aria-label="Calendar">
      <div className="flex items-center justify-between mb-md">
        <button aria-label="Previous month" onClick={() => move(-1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-base-elevated transition"><ChevronLeft size={20} /></button>
        <div className="text-center">
          <h2 className="text-h3 text-ink-primary">{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          {!isCurrentMonth && <button className="text-caption text-primary" onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)) }}>Back to today</button>}
        </div>
        <button aria-label="Next month" onClick={() => move(1)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-base-elevated transition"><ChevronRight size={20} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((d) => <div key={d} className="text-center text-[11px] text-ink-tertiary">{d}</div>)}
      </div>
      {stats === null ? (
        <Skeleton className="h-[260px]" />
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`b${i}`} />
            const s = byDay.get(iso)
            const m = s ? moodInfo(s.top_mood) : null
            const future = iso > today
            const isToday = iso === today
            return (
              <button key={iso} disabled={future}
                onClick={() => (s ? onOpenDay(iso) : onWriteDay(iso))}
                aria-label={`${fromISO(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}${s ? `, ${s.entries} entr${s.entries === 1 ? 'y' : 'ies'}` : ', no entries'}`}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-body-small transition active:scale-90 disabled:opacity-30
                  ${s ? 'bg-base-elevated text-ink-primary hover:bg-primary/10' : 'text-ink-secondary hover:bg-base-elevated'} ${isToday ? 'ring-1 ring-primary' : ''}`}>
                <span className={isToday ? 'text-primary font-semibold' : ''}>{Number(iso.slice(8))}</span>
                {s && <span className="mt-0.5 flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: m?.color || 'rgb(var(--c-primary))' }} />{s.entries > 1 && <span className="text-[9px] text-ink-tertiary leading-none">{s.entries}</span>}</span>}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex items-center justify-between mt-md pt-md border-t border-base-border/60">
        <p className="text-caption text-ink-secondary">{total} entr{total === 1 ? 'y' : 'ies'} · {words.toLocaleString()} words this month</p>
        <button onClick={() => onWriteDay(today)} className="text-caption text-primary font-semibold inline-flex items-center gap-1"><PenLine size={14} /> Write today</button>
      </div>
    </section>
  )
}
