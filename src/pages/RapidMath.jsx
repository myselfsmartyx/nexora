import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const OPERATIONS = [
  { id: 'addition', label: 'Addition', symbol: '+' },
  { id: 'subtraction', label: 'Subtraction', symbol: '−' },
  { id: 'multiplication', label: 'Multiplication', symbol: '×' },
  { id: 'division', label: 'Division', symbol: '÷' },
  { id: 'factorial', label: 'Factorial', symbol: '!' },
]

const ROUND_SECONDS = 45
const RING_RADIUS = 38
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function factorial(n) {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

// Generates one random problem for the given operation.
function generateProblem(op) {
  if (op === 'addition') {
    const a = 10 + Math.floor(Math.random() * 90)
    const b = 10 + Math.floor(Math.random() * 90)
    return { display: `${a} + ${b}`, answer: a + b }
  }
  if (op === 'subtraction') {
    const a = 20 + Math.floor(Math.random() * 80)
    const b = 10 + Math.floor(Math.random() * (a - 9))
    return { display: `${a} − ${b}`, answer: a - b }
  }
  if (op === 'multiplication') {
    const a = 2 + Math.floor(Math.random() * 11)
    const b = 2 + Math.floor(Math.random() * 11)
    return { display: `${a} × ${b}`, answer: a * b }
  }
  if (op === 'division') {
    const divisor = 2 + Math.floor(Math.random() * 11)
    const quotient = 2 + Math.floor(Math.random() * 11)
    return { display: `${divisor * quotient} ÷ ${divisor}`, answer: quotient }
  }
  // factorial
  const n = 3 + Math.floor(Math.random() * 5) // 3..7
  return { display: `${n}!`, answer: factorial(n) }
}

export default function RapidMath({ session }) {
  const { op } = useParams()

  if (!op) return <OperationPicker />
  return <Game op={op} session={session} />
}

function OperationPicker() {
  const navigate = useNavigate()
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
        <h1 className="text-h3 text-ink-primary font-bold">Rapid Math</h1>
      </header>
      <main className="px-md pt-md pb-2xl flex flex-col gap-sm">
        <p className="text-body-small text-ink-secondary mb-sm">
          Pick an operation. You'll have 45 seconds total — answer as many problems as you can before time runs out.
        </p>
        {OPERATIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => navigate(`/neuro/rapid-math/${o.id}`)}
            className="card p-md flex items-center justify-between transition active:scale-[0.98] hover:border-primary/50"
          >
            <span className="text-body font-semibold text-ink-primary">{o.label}</span>
            <span className="text-h2 text-primary">{o.symbol}</span>
          </button>
        ))}
      </main>
    </div>
  )
}

