import { useEffect, useRef, useState } from 'react'
import {
  Search, Settings, Sparkles, FileText, Link2, FileUp, Mic, Share2,
  RefreshCw, Clock, Inbox,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'

// ---------- helpers (pure functions — nothing here can crash React) ----------
function timeAgo(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 172800) return 'Yesterday'
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return d.toLocaleDateString()
}

function firstInsight(insights) {
  if (!insights) return null
  if (Array.isArray(insights) && insights.length > 0) {
    return typeof insights[0] === 'string' ? insights[0] : insights[0]?.text || null
  }
  if (typeof insights === 'object') {
    const arr = insights.key_insights || insights.insights
    if (Array.isArray(arr) && arr.length > 0) {
      return typeof arr[0] === 'string' ? arr[0] : arr[0]?.text || null
    }
  }
  return null
}

const CAT_STYLE = {
  'SEO & Marketing': 'bg-success/10 text-success border-success/20',
  'Business Strategy': 'bg-secondary/10 text-secondary border-secondary/20',
  'Personal Development': 'bg-warning/10 text-warning border-warning/20',
  'Productivity': 'bg-primary/10 text-primary border-primary/20',
}
const catStyle = (c) => CAT_STYLE[c] || 'bg-base-elevated text-ink-secondary border-base-border'

const SOURCE_ICON = { url: Link2, pdf: FileText, screenshot: FileText, note: FileText, voice: Mic }

