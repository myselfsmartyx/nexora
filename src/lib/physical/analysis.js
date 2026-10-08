// Pure, dependency-free analysis for the Physical section. Runs in the browser with whatever data
// exists (often very little) and never needs daily input. Fully unit-testable in Node.
import { THEMES, LIBRARY, NUDGES, GOALS, ACTIVITY, BODY, ENERGY_LABELS, SLEEP_LABELS, ACTIVITY_WEEK, LIMITS } from './constants.js'
import { addDaysISO, daysBetween } from '../journal/dates.js'

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0 }
const num = (v) => (v == null || v === '' ? null : Number(v))

// ---------------------------------------------------------------- safety (never optional)
export function bmiOf(heightCm, weightKg) {
  const h = num(heightCm), w = num(weightKg)
  return h && w ? w / ((h / 100) ** 2) : null
}
export function latestWeight(profile, snapshots) {
  const s = [...snapshots].filter((x) => x.weight_kg != null).sort((a, b) => b.taken_on.localeCompare(a.taken_on))[0]
  return s ? { kg: num(s.weight_kg), date: s.taken_on } : profile?.weight_kg != null ? { kg: num(profile.weight_kg), date: null } : null
}
// Flags that constrain advice. Passed to the AI too — it must obey them.
export function safetyFlags(profile, snapshots = []) {
  const w = latestWeight(profile, snapshots)
  const bmi = bmiOf(profile?.height_cm, w?.kg)
  const minor = profile?.age != null && profile.age < 18
  const underweight = bmi != null && bmi < 18.5
  return {
    minor, underweight,
    limits: profile?.limits || [],
    // never steer toward weight loss for minors or an underweight BMI
    noWeightLoss: minor || underweight || profile?.body_condition === 'very_slim',
  }
}

