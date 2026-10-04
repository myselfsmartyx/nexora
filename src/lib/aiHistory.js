import { supabase } from './supabase.js'

export const CONVO_PAGE_SIZE = 40
const CONVO_COLS = 'id, title, is_pinned, last_message_at, created_at, message_count'

// Short readable title from the first message ("Help me build a tight morning rou…").
export function makeTitle(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return 'New chat'
  if (t.length <= 48) return t
  const cut = t.slice(0, 48)
  const sp = cut.lastIndexOf(' ')
  return (sp > 24 ? cut.slice(0, sp) : cut) + '…'
}

// Pinned first, then newest activity first.
export function sortConversations(list) {
  return [...list].sort((a, b) => {
    if (!!b.is_pinned !== !!a.is_pinned) return b.is_pinned ? 1 : -1
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  })
}

// Buckets for the sidebar: Pinned / Today / Yesterday / Previous 7 days / Previous 30 days / Older
export function groupConversations(list) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const DAY = 86400000
  const t0 = startOfToday.getTime()
  const buckets = [
    ['Pinned', []],
    ['Today', []],
    ['Yesterday', []],
    ['Previous 7 days', []],
    ['Previous 30 days', []],
    ['Older', []],
  ]
  for (const c of list) {
    if (c.is_pinned) { buckets[0][1].push(c); continue }
    const t = new Date(c.last_message_at).getTime()
    if (t >= t0) buckets[1][1].push(c)
    else if (t >= t0 - DAY) buckets[2][1].push(c)
    else if (t >= t0 - 7 * DAY) buckets[3][1].push(c)
    else if (t >= t0 - 30 * DAY) buckets[4][1].push(c)
    else buckets[5][1].push(c)
  }
  return buckets.filter(([, items]) => items.length > 0)
}

// Only conversations that actually contain messages (no empty "ghost" chats).
export async function fetchConversations(userId, from = 0) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select(CONVO_COLS)
    .eq('user_id', userId)
    .gt('message_count', 0)
    .order('is_pinned', { ascending: false })
    .order('last_message_at', { ascending: false })
    .range(from, from + CONVO_PAGE_SIZE - 1)
  if (error) throw error
  return data || []
}

export async function fetchLatestConversationId(userId) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('user_id', userId)
    .gt('message_count', 0)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.id || null
}

// Latest 200 messages, returned oldest → newest. (The old code fetched the OLDEST 100, so long
// chats lost their newest replies on reload.) Role breaks timestamp ties: question before answer.
export async function fetchMessages(conversationId) {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('role', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data || []).reverse()
}

export async function renameConversation(id, title) {
  const clean = makeTitle(title).slice(0, 80)
  const { error } = await supabase.from('ai_conversations').update({ title: clean }).eq('id', id)
  if (error) throw error
  return clean
}

export async function setConversationPinned(id, pinned) {
  const { error } = await supabase.from('ai_conversations').update({ is_pinned: pinned }).eq('id', id)
  if (error) throw error
}

// Messages are removed automatically (ON DELETE CASCADE).
export async function deleteConversation(id) {
  const { error } = await supabase.from('ai_conversations').delete().eq('id', id)
  if (error) throw error
}

// Full-text-ish search across ALL message contents → [{ conversation_id, snippet }], one per chat.
export async function searchMessages(userId, query) {
  const q = query.trim().slice(0, 80).replace(/[%_\\]/g, (m) => '\\' + m) // escape LIKE wildcards
  if (q.length < 2) return []
  const { data, error } = await supabase
    .from('ai_messages')
    .select('conversation_id, content, created_at')
    .eq('user_id', userId)
    .ilike('content', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) throw error
  const seen = new Map()
  const needle = query.trim().toLowerCase()
  for (const row of data || []) {
    if (seen.has(row.conversation_id)) continue
    const text = row.content.replace(/\s+/g, ' ')
    const at = Math.max(0, text.toLowerCase().indexOf(needle))
    const start = Math.max(0, at - 30)
    seen.set(row.conversation_id, {
      conversation_id: row.conversation_id,
      snippet: (start > 0 ? '…' : '') + text.slice(start, start + 110) + (text.length > start + 110 ? '…' : ''),
    })
  }
  return [...seen.values()]
}

export async function fetchConversationsByIds(userId, ids) {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('ai_conversations')
    .select(CONVO_COLS)
    .eq('user_id', userId)
    .in('id', ids)
  if (error) throw error
  return data || []
}
