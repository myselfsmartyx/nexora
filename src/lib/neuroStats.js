// Pure maths for Neuro+ Brain Progress (no React, no network), so it can be tested.
export const GAMES = [
  { id: 'memory_matrix', label: 'Memory Matrix' },
  { id: 'rapid_math', label: 'Rapid Math' },
  { id: 'chess', label: 'Chess' },
  { id: 'schulte_table', label: 'Schulte Table' },
]
// Schulte Table score is elapsed seconds, so lower is better.
const LOWER_IS_BETTER = new Set(['schulte_table'])
const DAY = 86400000

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)

export function formatBest(gameId, value) {
  if (value == null) return '-'
  if (gameId === 'schulte_table') {
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  }
  if (gameId === 'chess') return value === 2 ? 'Won a game' : value === 1 ? 'Best: draw' : 'No wins yet'
  return Number(value).toLocaleString()
}

// rows: [{ game_type, score, duration_seconds, played_at }]
export function summarize(rows, nowMs = Date.now()) {
  const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
  const today = startOfDay(nowMs)
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (13 - i))
    return { t: d.getTime(), n: 0 }
  })
  const per = Object.fromEntries(GAMES.map((g) => [g.id, { sessions: 0, best: null, recent: [], prior: [] }]))
  let seconds = 0
  let weekSessions = 0

  for (const r of rows || []) {
    const p = per[r.game_type]
    const t = new Date(r.played_at).getTime()
    if (!p || Number.isNaN(t)) continue
    p.sessions += 1
    seconds += Number(r.duration_seconds) || 0
    const lower = LOWER_IS_BETTER.has(r.game_type)
    if (p.best == null || (lower ? r.score < p.best : r.score > p.best)) p.best = r.score
    const daysAgo = (today + DAY - t) / DAY
    if (daysAgo > 0 && daysAgo <= 7) { p.recent.push(r.score); weekSessions += 1 }
    else if (daysAgo > 7 && daysAgo <= 14) p.prior.push(r.score)
    const slot = days.find((d, i) => t >= d.t && t < (days[i + 1] ? days[i + 1].t : today + DAY))
    if (slot) slot.n += 1
  }

  const games = GAMES.map((g) => {
    const p = per[g.id]
    const a = avg(p.recent), b = avg(p.prior)
    let change = null
    if (a != null && b != null && b !== 0) {
      change = ((a - b) / Math.abs(b)) * 100
      if (LOWER_IS_BETTER.has(g.id)) change = -change   // faster is an improvement
    }
    return { ...g, sessions: p.sessions, best: p.best, change }
  })

  const improved = games.filter((g) => g.change != null && g.change > 0).sort((x, y) => y.change - x.change)
  return {
    totalSessions: games.reduce((s, g) => s + g.sessions, 0),
    minutes: Math.round(seconds / 60),
    weekSessions,
    days,
    games,
    topGain: improved[0] || null,
  }
}
