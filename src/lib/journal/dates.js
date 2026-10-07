// Local-time date helpers. The old Journal used toISOString() (UTC), which put entries written
// after midnight (e.g. in India, UTC+5:30) on the wrong day. Everything here is LOCAL time.

const pad = (n) => String(n).padStart(2, '0')

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const todayLocal = () => toISO(new Date())

// 'YYYY-MM-DD' -> Date at local midnight
export function fromISO(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDaysISO(iso, delta) {
  const d = fromISO(iso)
  d.setDate(d.getDate() + delta)
  return toISO(d)
}

export function daysBetween(aISO, bISO) {
  return Math.round((fromISO(bISO) - fromISO(aISO)) / 86400000)
}

export function dayLabel(iso) {
  const diff = daysBetween(iso, todayLocal())
  const d = fromISO(iso)
  const short = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (diff === 0) return `Today · ${short}`
  if (diff === 1) return `Yesterday · ${short}`
  if (diff > 1 && diff < 7) return `${d.toLocaleDateString(undefined, { weekday: 'long' })} · ${short}`
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

export function longDate(iso) {
  return fromISO(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function monthKey(iso) {
  return String(iso).slice(0, 7)
}
export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  const sameYear = y === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { month: 'long', year: sameYear ? undefined : 'numeric' })
}

export function timeLabel(ts) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const countWords = (text) => (String(text).trim().match(/\S+/g) || []).length
export const readMinutes = (words) => Math.max(1, Math.round((words || 0) / 200))
