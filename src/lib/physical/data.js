import { supabase } from '../supabase.js'
import { addDaysISO, todayLocal } from '../journal/dates.js'

const safe = async (p, fallback) => {
  try {
    const r = await p
    if (r.error) { console.warn('physical load:', r.error.message); return fallback }
    return r.data ?? fallback
  } catch (e) { console.warn('physical load:', e.message); return fallback }
}

// Loads everything the section can use. Each source is optional; a failure just means "less to go on".
export async function loadPhysical(userId) {
  const today = todayLocal()
  const since42 = addDaysISO(today, -42)
  const since60 = addDaysISO(today, -60)
  const [profile, snapshots, experiments, moments, dismissals, reading, nextMove, journal, habits, logs, sub] = await Promise.all([
    safe(supabase.from('physical_profile').select('*').eq('user_id', userId).maybeSingle(), null),
    safe(supabase.from('physical_snapshots').select('*').order('taken_on', { ascending: false }).limit(200), []),
    safe(supabase.from('physical_experiments').select('*').order('created_at', { ascending: false }).limit(60), []),
    safe(supabase.from('physical_moments').select('*').order('happened_on', { ascending: false }).limit(30), []),
    safe(supabase.from('physical_dismissals').select('key,until'), []),
    safe(supabase.from('physical_readings').select('*').eq('kind', 'reading').order('created_at', { ascending: false }).limit(1), []),
    safe(supabase.from('physical_readings').select('*').eq('kind', 'next_move').order('created_at', { ascending: false }).limit(1), []),
    safe(supabase.from('journal_entries').select('entry_date,mood,tags,title,preview').eq('is_locked', false).eq('is_archived', false).gte('entry_date', since42).order('entry_date', { ascending: false }).limit(120), []),
    safe(supabase.from('habits').select('id,name,category').eq('user_id', userId).eq('is_active', true), []),
    safe(supabase.from('habit_logs').select('habit_id,completed').eq('user_id', userId).gte('log_date', since60).limit(1000), []),
    safe(supabase.from('subscriptions').select('plan_tier,is_active').eq('user_id', userId).maybeSingle(), null),
  ])
  return {
    profile, snapshots, experiments, moments, journal, habits, logs,
    dismissals: Object.fromEntries(dismissals.map((d) => [d.key, d.until])),
    reading: reading[0] || null,
    nextMove: nextMove[0] || null,
    isPro: !!sub?.is_active && !!sub?.plan_tier && sub.plan_tier !== 'free',
  }
}

export function explainPhysical(err) {
  const msg = String(err?.message || err || '')
  if (msg.includes('nexora_limit:experiments')) return { code: 'limit_experiments', message: 'You already have an experiment running.' }
  return { code: err?.code || 'error', message: msg || 'Something went wrong.' }
}

// ---- baseline
export async function saveProfile(userId, patch) {
  const { data, error } = await supabase.from('physical_profile').upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' }).select().single()
  if (error) throw error
  return data
}

// ---- snapshots
export async function addSnapshot(userId, s) {
  const { data, error } = await supabase.from('physical_snapshots').insert({ user_id: userId, ...s }).select().single()
  if (error) throw error
  return data
}
export async function updateSnapshot(id, s) {
  const { data, error } = await supabase.from('physical_snapshots').update(s).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteSnapshot(id) {
  const { error } = await supabase.from('physical_snapshots').delete().eq('id', id)
  if (error) throw error
}

// ---- experiments
export async function startExperiment(userId, e) {
  const start = todayLocal()
  const { data, error } = await supabase.from('physical_experiments').insert({
    user_id: userId, title: e.title, why: e.why || null, minutes: e.minutes || null, kind: e.kind || 'move',
    source: e.source || 'library', start_on: start, ends_on: addDaysISO(start, e.duration_days || 7),
  }).select().single()
  if (error) throw error
  return data
}
export async function checkinExperiment(exp) {
  const today = todayLocal()
  if (exp.last_checkin === today) return exp
  const { data, error } = await supabase.from('physical_experiments').update({ checkins: (exp.checkins || 0) + 1, last_checkin: today }).eq('id', exp.id).select().single()
  if (error) throw error
  return data
}
export async function finishExperiment(id, { outcome, note, status = 'done' }) {
  const { data, error } = await supabase.from('physical_experiments').update({ status, outcome: outcome || null, note: note || null }).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteExperiment(id) {
  const { error } = await supabase.from('physical_experiments').delete().eq('id', id)
  if (error) throw error
}

// ---- moments & dismissals
export async function addMoment(userId, m) {
  const { data, error } = await supabase.from('physical_moments').insert({ user_id: userId, happened_on: todayLocal(), ...m }).select().single()
  if (error) throw error
  return data
}
export async function snooze(userId, key, days) {
  const until = addDaysISO(todayLocal(), days)
  const { error } = await supabase.from('physical_dismissals').upsert({ user_id: userId, key, until }, { onConflict: 'user_id,key' })
  if (error) console.warn('snooze failed:', error.message)
  return until
}

// ---- everything physical, gone (user's right; also used by "Reset")
export async function resetPhysical(userId) {
  for (const t of ['physical_readings', 'physical_dismissals', 'physical_moments', 'physical_experiments', 'physical_snapshots', 'physical_profile']) {
    const { error } = await supabase.from(t).delete().eq('user_id', userId)
    if (error) throw error
  }
}
