// Export is ALWAYS free: your journal is yours. Private entries are included only if the vault is unlocked.
import { supabase } from '../supabase.js'
import { decryptEntry, getState } from './vault.js'
import { moodInfo } from './constants.js'
import { todayLocal } from './dates.js'

async function fetchAll(onProgress) {
  const rows = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from('journal_entries').select('*').order('entry_date', { ascending: true }).order('created_at', { ascending: true }).range(from, from + 499)
    if (error) throw error
    rows.push(...data)
    onProgress?.(rows.length)
    if (data.length < 500) break
  }
  return rows
}

function download(name, text, type) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}

export async function exportJournal(format, onProgress) {
  const unlocked = !!getState().key
  const rows = await fetchAll(onProgress)
  let skipped = 0
  const out = []
  for (const r of rows) {
    let { title, content } = r
    if (r.is_locked) {
      if (!unlocked) { skipped += 1; continue }
      try { ({ title, content } = await decryptEntry(r.content)) } catch { skipped += 1; continue }
    }
    out.push({ id: r.id, date: r.entry_date, title: title || '', content, mood: r.mood, tags: r.tags || [], favorite: !!r.is_favorite, archived: !!r.is_archived, private: !!r.is_locked, created_at: r.created_at })
  }
  const stamp = todayLocal()
  if (format === 'json') {
    download(`nexora-journal-${stamp}.json`, JSON.stringify({ exported_at: new Date().toISOString(), entries: out }, null, 2), 'application/json')
  } else {
    const md = out.map((e) => {
      const m = moodInfo(e.mood)
      return `## ${e.title || 'Untitled'}\n*${e.date}${m ? ` · ${m.emoji} ${m.label}` : ''}${e.tags.length ? ` · ${e.tags.map((t) => `#${t}`).join(' ')}` : ''}${e.private ? ' · private' : ''}*\n\n${e.content}\n`
    }).join('\n---\n\n')
    download(`nexora-journal-${stamp}.md`, `# My Nexora Journal\n\nExported ${stamp} · ${out.length} entries\n\n---\n\n${md}`, 'text/markdown')
  }
  return { count: out.length, skipped }
}
