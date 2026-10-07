// All Journal database access in one place (RLS does the security; these just shape queries).
import { supabase } from '../supabase.js'
import { hashColor, MAX_PRIVATE_CHARS } from './constants.js'
import { decryptEntry, encryptEntry, getState as vaultState } from './vault.js'
import { todayLocal } from './dates.js'

export const PAGE_SIZE = 30
const LIST_COLS =
  'id,title,preview,mood,category,tags,entry_date,is_favorite,is_archived,is_locked,folder_id,word_count,created_at,updated_at,ai_prompt_used'

// Turns database/trigger errors into { code, message } the UI can act on (e.g. open the upgrade sheet).
export function explain(err) {
  const msg = String(err?.message || err || '')
  if (msg.includes('nexora_limit:folders')) return { code: 'limit_folders', message: 'Free plan includes 3 folders.' }
  if (msg.includes('nexora_limit:private_folders')) return { code: 'limit_private_folders', message: 'Private folders are a Pro feature.' }
  if (msg.includes('nexora_limit:private_entries')) return { code: 'limit_private', message: 'Free plan includes 5 private entries.' }
  if (msg.includes('journal_folders_user_name_uq')) return { code: 'dup_folder', message: 'You already have a folder with that name.' }
  if (msg.includes('journal_tags_user_id_name_key')) return { code: 'dup_tag', message: 'That tag already exists.' }
  if (err?.code === 'rate_limited') return { code: 'rate_limited', message: msg }
  return { code: err?.code || 'error', message: msg || 'Something went wrong.' }
}