// ---------- page component ----------
export default function Capture({ session }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('recent') // 'recent' | 'collections'
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const searchRef = useRef(null)
  const fileRef = useRef(null)
  const toastTimer = useRef(null)

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  async function loadItems() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('knowledge_items')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setItems(data || [])
    } catch (err) {
      showToast('Could not load captures: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save a URL or text note
  async function handleCapture() {
    const value = input.trim()
    if (!value || saving) return
    setSaving(true)
    try {
      const isUrl = /^https?:\/\//i.test(value)
      let title = value
      if (isUrl) {
        try {
          title = new URL(value).hostname.replace(/^www\./, '')
        } catch {
          title = value
        }
      } else if (value.length > 80) {
        title = value.slice(0, 80) + '…'
      }
      const { data, error } = await supabase
        .from('knowledge_items')
        .insert({
          user_id: session.user.id,
          source_type: isUrl ? 'url' : 'note',
          source_url: isUrl ? value : null,
          title,
          content: value,
          category: 'Uncategorized',
          importance: 1,
          tags: [],
        })
        .select()
      if (error) throw error
      if (data?.[0]) setItems((prev) => [data[0], ...prev])
      setInput('')
      showToast('Captured. AI extraction arrives in Week 3.')
    } catch (err) {
      showToast('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Upload a PDF / image to Supabase Storage + index it
  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    showToast('Uploading ' + file.name + '…')
    try {
      const path = `${session.user.id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage
        .from('knowledge-files')
        .upload(path, file)
      if (upErr) throw upErr

      const ext = file.name.split('.').pop().toLowerCase()
      const source_type = ext === 'pdf'
        ? 'pdf'
        : ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)
          ? 'screenshot'
          : 'file'

      const { data, error } = await supabase
        .from('knowledge_items')
        .insert({
          user_id: session.user.id,
          source_type,
          file_path: path,
          title: file.name,
          content: `Uploaded ${source_type}: ${file.name}`,
          category: 'Uncategorized',
          importance: 1,
          tags: [],
        })
        .select()
      if (error) throw error
      if (data?.[0]) setItems((prev) => [data[0], ...prev])
      showToast('File saved to your knowledge base.')
    } catch (err) {
      showToast('Upload failed: ' + err.message)
    }
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? items.filter((i) =>
        `${i.title || ''} ${i.content || ''} ${(i.tags || []).join(' ')}`.toLowerCase().includes(q)
      )
    : items

  return (
    <div>
      {/* Top app bar */}
      <header
        className="sticky top-0 z-40 bg-base-bg/80 backdrop-blur-xl px-md h-16 border-b border-base-border/50 flex justify-between items-center"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <h1 className="text-h2 text-ink-primary tracking-tight">Smart Capture</h1>
        <div className="flex items-center gap-md">
          <button
            aria-label="Search"
            onClick={() => searchRef.current?.focus()}
            className="text-ink-secondary hover:text-primary transition duration-200"
          >
            <Search size={22} />
          </button>
          <button
            aria-label="Refresh"
            onClick={loadItems}
            className="text-ink-secondary hover:text-primary transition duration-200"
          >
            <RefreshCw size={20} />
          </button>
          <button
            aria-label="Settings"
            onClick={() => showToast('Settings screen is coming in the next update.')}
            className="text-ink-secondary hover:text-primary transition duration-200"
          >
            <Settings size={22} />
          </button>
        </div>
      </header>

      <main className="pt-md px-md flex flex-col gap-lg">
        {/* AI input bar — gradient border glow */}
        <div className="relative w-full rounded-input p-px bg-gradient-to-r from-primary/30 via-transparent to-primary/30 transition duration-300 focus-within:shadow-glow">
          <div className="bg-base-surface rounded-input flex items-center px-4 py-3 w-full">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
              placeholder="Paste a URL or write a quick note…"
              className="bg-transparent border-none w-full text-body text-ink-primary placeholder:text-ink-secondary focus:outline-none focus:ring-0 px-0 py-0 h-auto"
            />
            <button
              aria-label="Capture with AI"
              onClick={handleCapture}
              disabled={saving}
              className="ml-2 text-primary disabled:opacity-50"
            >
              <Sparkles size={24} />
            </button>
          </div>
        </div>

        {/* Quick-action chips */}
        <div className="flex overflow-x-auto gap-sm pb-1 -mx-md px-md" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => searchRef.current?.focus()} className="whitespace-nowrap px-4 py-2 rounded-full border border-base-border bg-base-surface text-ink-secondary hover:text-primary hover:border-primary/50 transition duration-200 flex items-center gap-2 text-body-small font-semibold">
            <FileText size={18} /> Text Note
          </button>
          <button onClick={() => searchRef.current?.focus()} className="whitespace-nowrap px-4 py-2 rounded-full border border-base-border bg-base-surface text-ink-secondary hover:text-primary hover:border-primary/50 transition duration-200 flex items-center gap-2 text-body-small font-semibold">
            <Link2 size={18} /> Paste URL
          </button>
          <button onClick={() => fileRef.current?.click()} className="whitespace-nowrap px-4 py-2 rounded-full border border-base-border bg-base-surface text-ink-secondary hover:text-primary hover:border-primary/50 transition duration-200 flex items-center gap-2 text-body-small font-semibold">
            <FileUp size={18} /> Upload PDF
          </button>
          <button onClick={() => showToast('Voice notes arrive in Week 10 — text, URLs & files work today.')} className="whitespace-nowrap px-4 py-2 rounded-full border border-base-border bg-base-surface text-ink-secondary hover:text-primary hover:border-primary/50 transition duration-200 flex items-center gap-2 text-body-small font-semibold">
            <Mic size={18} /> Voice Note
          </button>
          <button onClick={() => showToast('Social import arrives in Week 10.')} className="whitespace-nowrap px-4 py-2 rounded-full border border-base-border bg-base-surface text-ink-secondary hover:text-primary hover:border-primary/50 transition duration-200 flex items-center gap-2 text-body-small font-semibold">
            <Share2 size={18} /> Import Social
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} />

        {/* AI knowledge search */}
        <div className="bg-[#0D0D14] border-l-2 border-primary rounded-r-input flex items-center px-4 py-3 border-y-transparent border-r-transparent">
          <Search size={20} className="text-ink-secondary mr-2 shrink-0" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your knowledge…"
            className="bg-transparent border-none w-full text-body-small text-ink-primary placeholder:text-ink-secondary focus:outline-none focus:ring-0 px-0 py-0"
          />
        </div>

        {/* Stats line */}
        <div className="flex justify-between items-center text-caption text-ink-secondary">
          <span>{items.length} Capture{items.length === 1 ? '' : 's'} · Auto-categorized</span>
          <span className="text-primary">AI labels coming Week 3</span>
        </div>

        {/* Recent / Collections toggle */}
        <div className="flex bg-base-surface rounded-lg p-1 border border-base-border w-full max-w-sm mx-auto">
          <button
            onClick={() => setTab('recent')}
            className={`flex-1 py-1.5 rounded-md text-body-small transition duration-200 ${
              tab === 'recent' ? 'bg-primary text-base-bg font-semibold' : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            Recent Activity
          </button>
          <button
            onClick={() => setTab('collections')}
            className={`flex-1 py-1.5 rounded-md text-body-small transition duration-200 ${
              tab === 'collections' ? 'bg-primary text-base-bg font-semibold' : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            Smart Collections
          </button>
        </div>

        {/* Content */}
        {tab === 'collections' ? (
          <div className="card p-lg text-center">
            <Inbox size={28} className="mx-auto text-ink-tertiary mb-sm" />
            <h3 className="text-h3 text-ink-primary mb-sm">AI-curated collections</h3>
            <p className="text-body-small text-ink-secondary leading-relaxed">
              Marketing Strategies, Deep Work Systems, Financial Projects and more —
              auto-generated from your captures. Unlocks with the AI engine in Week 9.
            </p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-2xl">
            <RefreshCw size={24} className="text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-lg text-center">
            <Inbox size={28} className="mx-auto text-ink-tertiary mb-sm" />
            <h3 className="text-h3 text-ink-primary mb-sm">
              {q ? 'No matches found' : 'Your knowledge base is empty'}
            </h3>
            <p className="text-body-small text-ink-secondary leading-relaxed">
              {q
                ? 'Try a different search term.'
                : 'Paste a link above, write a note, or upload a PDF — Nexora keeps it organized.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            {filtered.map((item) => {
              const Icon = SOURCE_ICON[item.source_type] || FileText
              const insight = firstInsight(item.insights)
              return (
                <article
                  key={item.id}
                  className="bg-base-surface rounded-card p-md border border-base-border/60 relative hover:border-primary/50 transition duration-300"
                >
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border mb-2 ${catStyle(item.category)}`}>
                    {item.category || 'Uncategorized'}
                  </span>
                  <h3 className="text-h3 text-ink-primary mb-2">{item.title}</h3>
                  {insight && (
                    <div className="bg-primary/5 border border-primary/20 rounded-md p-2 mb-3">
                      <p className="text-body-small text-ink-primary flex items-start gap-2">
                        <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
                        {insight}
                      </p>
                    </div>
                  )}
                  {(item.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {item.tags.map((t) => (
                        <span key={t} className="text-xs text-ink-secondary">#{t}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-base-border/50">
                    <span className="text-xs text-ink-secondary flex items-center gap-1">
                      <Icon size={14} /> Saved {timeAgo(item.created_at)}
                    </span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div
                          key={n}
                          className={`w-1.5 h-1.5 rounded-full ${n <= (item.importance || 1) ? 'bg-primary' : 'bg-base-border'}`}
                        />
                      ))}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-base-elevated border border-base-border text-ink-primary text-body-small px-md py-2.5 rounded-button shadow-card whitespace-nowrap max-w-[90vw] overflow-hidden text-ellipsis">
          {toast}
        </div>
      )}
    </div>
  )
}
