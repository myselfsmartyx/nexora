import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Timer } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const GRID_N = 25 // 5x5
const RADIUS = 48
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function shuffledNumbers() {
  const nums = Array.from({ length: GRID_N }, (_, i) => i + 1)
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[nums[i], nums[j]] = [nums[j], nums[i]]
  }
  return nums
}

// Reshuffles only the not-yet-found numbers (value > justFoundTarget) among their own
// slots, leaving already-found tiles exactly where they are.
function reshuffleRemaining(board, justFoundTarget) {
  const indices = []
  const values = []
  board.forEach((val, idx) => {
    if (val > justFoundTarget) {
      indices.push(idx)
      values.push(val)
    }
  })
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  const next = [...board]
  indices.forEach((idx, k) => {
    next[idx] = values[k]
  })
  return next
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function SchulteTable({ session }) {
  const navigate = useNavigate()
  const [board, setBoard] = useState(() => shuffledNumbers())
  const [target, setTarget] = useState(1)
  const [elapsed, setElapsed] = useState(0)
  const [wrongTile, setWrongTile] = useState(null)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const savedRef = useRef(false)

  // Stopwatch — counts up until the board is solved.
  useEffect(() => {
    if (done) return
    const id = setTimeout(() => setElapsed((e) => e + 1), 1000)
    return () => clearTimeout(id)
  }, [elapsed, done])

  useEffect(() => {
    if (!done || savedRef.current) return
    savedRef.current = true
    saveScore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  async function saveScore() {
    setSaving(true)
    try {
      // Lower elapsed time is better for this game — invert the usual "higher is better" comparison.
      const { data: prior } = await supabase
        .from('neuro_plus_scores')
        .select('score')
        .eq('user_id', session.user.id)
        .eq('game_type', 'schulte_table')
        .order('score', { ascending: true })
        .limit(1)
        .maybeSingle()
      const isHigh = !prior || elapsed < prior.score
      await supabase.from('neuro_plus_scores').insert({
        user_id: session.user.id,
        game_type: 'schulte_table',
        score: elapsed,
        duration_seconds: elapsed,
        difficulty_level: 1,
        is_high_score: isHigh,
      })
    } catch (err) {
      console.warn('Could not save Schulte Table score:', err.message)
    } finally {
      setSaving(false)
    }
  }

  function tapNumber(n) {
    if (done) return
    if (n === target) {
      if (target === GRID_N) {
        setDone(true)
      } else {
        setBoard((b) => reshuffleRemaining(b, target))
        setTarget((t) => t + 1)
      }
    } else {
      setWrongTile(n)
      setTimeout(() => setWrongTile(null), 250)
    }
  }

  function restart() {
    setBoard(shuffledNumbers())
    setTarget(1)
    setElapsed(0)
    setDone(false)
    savedRef.current = false
  }

  const progress = (target - 1) / GRID_N
  const dashOffset = CIRCUMFERENCE * (1 - progress)

  return (
    <div>
      <header
        className="flex items-center px-md h-16 sticky top-0 z-10 bg-base-bg justify-between"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button
          onClick={() => navigate('/neuro')}
          className="w-10 h-10 flex items-center justify-center rounded-full text-ink-primary hover:bg-base-elevated transition"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-h3 text-ink-primary font-bold absolute left-1/2 -translate-x-1/2">Schulte Table</h1>
        <div className="flex items-center text-primary text-body-small bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
          <Timer size={16} className="mr-1" />
          {formatTime(elapsed)}
        </div>
      </header>

      <main className="px-md pb-2xl flex flex-col items-center">
        {done ? (
          <div className="w-full max-w-xs mt-2xl card p-lg text-center flex flex-col gap-md items-center">
            <h2 className="text-h1 text-primary">{formatTime(elapsed)}</h2>
            <p className="text-body text-ink-secondary">Board solved — faster is better</p>
            {saving && <p className="text-caption text-ink-tertiary">Saving score…</p>}
            <button onClick={restart} className="w-full btn-primary py-3 mt-sm">
              Play Again
            </button>
          </div>
        ) : (
          <>
            <div className="mt-lg bg-base-elevated border border-base-border px-6 py-3 rounded-full shadow-lg flex items-center justify-center">
              <span className="text-ink-secondary text-body-small mr-2">Tap numbers in order:</span>
              <span className="text-ink-primary text-h3">Find {target}</span>
            </div>

            <div className="relative w-full max-w-[360px] flex items-center justify-center mt-xl">
              <svg className="absolute inset-0 w-full h-full pointer-events-none -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#161B22" strokeWidth="2" />
                <circle
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  stroke="#00D4AA"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                />
              </svg>
              <div className="grid grid-cols-5 gap-2 w-full z-10 p-3">
                {board.map((n) => {
                  const isFound = n < target
                  const isWrong = wrongTile === n
                  return (
                    <button
                      key={n}
                      onClick={() => tapNumber(n)}
                      disabled={isFound}
                      className={`flex items-center justify-center rounded-lg text-[18px] font-bold w-full aspect-square min-w-[55px] min-h-[55px] transition-all active:scale-95 ${
                        isFound
                          ? 'bg-primary/20 border border-primary/50 text-primary'
                          : isWrong
                          ? 'bg-error/20 border border-error text-white'
                          : 'bg-base-elevated border border-base-border text-ink-primary'
                      }`}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>

            <p className="text-ink-secondary text-body-small text-center mt-lg max-w-xs">
              Keep your eyes near the center and use peripheral vision to find the next number.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
