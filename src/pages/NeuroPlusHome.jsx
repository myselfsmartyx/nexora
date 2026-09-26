import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Play, Grid3x3, Calculator, Puzzle, CalendarDays, Trophy, Brain } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const GAMES = [
  { id: 'memory_matrix', label: 'Memory Matrix', sub: 'Pattern recall', icon: Grid3x3, route: null },
  { id: 'rapid_math', label: 'Rapid Math', sub: '45-s challenges', icon: Calculator, route: '/neuro/rapid-math' },
  { id: 'chess', label: 'Chess', sub: 'Strategic thinking', icon: Puzzle, route: null },
  { id: 'schulte_table', label: 'Schulte Table', sub: 'Speed-reading training', icon: CalendarDays, route: null },
]

function computeStreak(dates) {
  const days = new Set(dates)
  let streak = 0
  const cursor = new Date()
  for (;;) {
    const iso = cursor.toISOString().slice(0, 10)
    if (days.has(iso)) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export default function NeuroPlusHome({ session }) {
  const navigate = useNavigate()
  const [bestScores, setBestScores] = useState({})
  const [streak, setStreak] = useState(0)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('neuro_plus_scores')
          .select('game_type, score, played_at')
          .eq('user_id', session.user.id)
          .order('score', { ascending: false })
        if (error) throw error
        const best = {}
        const days = []
        for (const row of data || []) {
          if (!(row.game_type in best)) best[row.game_type] = row.score
          if (row.played_at) days.push(row.played_at.slice(0, 10))
        }
        setBestScores(best)
        setStreak(computeStreak(days))
      } catch (err) {
        console.warn('Neuro+ scores load failed:', err.message)
      }
    }
    load()
  }, [session.user.id])

  function openGame(game) {
    if (game.route) {
      navigate(game.route)
    } else {
      setToast(`${game.label} is coming soon.`)
      setTimeout(() => setToast(null), 2500)
    }
  }

  return (
    <div>
      <header
        className="sticky top-0 z-40 bg-base-bg/80 backdrop-blur-xl px-md h-16 border-b border-base-border/50 flex justify-between items-center"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <h1 className="text-h1 text-primary tracking-tight">NEXORA</h1>
        <div className="flex items-center gap-1.5 chip">
          <Brain size={14} className="text-primary" />
          <span className="text-ink-primary font-semibold">Streak: {streak}</span>
        </div>
      </header>

      <main className="px-md pt-md pb-2xl flex flex-col gap-lg">
        <section className="flex flex-col gap-xs">
          <h2 className="text-h1 text-ink-primary">Neuro+</h2>
          <p className="text-body text-ink-secondary">Train your mind. Build mental agility.</p>
        </section>

        {/* Daily challenge banner */}
        <button
          onClick={() => navigate('/neuro/rapid-math')}
          className="relative overflow-hidden rounded-card bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 p-md flex items-center justify-between shadow-glow transition active:scale-[0.98] text-left"
        >
          <div className="flex flex-col gap-xs w-[80%]">
            <div className="flex items-center gap-xs">
              <Zap size={16} className="text-primary" />
              <span className="text-caption uppercase text-primary tracking-wider font-bold">Daily Challenge</span>
            </div>
            <h3 className="text-h3 text-ink-primary leading-tight">Solve 10 math problems in 3 minutes</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-base-bg shadow-lg shrink-0">
            <Play size={18} />
          </div>
        </button>

        {/* Game grid */}
        <section className="grid grid-cols-2 gap-md">
          {GAMES.map((g) => {
            const Icon = g.icon
            const best = bestScores[g.id]
            return (
              <button
                key={g.id}
                onClick={() => openGame(g)}
                className="card p-md flex flex-col gap-md text-left transition active:scale-95 hover:border-primary/50"
              >
                <div className="w-10 h-10 rounded-lg bg-base-elevated border border-base-border flex items-center justify-center text-primary">
                  <Icon size={20} />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-body font-semibold text-ink-primary">{g.label}</h4>
                  <p className="text-caption text-ink-secondary">{g.sub}</p>
                </div>
                <div className="flex items-center gap-xs pt-sm border-t border-base-border/50">
                  <Trophy size={13} className="text-ink-tertiary" />
                  <span className="text-caption text-ink-secondary font-mono">
                    Best: {best != null ? best.toLocaleString() : '—'}
                  </span>
                </div>
              </button>
            )
          })}
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-base-elevated border border-base-border text-ink-primary text-body-small px-md py-2.5 rounded-button shadow-card whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
