import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Crown, Lock, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { usePlan } from '../lib/billing/usePlan.js'
import { summarize, formatBest } from '../lib/neuroStats.js'

function Trend({ change }) {
  if (change == null) return <span className="text-caption text-ink-tertiary">Play more to see a trend</span>
  if (Math.abs(change) < 1) return <span className="text-caption text-ink-secondary flex items-center gap-1"><Minus size={13} /> Holding steady</span>
  const up = change > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`text-caption font-semibold flex items-center gap-1 ${up ? 'text-primary' : 'text-ink-secondary'}`}>
      <Icon size={13} /> {up ? '+' : ''}{Math.round(change)}% vs last week
    </span>
  )
}

function ActivityStrip({ days }) {
  const max = Math.max(1, ...days.map((d) => d.n))
  return (
    <div className="flex items-end gap-1 h-16" role="img" aria-label="Sessions per day over the last 14 days">
      {days.map((d) => (
        <div key={d.t} className="flex-1 rounded-sm bg-primary/70" style={{ height: `${Math.max(6, (d.n / max) * 100)}%`, opacity: d.n ? 1 : 0.25 }} />
      ))}
    </div>
  )
}

export default function NeuroProgress({ session }) {
  const navigate = useNavigate()
  const { isPro, loading: planLoading } = usePlan()
  const [rows, setRows] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let off = false
    supabase
      .from('neuro_plus_scores')
      .select('game_type, score, duration_seconds, played_at')
      .eq('user_id', session.user.id)
      .order('played_at', { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (off) return
        if (error) setFailed(true)
        else setRows(data || [])
      })
    return () => { off = true }
  }, [session.user.id])

  const stats = useMemo(() => (rows ? summarize(rows) : null), [rows])
  const locked = !isPro

  const report = stats && (
    stats.weekSessions === 0
      ? 'No sessions this week yet. One short game today starts your next trend.'
      : `This week: ${stats.weekSessions} ${stats.weekSessions === 1 ? 'session' : 'sessions'}.${
        stats.topGain ? ` Biggest gain: ${stats.topGain.label}, up ${Math.round(stats.topGain.change)}%.` : ' Keep going. Trends appear after two weeks of play.'
      }`
  )

  return (
    <div className="px-md pt-md pb-2xl">
      <div className="flex items-center gap-sm mb-md">
        <button aria-label="Back" onClick={() => navigate('/neuro')} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-ink-secondary hover:bg-base-elevated transition">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-h2 text-ink-primary">Brain Progress</h1>
        <span className="rounded-chip bg-primary text-base-bg text-caption font-bold px-2 py-0.5 flex items-center gap-1"><Crown size={11} /> Pro</span>
      </div>

      {failed && <p role="alert" className="card p-md text-body-small text-ink-secondary">Couldn't load your scores. Check your connection and try again.</p>}
      {!failed && (!stats || planLoading) && <div className="card p-lg h-48 animate-shimmer" />}

      {stats && !planLoading && !failed && (
        <div className="flex flex-col gap-md">
          <section className="card p-md">
            <p className="text-body text-ink-primary font-semibold">
              {stats.totalSessions === 0 ? 'Your brain training starts here.' : `You've trained ${stats.totalSessions} ${stats.totalSessions === 1 ? 'session' : 'sessions'}, about ${stats.minutes} ${stats.minutes === 1 ? 'minute' : 'minutes'} in total.`}
            </p>
            <p className="text-body-small text-ink-secondary mt-1">
              {locked ? 'With Pro you can see exactly how much sharper you are getting.' : report}
            </p>
          </section>

          <div className="relative">
            <div className={`flex flex-col gap-md ${locked ? 'blur-[6px] select-none pointer-events-none' : ''}`} aria-hidden={locked}>
              <section className="card p-md">
                <h2 className="text-h3 text-ink-primary mb-sm">Last 14 days</h2>
                <ActivityStrip days={stats.days} />
              </section>
              {stats.games.map((g) => (
                <section key={g.id} className="card p-md flex items-center justify-between gap-md">
                  <div>
                    <h3 className="text-body font-semibold text-ink-primary">{g.label}</h3>
                    <p className="text-caption text-ink-secondary font-mono">Best: {formatBest(g.id, g.best)} · {g.sessions} {g.sessions === 1 ? 'session' : 'sessions'}</p>
                  </div>
                  <Trend change={g.change} />
                </section>
              ))}
            </div>

            {locked && (
              <div className="absolute inset-0 flex items-center justify-center p-md">
                <div className="card p-lg text-center shadow-card border-primary/40 max-w-xs">
                  <Lock size={22} className="text-primary mx-auto mb-sm" />
                  <p className="text-body text-ink-primary font-semibold">See your brain getting sharper</p>
                  <p className="text-caption text-ink-secondary mt-1">Trends, records and a weekly brain report for all four games.</p>
                  <button className="btn-primary w-full py-3 mt-md" onClick={() => navigate('/upgrade?reason=neuro')}>See what Pro unlocks</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
