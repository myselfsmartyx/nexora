import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import { ArrowLeft, Undo2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const LIGHT = '#E8D5B5'
const DARK = '#1A3A2A'

const UNICODE = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔',
}

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

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

// AI search depth — plies looked ahead. 2 keeps it responsive on a phone;
// bump to 3 for a noticeably stronger (but slower) opponent.
const AI_DEPTH = 2

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

// AI plays Black, so it wants the lowest (most negative) evaluation.
function chooseAIMove(chess) {
  const moves = chess.moves({ verbose: true })
  let bestScore = Infinity
  let bestMoves = []
  for (const m of moves) {
    chess.move(m.san)
    const score = minimax(chess, AI_DEPTH - 1, -Infinity, Infinity, true)
    chess.undo()
    if (score < bestScore) {
      bestScore = score
      bestMoves = [m]
    } else if (score === bestScore) {
      bestMoves.push(m)
    }
  }
  // Small randomness among equally-good moves so the AI isn't perfectly deterministic.
  return bestMoves[Math.floor(Math.random() * bestMoves.length)]
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
  const startRef = useRef(Date.now())

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

  const statusText = useMemo(() => {
    if (chess.isCheckmate()) return turn === 'w' ? 'Checkmate — Nexora AI wins.' : 'Checkmate — you win!'
    if (chess.isStalemate()) return 'Stalemate — draw.'
    if (chess.isDraw()) return 'Draw.'
    if (aiThinking) return 'Nexora AI is thinking…'
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
        difficulty_level: AI_DEPTH,
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

  // Let the AI respond after the player moves.
  useEffect(() => {
    if (chess.isGameOver()) return
    if (chess.turn() !== 'b') return
    setAiThinking(true)
    const t = setTimeout(() => {
      const move = chooseAIMove(chess)
      if (move) chess.move(move.san)
      setAiThinking(false)
      rerender()
    }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, turn])

  function handleSquareClick(square) {
    if (aiThinking || gameOver || turn !== 'w') return
    const piece = chess.get(square)

    if (selected && legalTargets.includes(square)) {
      chess.move({ from: selected, to: square, promotion: 'q' })
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
    rerender()
  }

  function restart() {
    chessRef.current = new Chess()
    startRef.current = Date.now()
    setSelected(null)
    setAiThinking(false)
    setResultSaved(false)
    rerender()
  }

  const board = chess.board() // board[0] = rank 8 ... board[7] = rank 1

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

        <p
          className={`text-body-small text-center py-2 rounded-md ${
            isCheck && !gameOver ? 'text-error bg-error/10' : 'text-ink-secondary'
          }`}
        >
          {statusText}
        </p>

        <div className="w-full shadow-2xl rounded-sm overflow-hidden border border-base-border">
          <div className="grid grid-cols-8 grid-rows-8 aspect-square w-full">
            {board.map((row, r) =>
              row.map((cell, c) => {
                const file = String.fromCharCode(97 + c)
                const rank = 8 - r
                const square = `${file}${rank}`
                const isLight = (r + c) % 2 === 0
                const isSelected = selected === square
                const isTarget = legalTargets.includes(square)
                return (
                  <button
                    key={square}
                    onClick={() => handleSquareClick(square)}
                    style={{ backgroundColor: isLight ? LIGHT : DARK }}
                    className="relative flex items-center justify-center select-none"
                  >
                    {isSelected && <span className="absolute inset-0 bg-primary/40" />}
                    {isTarget && !cell && <span className="absolute w-1/4 h-1/4 rounded-full bg-primary/60" />}
                    {isTarget && cell && <span className="absolute inset-0 ring-4 ring-inset ring-primary/70 rounded-sm" />}
                    {cell && (
                      <span
                        className="relative text-[7vw] sm:text-[34px] leading-none font-bold"
                        style={{ color: cell.color === 'w' ? '#F5F5F0' : '#0D1410' }}
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

        {gameOver && (
          <button onClick={restart} className="w-full btn-primary py-3 mt-sm">
            New Game
          </button>
        )}
      </main>
    </div>
  )
}
