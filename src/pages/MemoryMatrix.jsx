import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const SESSION_SECONDS = 45
const GRID_SIZE = 16 // 4x4
const START_LEN = 3
const MAX_LEN = 12
const SHOW_MS_BASE = 1400

function randomPattern(len) {
  const pool = Array.from({ length: GRID_SIZE }, (_, i) => i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, len)
}

const sameSet = (a, b) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',')

export default function MemoryMatrix({ session }) {
  const navigate = useNavigate()
  const [len, setLen] = useState(START_LEN)
  const [pattern, setPattern] = useState(() => randomPattern(START_LEN))
  const [phase, setPhase] = useState('showing') // 'showing' | 'input'
  const [selected, setSelected] = useState([])
  const [wrongFlash, setWrongFlash] = useState(false)
  const [score, setScore] = useState(0)
  const [rounds, setRounds] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SESSION_SECONDS)
  const [gameOver, setGameOver] = useState(false)
  const [saving, setSaving] = useState(false)
  const savedRef = useRef(false)

  // Reveal the pattern briefly, then switch to input phase.
  useEffect(() => {
    if (gameOver) return
    setPhase('showing')
    setSelected([])
    const t = setTimeout(() => setPhase('input'), Math.min(SHOW_MS_BASE + len * 40, 2200))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, gameOver])

  // Session countdown, independent of round phase.
  useEffect(() => {
    if (gameOver) return
    if (timeLeft <= 0) {
      setGameOver(true)
      return
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, gameOver])

  useEffect(() => {
    if (!gameOver || savedRef.current) return
    savedRef.current = true
    saveScore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver])

  async function saveScore() {
    setSaving(true)
    try {
      const { data: prior } = await supabase
        .from('neuro_plus_scores')
        .select('score')
        .eq('user_id', session.user.id)
        .eq('game_type', 'memory_matrix')
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle()
      const isHigh = !prior || score > prior.score
      await supabase.from('neuro_plus_scores').insert({
        user_id: session.user.id,
        game_type: 'memory_matrix',
        score,
        duration_seconds: SESSION_SECONDS,
        difficulty_level: len,
        is_high_score: isHigh,
      })
    } catch (err) {
      console.warn('Could not save Memory Matrix score:', err.message)
    } finally {
      setSaving(false)
    }
  }

  const nextRound = useCallback(
    (nextLen) => {
      setRounds((r) => r + 1)
      setLen(nextLen)
      setPattern(randomPattern(nextLen))
    },
    []
  )

  function tapTile(i) {
    if (phase !== 'input' || gameOver) return
    if (selected.includes(i)) return
    const next = [...selected, i]
    setSelected(next)
    if (next.length === pattern.length) {
      if (sameSet(next, pattern)) {
        setScore((s) => s + pattern.length)
        nextRound(Math.min(len + 1, MAX_LEN))
      } else {
        setWrongFlash(true)
        setTimeout(() => setWrongFlash(false), 300)
        nextRound(len) // same difficulty, new pattern — no punishment, just retry
      }
    }
  }

  function restart() {
    setScore(0)
    setRounds(0)
    setLen(START_LEN)
    setPattern(randomPattern(START_LEN))
    setTimeLeft(SESSION_SECONDS)
    setGameOver(false)
    savedRef.current = false
  }

  return (
    <div>
      <header
        className="flex items-center gap-sm px-md h-16 sticky top-0 z-10 bg-base-bg"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button
          onClick={() => navigate('/neuro')}
          className="w-10 h-10 flex items-center justify-center rounded-full text-ink-primary hover:bg-base-elevated transition"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-h3 text-primary font-bold">Memory Matrix</h1>
      </header>

      <main className="px-md pb-2xl flex flex-col items-center">
        {gameOver ? (
          <div className="w-full max-w-xs mt-2xl card p-lg text-center flex flex-col gap-md items-center">
            <h2 className="text-h1 text-primary">{score}</h2>
            <p className="text-body text-ink-secondary">
              points · {rounds} round{rounds === 1 ? '' : 's'}
            </p>
            {saving && <p className="text-caption text-ink-tertiary">Saving score…</p>}
            <button onClick={restart} className="w-full btn-primary py-3 mt-sm">
              Play Again
            </button>
          </div>
        ) : (
          <>
            <p className="text-body-small text-ink-secondary text-center mt-md mb-lg">
              {phase === 'showing' ? 'Watch the pattern…' : 'Tap the tiles you saw'}
            </p>

            <div
              className={`w-full max-w-[320px] aspect-square grid grid-cols-4 gap-sm mb-xl transition ${
                wrongFlash ? 'animate-pulse' : ''
              }`}
            >
              {Array.from({ length: GRID_SIZE }, (_, i) => {
                const isPatternTile = phase === 'showing' && pattern.includes(i)
                const isSelected = phase === 'input' && selected.includes(i)
                return (
                  <button
                    key={i}
                    onClick={() => tapTile(i)}
                    disabled={phase !== 'input'}
                    className={`rounded-lg border aspect-square transition-all duration-200 ${
                      isPatternTile || isSelected
                        ? 'bg-primary border-primary shadow-glow'
                        : 'bg-base-elevated border-base-border active:scale-95'
                    }`}
                  />
                )
              })}
            </div>

            <div className="flex flex-col items-center gap-xs">
              <div className="text-[48px] font-bold text-primary leading-none tracking-tight">{timeLeft}s</div>
              <span className="text-caption text-ink-secondary uppercase tracking-widest">Time Remaining</span>
              <span className="text-caption text-ink-tertiary mt-sm">Score: {score}</span>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