// ---------------------------------------------------------------- entries
export function sanitizeSearch(q) {
  return String(q || '').replace(/[,()*%\\"':]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
}

export const EMPTY_FILTERS = {
  q: '', folder: 'all', moods: [], tags: [], tagMode: 'any',
  favorites: false, privateOnly: false, archived: false, from: '', to: '', date: '',
}

export function activeFilterCount(f) {
  return (f.moods.length ? 1 : 0) + (f.tags.length ? 1 : 0) + (f.from || f.to ? 1 : 0) + (f.date ? 1 : 0)
}

export async function fetchEntries(filters, sort, page) {
  const f = { ...EMPTY_FILTERS, ...filters }
  let q = supabase.from('journal_entries').select(LIST_COLS, { count: page === 0 ? 'exact' : undefined })
  q = q.eq('is_archived', !!f.archived)
  if (f.folder === 'none') q = q.is('folder_id', null)
  else if (f.folder && f.folder !== 'all') q = q.eq('folder_id', f.folder)
  if (f.moods.length) q = q.in('mood', f.moods)
  if (f.tags.length) q = f.tagMode === 'all' ? q.contains('tags', f.tags) : q.overlaps('tags', f.tags)
  if (f.favorites) q = q.eq('is_favorite', true)
  if (f.privateOnly) q = q.eq('is_locked', true)
  if (f.date) q = q.eq('entry_date', f.date)
  if (f.from) q = q.gte('entry_date', f.from)
  if (f.to) q = q.lte('entry_date', f.to)

  const s = sanitizeSearch(f.q)
  if (s) {
    // Private entries hold only ciphertext on the server, so they can't match a text search.
    const ors = [`title.ilike.*${s}*`, `content.ilike.*${s}*`] // both have trigram indexes
    if (/^[\p{L}\p{N}_-]+$/u.test(s)) ors.push(`tags.cs.{${s.toLowerCase()}}`)
    q = q.eq('is_locked', false).or(ors.join(','))
  }

  switch (sort) {
    case 'oldest': q = q.order('entry_date', { ascending: true }).order('created_at', { ascending: true }); break
    case 'edited': q = q.order('updated_at', { ascending: false }); break
    case 'longest': q = q.order('word_count', { ascending: false }).order('entry_date', { ascending: false }); break
    case 'title': q = q.order('title', { ascending: true, nullsFirst: false }).order('entry_date', { ascending: false }); break
    default: q = q.order('entry_date', { ascending: false }).order('created_at', { ascending: false })
  }
  q = q.order('id', { ascending: true }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: data || [], count: count ?? null, hasMore: (data || []).length === PAGE_SIZE }
}

// When the vault is unlocked, show real titles/previews for private entries in lists.
export async function hydrateLocked(rows) {
  const st = vaultState()
  const locked = rows.filter((r) => r.is_locked && r._title === undefined)
  if (!st.key || !locked.length) return rows
  const { data, error } = await supabase.from('journal_entries').select('id,content').in('id', locked.map((r) => r.id))
  if (error) return rows
  const plain = new Map()
  await Promise.all((data || []).map(async (r) => {
    try {
      const d = await decryptEntry(r.content)
      plain.set(r.id, d)
    } catch { plain.set(r.id, null) }
  }))
  return rows.map((r) => {
    if (!r.is_locked || !plain.has(r.id)) return r
    const d = plain.get(r.id)
    if (!d) return { ...r, _title: null, _preview: null, _failed: true }
    return { ...r, _title: d.title, _preview: d.content.slice(0, 280) }
  })
}

export async function fetchEntry(id) {
  const { data, error } = await supabase.from('journal_entries').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function createEntry(payload) {
  const { data, error } = await supabase.from('journal_entries').insert(payload).select(LIST_COLS).single()
  if (error) throw error
  return data
}
export async function updateEntry(id, patch) {
  const { data, error } = await supabase.from('journal_entries').update(patch).eq('id', id).select(LIST_COLS).single()
  if (error) throw error
  return data
}
export async function updateMany(ids, patch) {
  const { error } = await supabase.from('journal_entries').update(patch).in('id', ids)
  if (error) throw error
}
export async function deleteEntries(ids) {
  const { error } = await supabase.from('journal_entries').delete().in('id', ids)
  if (error) throw error
}
export const setArchived = (ids, v) => updateMany(ids, { is_archived: v })
export const setFavorite = (ids, v) => updateMany(ids, { is_favorite: v })
export const moveToFolder = (ids, folderId) => updateMany(ids, { folder_id: folderId })

// Duplicate = new entry dated today with the same content (handy as a reusable template).
export async function duplicateEntry(id, userId) {
  const full = await fetchEntry(id)
  if (!full) throw new Error('Entry not found')
  const copy = {
    user_id: userId,
    title: full.is_locked ? null : full.title ? `${full.title} (copy)`.slice(0, 200) : null,
    content: full.content,
    mood: full.mood,
    category: full.category,
    tags: full.tags || [],
    folder_id: full.folder_id,
    is_locked: full.is_locked,
    entry_date: todayLocal(),
  }
  return createEntry(copy)
}

// ---------------------------------------------------------------- overview & insights
export async function fetchOverview() {
  const { data, error } = await supabase.rpc('journal_overview', { p_today: todayLocal() })
  if (error) throw error
  return data
}
export async function fetchOnThisDay() {
  const { data, error } = await supabase.rpc('journal_on_this_day', { p_today: todayLocal() })
  if (error) throw error
  return data || []
}
export async function fetchNeighbors(id) {
  const { data, error } = await supabase.rpc('journal_neighbors', { p_id: id })
  if (error) throw error
  return (Array.isArray(data) ? data[0] : data) || { prev_id: null, next_id: null }
}
export async function fetchDailyStats(from, to) {
  const { data, error } = await supabase.rpc('journal_daily_stats', { p_from: from, p_to: to })
  if (error) throw error
  return data || []
}
export async function fetchLatestReflection() {
  const { data, error } = await supabase.from('journal_reflections').select('*').order('created_at', { ascending: false }).limit(1)
  if (error) throw error
  return data?.[0] || null
}

// ---------------------------------------------------------------- folders
export async function fetchFolders() {
  const { data, error } = await supabase.from('journal_folders').select('*').order('sort_order').order('created_at')
  if (error) throw error
  return data || []
}
export async function createFolder(userId, f) {
  const { data, error } = await supabase.from('journal_folders').insert({ user_id: userId, ...f }).select().single()
  if (error) throw error
  return data
}
export async function updateFolder(id, patch) {
  const { data, error } = await supabase.from('journal_folders').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteFolder(id) {
  const { error } = await supabase.from('journal_folders').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------- tags
export async function fetchTagStats() {
  const { data, error } = await supabase.rpc('journal_tag_stats')
  if (error) throw error
  return (data || []).map((t) => ({ tag: t.tag, uses: Number(t.uses) || 0, color: t.color || hashColor(t.tag), custom: !!t.color }))
}
export async function saveTagColor(userId, name, color) {
  const { error } = await supabase.from('journal_tags').upsert({ user_id: userId, name, color }, { onConflict: 'user_id,name' })
  if (error) throw error
}
export async function renameTag(oldName, newName) {
  const { error } = await supabase.rpc('journal_rename_tag', { p_old: oldName, p_new: newName })
  if (error) throw error
}
export async function deleteTag(name) {
  const { error } = await supabase.rpc('journal_delete_tag', { p_name: name })
  if (error) throw error
}

// Lock (encrypt) or unlock (decrypt) an existing entry. The vault must be unlocked first.
export async function setEntryLocked(id, lock) {
  const full = await fetchEntry(id)
  if (!full || !!full.is_locked === lock) return full
  if (lock) {
    if ((full.content || '').length + (full.title || '').length > MAX_PRIVATE_CHARS) throw new Error('This entry is too long to make private (limit ~30,000 characters).')
    const payload = await encryptEntry({ title: full.title, content: full.content })
    return updateEntry(id, { content: payload, title: null, is_locked: true })
  }
  const d = await decryptEntry(full.content)
  return updateEntry(id, { content: d.content || ' ', title: d.title || null, is_locked: false })
}
