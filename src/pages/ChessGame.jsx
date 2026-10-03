import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import { ArrowLeft, Undo2, Brain } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const LIGHT = '#EDE0C8'
const DARK = '#3A5A45'

const UNICODE = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔',
}

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
const STARTING_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1 }
// Conventional display order for a captured-material tray (biggest first).
const CAPTURE_ORDER = ['q', 'r', 'b', 'n', 'p']

// Small positional nudge — center control for pawns/knights matters a lot more
// than for other pieces, so that's all we bother scoring beyond raw material.
const PAWN_PST = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
]
const KNIGHT_PST = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
]

// Base AI search depth (plies). We search one ply deeper in the endgame
// (fewer pieces = smaller branching factor), which happens to solve two
// problems at once: a stronger endgame AND a naturally longer "think" pause
// when the position is simpler but more precise play matters.
const AI_BASE_DEPTH = 2

function searchDepthFor(chess) {
  const nonKingPieces = chess.board().flat().filter((c) => c && c.type !== 'k').length
  return nonKingPieces <= 10 ? AI_BASE_DEPTH + 1 : AI_BASE_DEPTH
}

function evaluate(chess) {
  if (chess.isCheckmate()) {
    // Side to move is checkmated — very good for the other side.
    return chess.turn() === 'w' ? -100000 : 100000
  }
  if (chess.isDraw()) return 0

  let score = 0
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c]
      if (!cell) continue
      const value = PIECE_VALUE[cell.type]
      // board()[0] is rank 8; flip to a1-based index for the PST tables above.
      const idx = (7 - r) * 8 + c
      let positional = 0
      if (cell.type === 'p') positional = PAWN_PST[cell.color === 'w' ? idx : 63 - idx]
      if (cell.type === 'n') positional = KNIGHT_PST[cell.color === 'w' ? idx : 63 - idx]
      const total = value + positional
      score += cell.color === 'w' ? total : -total
    }
  }
  return score
}

function minimax(chess, depth, alpha, beta, maximizing) {
  if (depth === 0 || chess.isGameOver()) return evaluate(chess)
  const moves = chess.moves()
  if (maximizing) {
    let best = -Infinity
    for (const m of moves) {
      chess.move(m)
      best = Math.max(best, minimax(chess, depth - 1, alpha, beta, false))
      chess.undo()
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return best
  }
  let best = Infinity
  for (const m of moves) {
    chess.move(m)
    best = Math.min(best, minimax(chess, depth - 1, alpha, beta, true))
    chess.undo()
    beta = Math.min(beta, best)
    if (beta <= alpha) break
  }
  return best
}

// Searches every legal move at the current position `depth` plies deep and
// returns each move's resulting evaluation (White's perspective, consistent
// sign throughout). Shared by the AI's move choice and by grading the
// player's move, so both use exactly the same yardstick.
function evaluateAllMoves(chess, depth) {
  const moves = chess.moves({ verbose: true })
  const results = []
  for (const m of moves) {
    chess.move(m.san)
    const score = minimax(chess, depth - 1, -Infinity, Infinity, chess.turn() === 'w')
    chess.undo()
    results.push({ move: m, score })
  }
  return results
}

// AI plays Black, so it wants the lowest (most negative) evaluation.
function chooseAIMove(chess, depth) {
  const results = evaluateAllMoves(chess, depth)
  let bestScore = Infinity
  let bestMoves = []
  for (const r of results) {
    if (r.score < bestScore) {
      bestScore = r.score
      bestMoves = [r.move]
    } else if (r.score === bestScore) {
      bestMoves.push(r.move)
    }
  }
  // Small randomness among equally-good moves so the AI isn't perfectly deterministic.
  return bestMoves[Math.floor(Math.random() * bestMoves.length)]
}

// Honest, approximate move-quality grading — the same idea real analysis
// tools use (centipawn loss vs. the best available move), just shallower
// since we're running a phone-friendly search, not a full engine. This is
// meant to teach, not to flatter: labels are calibrated to actual loss, not
// inflated to make every move feel good.
function classifyLoss(loss) {
  if (loss <= 15) return { key: 'best', label: 'Best move', tone: 'text-success' }
  if (loss <= 50) return { key: 'good', label: 'Good move', tone: 'text-success' }
  if (loss <= 120) return { key: 'inaccuracy', label: `Inaccuracy (-${Math.round(loss)})`, tone: 'text-warning' }
  if (loss <= 300) return { key: 'mistake', label: `Mistake (-${Math.round(loss)})`, tone: 'text-warning' }
  return { key: 'blunder', label: `Blunder (-${Math.round(loss)})`, tone: 'text-error' }
}

// Derives captured material purely from the current board — no piece-identity
// tracking needed, just "how many of each type are missing vs. the start."
function computeCaptured(chess) {
  const remaining = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  }
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type !== 'k') remaining[cell.color][cell.type] += 1
    }
  }
  const byWhite = [] // black pieces White has captured
  const byBlack = [] // white pieces Black has captured
  let whiteMaterial = 0
  let blackMaterial = 0
  for (const type of CAPTURE_ORDER) {
    const blackMissing = STARTING_COUNTS[type] - remaining.b[type]
    const whiteMissing = STARTING_COUNTS[type] - remaining.w[type]
    for (let i = 0; i < blackMissing; i++) byWhite.push(type)
    for (let i = 0; i < whiteMissing; i++) byBlack.push(type)
    whiteMaterial += remaining.w[type] * PIECE_VALUE[type]
    blackMaterial += remaining.b[type] * PIECE_VALUE[type]
  }
  return { byWhite, byBlack, advantage: Math.round((whiteMaterial - blackMaterial) / 100) }
}