// ---------------------------------------------------------------- series & direction
export function seriesOf(snapshots, key) {
  return snapshots
    .filter((s) => s[key] != null)
    .map((s) => ({ date: s.taken_on, value: Number(s[key]) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Median pairwise slope (robust to a single odd day) → direction over the whole span.
export function direction(points, { minPoints = 3, minSpanDays = 21, flat = 0.4, relative = false } = {}) {
  if (points.length < minPoints) return { state: 'unknown', n: points.length, change: 0, spanDays: 0 }
  const t0 = points[0].date
  const xs = points.map((p) => daysBetween(t0, p.date))
  const span = xs[xs.length - 1]
  if (span < minSpanDays) return { state: 'unknown', n: points.length, change: 0, spanDays: span }
  const slopes = []
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const dx = xs[j] - xs[i]
    if (dx > 0) slopes.push((points[j].value - points[i].value) / dx)
  }
  const change = median(slopes) * span
  const threshold = relative ? Math.max(flat, 0.015 * median(points.map((p) => p.value))) : flat
  return { state: Math.abs(change) < threshold ? 'steady' : change > 0 ? 'up' : 'down', n: points.length, change, spanDays: span }
}

export function directionsOf(snapshots) {
  return {
    energy: direction(seriesOf(snapshots, 'energy')),
    sleep: direction(seriesOf(snapshots, 'sleep')),
    activity: direction(seriesOf(snapshots, 'activity'), { flat: 0.4 }),
    weight: direction(seriesOf(snapshots, 'weight_kg'), { flat: 0.8, relative: true }),
  }
}

// ---------------------------------------------------------------- journal signals (no effort needed)
export function extractSignals(entries, today) {
  const out = { n: 0, moods: {}, moodsRecent: {} }
  for (const k of Object.keys(THEMES)) out[k] = { recent: 0, prior: 0, last: null }
  for (const e of entries) {
    if (!e.entry_date) continue
    const age = daysBetween(e.entry_date, today)
    if (age < 0 || age > 42) continue
    out.n += 1
    const recent = age <= 21
    if (e.mood) { out.moods[e.mood] = (out.moods[e.mood] || 0) + 1; if (recent) out.moodsRecent[e.mood] = (out.moodsRecent[e.mood] || 0) + 1 }
    const text = `${e.title || ''} ${e.preview || ''} ${(e.tags || []).join(' ')}`
    for (const [k, re] of Object.entries(THEMES)) {
      if (!re.test(text)) continue
      out[k][recent ? 'recent' : 'prior'] += 1
      if (!out[k].last || e.entry_date > out[k].last) out[k].last = e.entry_date
    }
  }
  return out
}

// Health-ish habits (already in Nexora) count as quiet evidence of movement/sleep effort.
const HABIT_RE = /\b(walk|run|gym|workout|exercise|yoga|stretch|sleep|water|hydrate|steps|swim|cycle|meditat|posture|fitness)\b/i
export function healthHabitStats(habits, logs) {
  const ids = new Set(habits.filter((h) => HABIT_RE.test(h.name || '') || ['health', 'fitness', 'physical'].includes((h.category || '').toLowerCase())).map((h) => h.id))
  const done = logs.filter((l) => ids.has(l.habit_id) && l.completed).length
  return { habits: ids.size, done }
}

// ---------------------------------------------------------------- evidence & confidence
export function evidenceOf({ profile, snapshots, experiments, signals, habitStats }) {
  const done = experiments.filter((e) => e.status === 'done').length
  const dates = snapshots.map((s) => s.taken_on).sort()
  return {
    hasProfile: !!profile && !profile.skipped && (profile.goal || profile.age || profile.weight_kg || profile.activity_level) != null,
    snapshots: snapshots.length,
    journal: signals?.n || 0,
    experiments: done,
    habitChecks: habitStats?.done || 0,
    spanDays: dates.length > 1 ? daysBetween(dates[0], dates[dates.length - 1]) : 0,
  }
}
export function confidenceOf(ev) {
  const score = (ev.hasProfile ? 1 : 0) + Math.min(ev.snapshots, 6) + Math.min(ev.journal, 24) / 6 + Math.min(ev.experiments, 3) + Math.min(ev.habitChecks, 30) / 15
  return score < 1 ? 'none' : score < 3 ? 'low' : score < 6.5 ? 'medium' : 'high'
}
export function evidenceLine(ev) {
  const parts = []
  if (ev.snapshots) parts.push(`${ev.snapshots} snapshot${ev.snapshots === 1 ? '' : 's'}`)
  if (ev.journal) parts.push(`${ev.journal} journal ${ev.journal === 1 ? 'entry' : 'entries'}`)
  if (ev.experiments) parts.push(`${ev.experiments} finished experiment${ev.experiments === 1 ? '' : 's'}`)
  if (ev.habitChecks) parts.push(`${ev.habitChecks} habit check-ins`)
  if (ev.hasProfile) parts.push('your baseline')
  return parts.length ? `Based on ${parts.join(', ')}` : 'Not much to go on yet — and that’s fine'
}

// ---------------------------------------------------------------- the one question (only when it earns its place)
const snoozed = (d, key, today) => !!d?.[key] && d[key] >= today
export function nextQuestion({ profile, snapshots, signals, dismissals, today }) {
  const q = (key, text, why, cta, open) => (snoozed(dismissals, key, today) ? null : { key, text, why, cta, open })
  const lastSnap = [...snapshots].sort((a, b) => b.taken_on.localeCompare(a.taken_on))[0]
  const snapAge = lastSnap ? daysBetween(lastSnap.taken_on, today) : null
  const profAge = profile?.updated_at ? Math.floor((Date.now() - new Date(profile.updated_at).getTime()) / 86400000) : null

  if (!profile?.goal && profile) {
    const r = q('goal', 'What would you like your body to feel like in a few months?', 'Without a direction, everything I suggest is generic.', 'Set a direction', 'baseline')
    if (r) return r
  }
  if (signals?.pain.recent >= 3 && !snapshots.some((s) => s.feel?.includes('pain') && daysBetween(s.taken_on, today) <= 30)) {
    const r = q('pain', 'You’ve mentioned aches a few times. Where, and for roughly how long?', 'Pain patterns change what I should suggest — and whether to suggest seeing someone.', 'Note it', 'snapshot:pain')
    if (r) return r
  }
  if (['fat', 'muscle'].includes(profile?.goal) && profile?.weight_kg != null) {
    const w = latestWeight(profile, snapshots)
    if (w?.date && daysBetween(w.date, today) > 60) {
      const r = q('weight', 'A rough weight today — only if you’re curious — would sharpen the long view.', 'Your goal depends on a slow trend, and the last number is over two months old.', 'Add a number', 'snapshot:weight')
      if (r) return r
    }
  }
  if (profile && (snapAge == null || snapAge > 75)) {
    const r = q('checkin', snapAge == null ? 'Want to leave one 10-second snapshot of how things are right now?' : 'It’s been a while. A 10-second snapshot keeps the long view honest.', 'Even one point every couple of months is enough to see direction.', 'Quick snapshot', 'snapshot')
    if (r) return r
  }
  if (profAge != null && profAge > 150) {
    const r = q('review', 'Has anything big changed — job, injury, schedule, home?', 'Your baseline is a few months old; the right advice may have moved.', 'Review baseline', 'baseline')
    if (r) return r
  }
  return null
}

// ---------------------------------------------------------------- next move (offline fallback + AI input)
export function pickNextMoveLocal({ profile, signals, experiments, declined = [], safety }) {
  const limits = safety?.limits || profile?.limits || []
  const recentTitles = new Set(experiments.filter((e) => e.status !== 'active').slice(0, 8).map((e) => e.title))
  const declinedSet = new Set([...declined, ...experiments.filter((e) => e.status === 'active').map((e) => e.title)])
  const isolated = signals?.n >= 6 && signals.people.recent === 0
  const scored = LIBRARY.filter((it) => !it.avoid.some((l) => limits.includes(l)) && !declinedSet.has(it.title)).map((it) => {
    let s = 0
    if (profile?.goal && it.goals.includes(profile.goal)) s += 3
    for (const t of it.signals) {
      if (t === 'isolated') { if (isolated) s += 3 } else if ((signals?.[t]?.recent || 0) >= 2) s += 2
    }
    if ((signals?.tired.recent || 0) >= 2 && it.kind === 'rest') s += 2
    if (profile?.activity_level === 'sedentary') { s += it.minutes <= 15 ? 1 : 0; if (it.minutes > 30) s -= 2; if (it.id === 'pushups-2x' && !['strength', 'muscle'].includes(profile.goal)) s -= 3 }
    if (safety?.noWeightLoss && it.id === 'slow-meal') s -= 3
    if (recentTitles.has(it.title)) s -= 4
    return { it, s }
  }).sort((a, b) => b.s - a.s)
  const top = scored[0]?.it
  return top ? { title: top.title, why: top.why, minutes: top.minutes, kind: top.kind, source: 'library', easier: null } : null
}

export function pickNudge({ signals, dismissals, today }) {
  if (!signals || snoozed(dismissals, 'nudge:cadence', today)) return null
  return NUDGES.find((n) => !snoozed(dismissals, `nudge:${n.id}`, today) && n.when(signals)) || null
}

// What has worked for this person, from finished experiments.
export function whatWorks(experiments) {
  return experiments.filter((e) => e.status === 'done' && (e.outcome === 'clear' || e.outcome === 'slight'))
    .sort((a, b) => (a.outcome === b.outcome ? 0 : a.outcome === 'clear' ? -1 : 1))
}

// ---------------------------------------------------------------- copy helpers
export function directionPhrase(name, d) {
  if (d.state === 'unknown') return { word: 'Not enough yet', tone: 'muted', hint: d.n ? `${d.n} point${d.n === 1 ? '' : 's'} so far — needs a longer stretch` : 'No data — that’s okay' }
  const up = { energy: 'Rising', sleep: 'Improving', activity: 'More active', weight: 'Trending up' }
  const down = { energy: 'Lower', sleep: 'Worsening', activity: 'Less active', weight: 'Trending down' }
  if (d.state === 'steady') return { word: 'Steady', tone: 'calm', hint: `over ${Math.round(d.spanDays / 7)} weeks` }
  return { word: d.state === 'up' ? up[name] : down[name], tone: 'change', hint: `over ${Math.round(d.spanDays / 7)} weeks` }
}

export function welcomeBack(lastActive, today) {
  if (!lastActive) return null
  const gap = daysBetween(lastActive, today)
  if (gap < 21) return null
  if (gap < 75) return 'Welcome back. It’s been a few weeks — nothing here expects anything from you.'
  return 'Welcome back. It’s been a while, and that’s completely fine. Nothing was lost.'
}

export function goalLabel(id) { return GOALS.find((g) => g.id === id)?.label || null }

// ---------------------------------------------------------------- doctor-visit summary (plain text; all local)
export function visitSummary({ profile, snapshots, experiments, signals, today }) {
  const L = []
  const fmt = (v, kind) => (v == null ? '—' : kind === 'energy' ? `${v}/5 (${ENERGY_LABELS[v - 1]})` : kind === 'sleep' ? `${v}/5 (${SLEEP_LABELS[v - 1]})` : v)
  L.push(`# Health notes — ${today}`, '', '_Self-reported, compiled in Nexora. Not a medical record._', '')
  if (profile) {
    const bits = []
    if (profile.age) bits.push(`${profile.age} years`)
    if (profile.sex) bits.push(profile.sex)
    if (profile.height_cm) bits.push(`${profile.height_cm} cm`)
    const w = latestWeight(profile, snapshots)
    if (w) bits.push(`${w.kg} kg${w.date ? ` (${w.date})` : ''}`)
    if (bits.length) L.push(`**Baseline:** ${bits.join(' · ')}`)
    if (profile.activity_level) L.push(`**Usual activity:** ${ACTIVITY.find((a) => a.id === profile.activity_level)?.label}`)
    if (profile.goal) L.push(`**Goal:** ${goalLabel(profile.goal)}`)
    if (profile.limits?.length) L.push(`**Limitations noted:** ${profile.limits.map((l) => LIMITS.find((x) => x.id === l)?.label || l).join(', ')}${profile.limits_note ? ` — ${profile.limits_note}` : ''}`)
    L.push('')
  }
  const d = directionsOf(snapshots)
  L.push('## Trends')
  for (const [k, label] of [['energy', 'Energy'], ['sleep', 'Sleep'], ['weight', 'Weight'], ['activity', 'Activity']]) {
    const p = directionPhrase(k, d[k]); L.push(`- ${label}: ${p.word}${d[k].state !== 'unknown' ? ` (${p.hint})` : ''}`)
  }
  const recent = [...snapshots].sort((a, b) => b.taken_on.localeCompare(a.taken_on)).slice(0, 10)
  if (recent.length) {
    L.push('', '## Snapshots (latest first)')
    for (const s of recent) {
      const parts = []
      if (s.weight_kg != null) parts.push(`weight ${s.weight_kg} kg`)
      if (s.energy != null) parts.push(`energy ${fmt(s.energy, 'energy')}`)
      if (s.sleep != null) parts.push(`sleep ${fmt(s.sleep, 'sleep')}`)
      if (s.activity != null) parts.push(`activity: ${ACTIVITY_WEEK[s.activity]}`)
      if (s.feel?.length) parts.push(`felt: ${s.feel.join(', ')}`)
      if (s.pain_note) parts.push(`pain/limits: ${s.pain_note}`)
      if (s.note) parts.push(`note: ${s.note}`)
      L.push(`- ${s.taken_on}: ${parts.join('; ')}`)
    }
  }
  if (signals && signals.n) {
    const m = []
    if (signals.pain.recent) m.push(`aches/pain mentioned in ${signals.pain.recent} recent journal entries`)
    if (signals.tired.recent) m.push(`tiredness mentioned in ${signals.tired.recent}`)
    if (m.length) L.push('', '## From my journal (last 3 weeks)', ...m.map((x) => `- ${x}`))
  }
  const tried = experiments.filter((e) => e.status === 'done').slice(0, 6)
  if (tried.length) L.push('', '## Things I have tried', ...tried.map((e) => `- ${e.title} — helped: ${e.outcome === 'clear' ? 'clearly' : e.outcome === 'slight' ? 'a little' : e.outcome === 'none' ? 'not really' : 'unclear'}`))
  L.push('', '## Questions to ask', '- ', '- ')
  return L.join('\n')
}

export { addDaysISO, BODY }
