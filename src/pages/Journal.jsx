import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, ArrowLeft, MoreVertical, Sparkles, Tag, X, Plus, Flame, PenLine,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'

// Single source of truth for moods — used by both the filter chips and the composer.
const MOODS = [
  { id: 'happy', emoji: '🙂', label: 'Happy', color: 'text-success', bg: 'bg-success/10' },
  { id: 'neutral', emoji: '😐', label: 'Neutral', color: 'text-ink-secondary', bg: 'bg-base-elevated' },
  { id: 'reflective', emoji: '🤔', label: 'Reflective', color: 'text-secondary', bg: 'bg-secondary/10' },
  { id: 'stressed', emoji: '😣', label: 'Stressed', color: 'text-error', bg: 'bg-error/10' },
  { id: 'excited', emoji: '🤩', label: 'Excited', color: 'text-warning', bg: 'bg-warning/10' },
]
const moodInfo = (id) => MOODS.find((m) => m.id === id) || null

const CATEGORIES = ['General', 'Reflective', 'Gratitude', 'Work', 'Personal']

// Local prompt bank — no AI dependency, works even while the Groq key issue is unresolved.
// Swap this for a real ai-chat / generate-principles Edge Function call later; the composer
// code below doesn't need to change, just what fillSuggestion() does.
const PROMPTS = [
  'What went better than expected today?',
  'What are you avoiding right now, and why?',
  'Describe a moment today you felt fully focused.',
  'What is one thing you learned this week that changed your mind?',
  'Who did you help today, or who helped you?',
  'What would make tomorrow 10% better than today?',
  'What are you grateful for today?',
  'What decision are you putting off?',
  "What's a small win you haven't given yourself credit for?",
  'If today had a headline, what would it say?',
  'What drained your energy today, and what gave you energy?',
  "What's a belief you hold that you rarely question?",
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function dateLabel(iso) {
  const d = new Date(iso + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const same = (a, b) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Today, ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (same(d, yesterday)) return 'Yesterday, ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

// Consecutive-day streak counting back from today, based on distinct entry_date values.
function computeStreak(entries) {
  const days = new Set(entries.map((e) => e.entry_date))
  let streak = 0
  const cursor = new Date()
  for (;;) {
    const iso = cursor.toISOString().slice(0, 10)
    if (days.has(iso)) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    } else if (streak === 0 && iso === todayISO()) {
      // Today has no entry yet — don't break the streak on day zero, just don't count it.
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export default function Journal({ session }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [moodFilter, setMoodFilter] = useState('all')
  const [composerOpen, setComposerOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // Composer state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('neutral')
  const [category, setCategory] = useState('General')
  const [tags, setTags] = useState([])
  const [tagDraft, setTagDraft] = useState('')
  const [aiPrompt, setAiPrompt] = useState(null)
  const [saving, setSaving] = useState(false)

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  async function loadEntries() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', session.user.id)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setEntries(data || [])
    } catch (err) {
      showToast('Could not load journal: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const streak = useMemo(() => computeStreak(entries), [entries])

  const filtered = moodFilter === 'all' ? entries : entries.filter((e) => e.mood === moodFilter)

  const grouped = useMemo(() => {
    const map = new Map()
    for (const e of filtered) {
      const key = e.entry_date || todayISO()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e)
    }
    return Array.from(map.entries()) // already ordered by query
  }, [filtered])

  function openComposer() {
    setTitle('')
    setContent('')
    setMood('neutral')
    setCategory('General')
    setTags([])
    setTagDraft('')
    setAiPrompt(null)
    setComposerOpen(true)
  }

  function fillSuggestion() {
    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]
    setAiPrompt(prompt)
    if (!title) setTitle(prompt)
    if (!content) setContent('')
  }

  function addTagFromDraft() {
    const t = tagDraft.trim().replace(/^#/, '')
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagDraft('')
  }

  async function handleSave() {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .insert({
          user_id: session.user.id,
          title: title.trim() || null,
          content: content.trim(),
          mood,
          category,
          tags,
          ai_prompt_used: aiPrompt,
          entry_date: todayISO(),
        })
        .select()
      if (error) throw error
      if (data?.[0]) setEntries((prev) => [data[0], ...prev])
      setComposerOpen(false)
      showToast('Entry saved.')
    } catch (err) {
      showToast('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      {/* Top app bar */}
      <header
        className="sticky top-0 z-40 bg-base-bg/80 backdrop-blur-xl px-md h-16 border-b border-base-border/50 flex justify-between items-center"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <h1 className="text-h2 text-ink-primary tracking-tight">My Journal</h1>
        <button aria-label="Search" className="text-ink-secondary hover:text-primary transition duration-200">
          <Search size={22} />
        </button>
      </header>

      <main className="pt-md px-md flex flex-col gap-lg pb-2xl">
        {/* Mood filter chips */}
        <div className="flex overflow-x-auto gap-sm pb-1 -mx-md px-md" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setMoodFilter('all')}
            className={`chip whitespace-nowrap ${moodFilter === 'all' ? 'chip-active' : ''}`}
          >
            All
          </button>
          {MOODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMoodFilter(m.id)}
              className={`chip whitespace-nowrap ${moodFilter === m.id ? 'chip-active' : ''}`}
            >
              <span>{m.emoji}</span> {m.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="flex justify-center py-2xl">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="card p-lg text-center">
            <PenLine size={28} className="mx-auto text-ink-tertiary mb-sm" />
            <h3 className="text-h3 text-ink-primary mb-sm">
              {moodFilter === 'all' ? 'No entries yet' : 'No entries with this mood'}
            </h3>
            <p className="text-body-small text-ink-secondary leading-relaxed">
              Tap the pencil button below to write your first entry.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-xl">
            {grouped.map(([date, dayEntries]) => (
              <section key={date} className="flex flex-col gap-md">
                <h2 className="text-h3 text-ink-primary">{dateLabel(date)}</h2>
                {dayEntries.map((entry) => {
                  const mi = moodInfo(entry.mood)
                  return (
                    <article
                      key={entry.id}
                      className="bg-base-surface rounded-card border border-base-border p-md flex flex-col gap-sm relative overflow-hidden hover:border-primary/50 transition duration-300"
                    >
                      {mi && <div className={`absolute left-0 top-0 bottom-0 w-1 ${mi.bg.replace('/10', '')}`} />}
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="text-h3 text-ink-primary">{entry.title || 'Untitled entry'}</h3>
                        {mi && (
                          <div className={`flex items-center gap-xs ${mi.color} ${mi.bg} px-2 py-1 rounded-full shrink-0`}>
                            <span>{mi.emoji}</span>
                            <span className="text-caption">{mi.label}</span>
                          </div>
                        )}
                      </div>
                      {entry.ai_prompt_used && (
                        <div className="bg-base-elevated border border-base-border/50 rounded-md p-2 flex items-center gap-sm">
                          <Sparkles size={16} className="text-primary shrink-0" />
                          <span className="text-caption text-ink-secondary">
                            Prompted by AI: {entry.ai_prompt_used}
                          </span>
                        </div>
                      )}
                      <p className="text-body-small text-ink-secondary line-clamp-3">{entry.content}</p>
                      {(entry.tags || []).length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {entry.tags.map((t) => (
                            <span key={t} className="text-caption text-ink-tertiary">#{t}</span>
                          ))}
                        </div>
                      )}
                    </article>
                  )
                })}
              </section>
            ))}
          </div>
        )}

        {/* Streak footer */}
        {entries.length > 0 && (
          <div className="mt-auto pt-lg flex justify-center items-center gap-xs opacity-80">
            <Flame size={18} className="text-warning" />
            <p className="text-caption text-ink-secondary text-center">
              {streak > 0
                ? `You've journaled for ${streak} day${streak === 1 ? '' : 's'}. Keep the streak alive!`
                : 'Write today to start a new streak.'}
            </p>
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        aria-label="New Journal Entry"
        onClick={openComposer}
        className="fixed right-md bottom-[calc(80px+16px)] w-14 h-14 bg-primary text-base-bg rounded-full shadow-glow flex items-center justify-center transition-transform active:scale-95 z-40"
      >
        <PenLine size={24} />
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-base-elevated border border-base-border text-ink-primary text-body-small px-md py-2.5 rounded-button shadow-card whitespace-nowrap max-w-[90vw] overflow-hidden text-ellipsis">
          {toast}
        </div>
      )}

      {/* Composer — full-screen overlay, matches Stitch "New Entry" screen */}
      {composerOpen && (
        <div className="fixed inset-0 z-[60] bg-base-bg flex flex-col max-w-md mx-auto">
          <header
            className="flex justify-between items-center px-md h-16 shrink-0"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <button
              aria-label="Close"
              onClick={() => setComposerOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full text-ink-primary hover:bg-base-elevated transition"
            >
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-h3 text-ink-primary font-bold">New Entry</h1>
            <button
              aria-label="More"
              className="w-10 h-10 flex items-center justify-center rounded-full text-ink-primary hover:bg-base-elevated transition"
            >
              <MoreVertical size={22} />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto px-md pb-2xl flex flex-col">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-transparent border-none text-h1 text-ink-primary placeholder:text-ink-secondary focus:outline-none focus:ring-0 px-0 py-0 mt-lg mb-xl"
            />

            {/* Mood selector */}
            <div className="mb-xl card p-lg">
              <p className="text-caption text-ink-secondary mb-md text-center uppercase tracking-wider">
                How are you feeling?
              </p>
              <div className="flex justify-center items-center gap-sm">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    className={`flex flex-col items-center gap-xs p-sm rounded-xl transition-all duration-200 ${
                      mood === m.id
                        ? 'bg-base-elevated border-2 border-primary shadow-glow scale-110'
                        : 'grayscale opacity-50 hover:grayscale-0 hover:opacity-100'
                    }`}
                  >
                    <span className="text-3xl">{m.emoji}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Category chips */}
            <div className="mb-xl flex flex-wrap gap-sm">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-4 py-2 rounded-full border text-body-small transition-colors ${
                    category === c
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-base-border bg-base-elevated text-ink-secondary hover:border-primary hover:text-primary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* AI prompt banner, if used */}
            {aiPrompt && (
              <div className="mb-md bg-base-elevated border border-base-border rounded-md p-2 flex items-start gap-sm">
                <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                <span className="text-caption text-ink-secondary">{aiPrompt}</span>
              </div>
            )}

            {/* Text area */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your thoughts…"
              rows={8}
              className="w-full flex-1 bg-transparent border-none text-body text-ink-primary placeholder:text-ink-secondary focus:outline-none focus:ring-0 px-0 py-0 resize-none mb-xl min-h-[180px]"
            />

            {/* Tags */}
            <div className="mb-lg flex items-start gap-sm">
              <Tag size={18} className="text-ink-secondary mt-2 shrink-0" />
              <div className="flex flex-wrap gap-sm items-center flex-1">
                {tags.map((t) => (
                  <span key={t} className="chip">
                    #{t}
                    <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="hover:text-error ml-1">
                      <X size={14} />
                    </button>
                  </span>
                ))}
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTagFromDraft()
                    }
                  }}
                  placeholder="Add tag + Enter"
                  className="bg-transparent border border-dashed border-base-border rounded-chip px-3 py-1.5 text-caption text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-primary w-32"
                />
              </div>
            </div>
          </main>

          {/* Fixed bottom actions */}
          <div className="shrink-0 px-md pb-lg pt-md bg-gradient-to-t from-base-bg via-base-bg to-transparent flex flex-col gap-md">
            <div className="flex justify-end">
              <button
                aria-label="AI Suggest Topic"
                onClick={fillSuggestion}
                className="w-14 h-14 rounded-full bg-base-elevated border border-primary text-primary shadow-glow flex items-center justify-center active:scale-95 transition-transform"
              >
                <Sparkles size={22} />
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="w-full btn-primary py-4 rounded-input shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