function CapturedRow({ types, color }) {
  if (types.length === 0) return <span className="text-caption text-ink-tertiary">—</span>
  return (
    <div className="flex flex-wrap gap-0.5">
      {types.map((t, i) => (
        <span
          key={i}
          className="text-[15px] leading-none"
          style={{ color: color === 'w' ? '#E8E8E8' : '#2A2A2A' }}
        >
          {UNICODE[color === 'w' ? t.toUpperCase() : t]}
        </span>
      ))}
    </div>
  )
}

export default function ChessGame({ session }) {
  const navigate = useNavigate()
  const chessRef = useRef(new Chess())
  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate((n) => n + 1)

  const [selected, setSelected] = useState(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [record, setRecord] = useState({ wins: 0, losses: 0, draws: 0 })
  const [resultSaved, setResultSaved] = useState(false)
  const [lastMove, setLastMove] = useState(null) // { from, to, captured }
  const [moveCount, setMoveCount] = useState(0)
  const [lastQuality, setLastQuality] = useState(null)
  const [tally, setTally] = useState({ best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 })
  const startRef = useRef(Date.now())
  const qualityTimerRef = useRef(null)

  const chess = chessRef.current

  useEffect(() => {
    async function loadRecord() {
      try {
        const { data, error } = await supabase
          .from('neuro_plus_scores')
          .select('score')
          .eq('user_id', session.user.id)
          .eq('game_type', 'chess')
        if (error) throw error
        const wins = (data || []).filter((r) => r.score === 2).length
        const losses = (data || []).filter((r) => r.score === 0).length
        const draws = (data || []).filter((r) => r.score === 1).length
        setRecord({ wins, losses, draws })
      } catch (err) {
        console.warn('Could not load chess record:', err.message)
      }
    }
    loadRecord()
  }, [session.user.id])

  const legalTargets = useMemo(() => {
    if (!selected) return []
    return chess.moves({ square: selected, verbose: true }).map((m) => m.to)
  }, [selected, chess])

  const gameOver = chess.isGameOver()
  const isCheck = chess.isCheck()
  const turn = chess.turn()
  const captured = useMemo(() => computeCaptured(chess), [chess, moveCount])

  const statusText = useMemo(() => {
    if (chess.isCheckmate()) return turn === 'w' ? 'Checkmate — Nexora AI wins.' : 'Checkmate — you win!'
    if (chess.isStalemate()) return 'Stalemate — draw.'
    if (chess.isDraw()) return 'Draw.'
    if (aiThinking) return null // shown as an animated indicator instead of plain text
    if (isCheck) return turn === 'w' ? 'Check! Your move.' : 'Check!'
    return turn === 'w' ? 'Your move' : "Nexora AI's move"
  }, [chess, turn, isCheck, aiThinking])

  // Save the result exactly once when the game ends.
  useEffect(() => {
    if (!gameOver || resultSaved) return
    setResultSaved(true)
    let result = 'draw'
    if (chess.isCheckmate()) result = turn === 'w' ? 'loss' : 'win' // side to move lost
    saveResult(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver])

  async function saveResult(result) {
    const scoreMap = { win: 2, draw: 1, loss: 0 }
    try {
      await supabase.from('neuro_plus_scores').insert({
        user_id: session.user.id,
        game_type: 'chess',
        score: scoreMap[result],
        duration_seconds: Math.round((Date.now() - startRef.current) / 1000),
        difficulty_level: AI_BASE_DEPTH,
        is_high_score: result === 'win',
      })
      setRecord((r) => ({
        wins: r.wins + (result === 'win' ? 1 : 0),
        losses: r.losses + (result === 'loss' ? 1 : 0),
        draws: r.draws + (result === 'draw' ? 1 : 0),
      }))
    } catch (err) {
      console.warn('Could not save chess result:', err.message)
    }
  }

  // Let the AI respond after the player moves — with pacing that scales
  // with position complexity, so it doesn't feel like a lookup table.
  useEffect(() => {
    if (chess.isGameOver()) return
    if (chess.turn() !== 'b') return
    setAiThinking(true)
    const depth = searchDepthFor(chess)
    const legalCount = chess.moves().length
    const thinkMs = Math.min(2200, 650 + legalCount * 18 + Math.random() * 400)
    const t = setTimeout(() => {
      const move = chooseAIMove(chess, depth)
      const wasCapture = Boolean(chess.get(move.to))
      if (move) {
        chess.move(move.san)
        setLastMove({ from: move.from, to: move.to, captured: wasCapture })
        setMoveCount((c) => c + 1)
      }
      setAiThinking(false)
      rerender()
    }, thinkMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, turn])

  function handleSquareClick(square) {
    if (aiThinking || gameOver || turn !== 'w') return
    const piece = chess.get(square)

    if (selected && legalTargets.includes(square)) {
      // Grade the move against every legal alternative before applying it.
      const depth = searchDepthFor(chess)
      const results = evaluateAllMoves(chess, depth)
      const bestScore = Math.max(...results.map((r) => r.score))
      const chosen = results.find((r) => r.move.from === selected && r.move.to === square)
      if (chosen) {
        const loss = Math.max(0, bestScore - chosen.score)
        const quality = classifyLoss(loss)
        setTally((t) => ({ ...t, [quality.key]: t[quality.key] + 1 }))
        setLastQuality(quality)
        clearTimeout(qualityTimerRef.current)
        qualityTimerRef.current = setTimeout(() => setLastQuality(null), 3500)
      }

      const wasCapture = Boolean(chess.get(square))
      chess.move({ from: selected, to: square, promotion: 'q' })
      setLastMove({ from: selected, to: square, captured: wasCapture })
      setMoveCount((c) => c + 1)
      setSelected(null)
      rerender()
      return
    }
    if (piece && piece.color === 'w') {
      setSelected(square)
    } else {
      setSelected(null)
    }
  }

  function undo() {
    if (aiThinking || turn !== 'w') return
    chess.undo() // undo AI's move
    chess.undo() // undo player's move
    setSelected(null)
    setResultSaved(false)
    setLastMove(null)
    setLastQuality(null)
    setMoveCount((c) => c + 1)
    rerender()
  }

  function restart() {
    chessRef.current = new Chess()
    startRef.current = Date.now()
    setSelected(null)
    setAiThinking(false)
    setResultSaved(false)
    setLastMove(null)
    setLastQuality(null)
    setTally({ best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 })
    setMoveCount(0)
    rerender()
  }

  const board = chess.board() // board[0] = rank 8 ... board[7] = rank 1
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

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
        <h1 className="text-h3 text-ink-primary font-bold">Chess</h1>
      </header>

      <main className="px-md pb-2xl flex flex-col gap-md">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-h1 text-ink-primary">Chess</h2>
            <p className="text-body-small text-ink-secondary">Opponent: Nexora AI</p>
          </div>
          <div className="flex items-center gap-sm bg-base-surface p-sm rounded-lg border border-base-border">
            <div className="flex flex-col items-center px-sm">
              <span className="text-caption text-ink-secondary mb-1">You</span>
              <div className="w-8 h-8 rounded-full bg-base-elevated flex items-center justify-center text-h3 text-ink-primary border border-base-border">
                {record.wins}
              </div>
            </div>
            <div className="h-8 w-px bg-base-border" />
            <div className="flex flex-col items-center px-sm relative">
              <span className="text-caption text-ink-secondary mb-1">AI</span>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-h3 text-primary border border-primary/40 shadow-glow">
                {record.losses}
              </div>
              <button
                aria-label="Undo last exchange"
                onClick={undo}
                disabled={aiThinking || turn !== 'w' || chess.history().length < 2}
                className="absolute -bottom-6 text-primary opacity-80 hover:opacity-100 disabled:opacity-30 transition"
              >
                <Undo2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Captured material — real chess apps show this; we didn't before */}
        <div className="flex justify-between items-center bg-base-surface/60 border border-base-border/50 rounded-md px-sm py-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-caption text-ink-tertiary">You captured</span>
            <CapturedRow types={captured.byWhite} color="b" />
          </div>
          {captured.advantage !== 0 && (
            <span className={`text-caption font-bold ${captured.advantage > 0 ? 'text-success' : 'text-error'}`}>
              {captured.advantage > 0 ? `+${captured.advantage}` : captured.advantage}
            </span>
          )}
          <div className="flex flex-col gap-0.5 items-end">
            <span className="text-caption text-ink-tertiary">AI captured</span>
            <CapturedRow types={captured.byBlack} color="w" />
          </div>
        </div>

        {/* Status / thinking indicator / move-quality feedback */}
        <div
          className={`text-body-small text-center py-2 rounded-md min-h-[36px] flex items-center justify-center gap-2 ${
            isCheck && !gameOver ? 'text-error bg-error/10' : 'text-ink-secondary'
          }`}
        >
          {aiThinking ? (
            <span className="flex items-center gap-1.5">
              <Brain size={14} className="text-primary" />
              Nexora AI is thinking
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-primary animate-thinking-dot" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-primary animate-thinking-dot" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-primary animate-thinking-dot" style={{ animationDelay: '300ms' }} />
              </span>
            </span>
          ) : lastQuality ? (
            <span className={`font-semibold ${lastQuality.tone}`}>{lastQuality.label}</span>
          ) : (
            statusText
          )}
        </div>

        {/* Board — wood-toned frame, coordinate labels, last-move highlight */}
        <div className="flex gap-1">
          <div className="flex flex-col justify-around py-1">
            {[8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
              <span key={n} className="text-caption text-ink-tertiary w-3 text-center">
                {n}
              </span>
            ))}
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div
              className="w-full rounded-md overflow-hidden shadow-2xl p-1.5"
              style={{ background: 'linear-gradient(135deg, #2A1D10, #1A130A)' }}
            >
              <div className="grid grid-cols-8 grid-rows-8 aspect-square w-full rounded-sm overflow-hidden">
                {board.map((row, r) =>
                  row.map((cell, c) => {
                    const file = files[c]
                    const rank = 8 - r
                    const square = `${file}${rank}`
                    const isLight = (r + c) % 2 === 0
                    const isSelected = selected === square
                    const isTarget = legalTargets.includes(square)
                    const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square)
                    return (
                      <button
                        key={square}
                        onClick={() => handleSquareClick(square)}
                        style={{
                          background: isLight
                            ? `linear-gradient(135deg, ${LIGHT}, #DCC9A0)`
                            : `linear-gradient(135deg, ${DARK}, #2A4534)`,
                        }}
                        className="relative flex items-center justify-center select-none"
                      >
                        {isLastMove && <span className="absolute inset-0 bg-amber-400/25" />}
                        {isSelected && <span className="absolute inset-0 bg-primary/40" />}
                        {isTarget && !cell && (
                          <span className="absolute w-1/4 h-1/4 rounded-full bg-primary/60 shadow-md" />
                        )}
                        {isTarget && cell && (
                          <span className="absolute inset-0.5 ring-4 ring-inset ring-primary/70 rounded-sm" />
                        )}
                        {cell && (
                          <span
                            key={`${square}-${moveCount}`}
                            className="relative text-[7.5vw] sm:text-[36px] leading-none font-bold animate-piece-pop bg-clip-text text-transparent"
                            style={{
                              backgroundImage:
                                cell.color === 'w'
                                  ? 'linear-gradient(180deg, #FFFFFF, #C9C9C9)'
                                  : 'linear-gradient(180deg, #4A4A4A, #0A0A0A)',
                              filter:
                                cell.color === 'w'
                                  ? 'drop-shadow(0 2px 2px rgba(0,0,0,0.55))'
                                  : 'drop-shadow(0 1px 1px rgba(255,255,255,0.18))',
                            }}
                          >
                            {UNICODE[cell.color === 'w' ? cell.type.toUpperCase() : cell.type]}
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
            <div className="flex justify-around px-1">
              {files.map((f) => (
                <span key={f} className="text-caption text-ink-tertiary w-3 text-center">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {gameOver && (
          <div className="card p-md flex flex-col gap-sm items-center text-center mt-sm">
            <h3 className="text-h3 text-ink-primary">
              {chess.isCheckmate() ? (turn === 'w' ? 'Nexora AI wins' : 'You win!') : 'Draw'}
            </h3>
            <p className="text-caption text-ink-secondary">
              {tally.best + tally.good} solid · {tally.inaccuracy} inaccuracies · {tally.mistake} mistakes ·{' '}
              {tally.blunder} blunders
            </p>
            <button onClick={restart} className="w-full btn-primary py-3 mt-xs">
              New Game
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