function Game({ op, session }) {
  const navigate = useNavigate()
  const opMeta = OPERATIONS.find((o) => o.id === op)
  const [problem, setProblem] = useState(() => generateProblem(op))
  const [typed, setTyped] = useState('')
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [score, setScore] = useState(0)
  const [wrongPulse, setWrongPulse] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [saving, setSaving] = useState(false)
  const savedRef = useRef(false)

  // Reset everything when the operation changes (navigating between ops directly).
  useEffect(() => {
    setProblem(generateProblem(op))
    setTyped('')
    setTimeLeft(ROUND_SECONDS)
    setScore(0)
    setGameOver(false)
    savedRef.current = false
  }, [op])

  // Countdown timer — ticks every second until it hits 0, then ends the session.
  useEffect(() => {
    if (gameOver) return
    if (timeLeft <= 0) {
      setGameOver(true)
      return
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, gameOver])

  // Save the final score exactly once when the game ends.
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
        .eq('game_type', 'rapid_math')
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle()
      const isHigh = !prior || score > prior.score
      await supabase.from('neuro_plus_scores').insert({
        user_id: session.user.id,
        game_type: 'rapid_math',
        score,
        duration_seconds: ROUND_SECONDS,
        difficulty_level: OPERATIONS.findIndex((o) => o.id === op) + 1,
        is_high_score: isHigh,
      })
    } catch (err) {
      console.warn('Could not save Rapid Math score:', err.message)
    } finally {
      setSaving(false)
    }
  }

  const submit = useCallback(() => {
    if (typed === '' || gameOver) return
    if (Number(typed) === problem.answer) {
      setScore((s) => s + 1)
      setProblem(generateProblem(op))
      setTyped('')
      // Timer is NOT reset here — it's one 45s session, not 45s per question.
    } else {
      setWrongPulse(true)
      setTimeout(() => setWrongPulse(false), 300)
      setTyped('')
    }
  }, [typed, problem, op, gameOver])

  function pressDigit(d) {
    if (gameOver) return
    setTyped((t) => (t.length >= 6 ? t : t + d))
  }

  // Physical keyboard support — digits, Enter to submit, Backspace to edit, Escape to clear.
  useEffect(() => {
    function onKeyDown(e) {
      if (gameOver) return
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        pressDigit(e.key)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        submit()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setTyped((t) => t.slice(0, -1))
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setTyped('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [gameOver, submit])

  const progress = timeLeft / ROUND_SECONDS
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress)

  return (
    <div>
      <header
        className="flex items-center gap-sm px-md h-16 sticky top-0 z-10 bg-base-bg justify-center relative"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button
          onClick={() => navigate('/neuro/rapid-math')}
          className="absolute left-md w-10 h-10 flex items-center justify-center rounded-full text-ink-primary hover:bg-base-elevated transition"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-h3 text-ink-primary font-bold">Rapid Math · {opMeta?.label}</h1>
      </header>

      <main className="px-md pb-2xl flex flex-col items-center">
        {gameOver ? (
          <div className="w-full max-w-xs mt-2xl card p-lg text-center flex flex-col gap-md items-center">
            <h2 className="text-h1 text-primary">{score}</h2>
            <p className="text-body text-ink-secondary">
              correct in {ROUND_SECONDS}s — {opMeta?.label}
            </p>
            {saving && <p className="text-caption text-ink-tertiary">Saving score…</p>}
            <div className="flex gap-sm w-full mt-sm">
              <button
                onClick={() => {
                  setProblem(generateProblem(op))
                  setTyped('')
                  setTimeLeft(ROUND_SECONDS)
                  setScore(0)
                  setGameOver(false)
                  savedRef.current = false
                }}
                className="flex-1 btn-primary py-3"
              >
                Play Again
              </button>
              <button onClick={() => navigate('/neuro/rapid-math')} className="flex-1 btn-secondary">
                Change Op
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Timer ring */}
            <div className="relative w-20 h-20 mt-lg flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={RING_RADIUS} fill="none" style={{ stroke: 'rgb(var(--c-border, 48 54 61))' }} strokeWidth="4" />
                <circle
                  cx="40"
                  cy="40"
                  r={RING_RADIUS}
                  fill="none"
                  style={{ stroke: 'rgb(var(--c-primary, 0 212 170))' }}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="absolute text-xl font-bold text-ink-primary tracking-wider">{timeLeft}</span>
            </div>

            <div className="mt-lg text-caption text-ink-secondary">Score: {score}</div>

            {/* Problem */}
            <div className={`mt-md text-center transition ${wrongPulse ? 'text-error' : 'text-ink-primary'}`}>
              <div className="text-[28px] font-bold tracking-tight">
                {problem.display} = {typed || '_____'}
              </div>
            </div>

            {/* Keypad */}
            <div className="w-[204px] grid grid-cols-3 gap-3 mx-auto mt-xl">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button
                  key={d}
                  onClick={() => pressDigit(String(d))}
                  className="w-[60px] h-[60px] rounded-input bg-base-elevated border border-base-border text-ink-primary text-2xl font-bold flex items-center justify-center active:scale-95 active:border-primary transition"
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-md flex gap-3 justify-center items-center w-full max-w-[300px] mx-auto">
              <button
                onClick={() => setTyped('')}
                className="h-[50px] flex-1 bg-base-elevated text-ink-primary rounded-full font-bold uppercase tracking-wider text-sm active:scale-95 transition"
              >
                Clear
              </button>
              <button
                onClick={() => pressDigit('0')}
                className="h-[50px] w-[70px] bg-base-elevated border border-base-border rounded-full text-ink-primary text-xl font-bold flex items-center justify-center active:scale-95 transition"
              >
                0
              </button>
              <button
                onClick={submit}
                className="h-[50px] flex-1 bg-primary text-base-bg rounded-full font-bold uppercase tracking-wider text-sm active:scale-95 transition"
              >
                Enter
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
