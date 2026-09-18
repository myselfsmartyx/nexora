import { useEffect, useState } from 'react'
import {
  Search,
  Settings,
  Sparkles,
  FileText,
  Link2,
  FileUp,
  Mic,
  Share2,
  Edit2,
  Lightbulb,
  Youtube,
  File,
  Mic2,
  Newspaper,
  Link as LinkIcon,
  Loader2,
  LogOut,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const CATEGORY_STYLES = {
  'SEO & Marketing': 'bg-success/10 text-success border-success/20',
  'Business Strategy': 'bg-secondary/10 text-secondary border-secondary/20',
  'Personal Development': 'bg-warning/10 text-warning border-warning/20',
  Productivity: 'bg-primary/10 text-primary border-primary/20',
  default: 'bg-base-elevated text-ink-secondary border-base-border',
}

const SOURCE_ICONS = {
  video: Youtube,
  pdf: File,
  voice: Mic2,
  article: Newspaper,
  website: LinkIcon,
  note: FileText,
}

function timeAgo(dateStr) {
  const d = new Date(dateStr)
  const secs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 172800) return 'Yesterday'
  return `${Math.floor(secs / 86400)} days ago`
}

function ImportanceDots({ level = 3 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= level ? 'bg-primary' : 'bg-base-border'}`}
        />
      ))}
    </div>
  )
}

function KnowledgeCard({ item }) {
  const SourceIcon = SOURCE_ICONS[item.source_type] || FileText
  const catStyle = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.default
  const insights = Array.isArray(item.insights) ? item.insights : []
  const tags = Array.isArray(item.tags) ? item.tags : []

  return (
    <div className="bg-base-surface rounded-card p-md border border-base-border/60 relative hover:border-primary/50 transition-all duration-300 group">
      <button className="absolute top-md right-md text-ink-secondary hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        <Edit2 size={18} />
      </button>

      <div className="flex items-center gap-1 mb-2 cursor-pointer w-max">
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${catStyle}`}>
          {item.category || 'Uncategorized'}
        </span>
      </div>

      <h3 className="text-h3 text-ink-primary mb-2">{item.title}</h3>

      {insights.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-md p-2 mb-3">
          <p className="text-body-small text-ink-primary flex items-start gap-2">
            <Lightbulb size={16} className="text-primary mt-0.5 shrink-0" />
            {insights[0]}
          </p>
        </div>
      )}

      {item.source_url && (
        <p className="text-xs text-ink-secondary mb-3 flex items-center gap-1 hover:text-primary cursor-pointer truncate">
          <LinkIcon size={14} className="shrink-0" />
          {item.source_url.replace(/^https?:\/\//, '')}
        </p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((t) => (
            <span key={t} className="text-xs text-ink-secondary">
              #{t}
            </span>
          ))}
          <span className="px-2 py-0.5 rounded-md border border-dashed border-ink-secondary/50 text-xs text-ink-secondary cursor-pointer hover:border-primary hover:text-primary transition-colors">
            + #AddTag
          </span>
        </div>
      )}

      <div className="flex justify-between items-center pt-2 border-t border-base-border/50">
        <span className="text-xs text-ink-secondary flex items-center gap-1">
          <SourceIcon size={14} />
          Saved {timeAgo(item.created_at)}
        </span>
        <ImportanceDots level={item.importance ?? 3} />
      </div>
    </div>
  )
}

export default function Capture() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [captureUrl, setCaptureUrl] = useState('')
  const [aiQuery, setAiQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    setLoading(true)
    const { data, error } = await supabase
      .from('knowledge_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      setNotice({ type: 'error', text: error.message })
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  async function handleCapture(e) {
    e.preventDefault()
    if (!captureUrl.trim()) return
    setSaving(true)
    setNotice(null)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('knowledge_items').insert({
      user_id: userData.user.id,
      title: captureUrl.trim(),
      source_url: captureUrl.trim(),
      source_type: 'website',
      category: 'Uncategorized',
      content: '',
      insights: [],
      tags: [],
      importance: 3,
    })
    if (error) {
      setNotice({ type: 'error', text: error.message })
    } else {
      setCaptureUrl('')
      setNotice({ type: 'success', text: 'Saved! AI extraction arrives with Edge Functions (Week 3).' })
      loadItems()
    }
    setSaving(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const filtered = aiQuery.trim()
    ? items.filter(
        (i) =>
          (i.title || '').toLowerCase().includes(aiQuery.toLowerCase()) ||
          (i.category || '').toLowerCase().includes(aiQuery.toLowerCase()) ||
          (i.tags || []).some((t) => t.toLowerCase().includes(aiQuery.toLowerCase()))
      )
    : items

  return (
    <div className="pb-24">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-base-bg/80 backdrop-blur-xl flex justify-between items-center px-md h-16 border-b border-base-border/50">
        <h1 className="text-h2 text-ink-primary tracking-tight">Smart Capture</h1>
        <div className="flex items-center gap-md">
          <button className="text-ink-secondary hover:text-primary transition-colors">
            <Search size={22} />
          </button>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-ink-secondary hover:text-error transition-colors"
          >
            <LogOut size={22} />
          </button>
        </div>
      </header>

      <main className="pt-4 px-md flex flex-col gap-lg">
        {/* AI Input Bar */}
        <form onSubmit={handleCapture}>
          <div className="relative w-full rounded-xl p-[1px] bg-gradient-to-r from-primary/30 via-transparent to-primary/30 shadow-glow focus-within:shadow-[0_0_20px_rgba(0,212,170,0.3)] transition-shadow duration-300">
            <div className="bg-base-surface rounded-xl flex items-center px-4 py-3 w-full">
              <input
                value={captureUrl}
                onChange={(e) => setCaptureUrl(e.target.value)}
                placeholder="Paste a URL to capture..."
                type="url"
                className="bg-transparent border-none w-full text-ink-primary placeholder:text-ink-secondary focus:ring-0 text-body px-0 py-0 h-auto"
              />
              <button type="submit" disabled={saving} className="ml-2 text-primary disabled:opacity-50">
                {saving ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
              </button>
            </div>
          </div>
        </form>

        {/* Quick-Action Chips */}
        <div className="flex overflow-x-auto gap-sm pb-1 -mx-md px-md" style={{ scrollbarWidth: 'none' }}>
          {[
            { icon: FileText, label: 'Text Note' },
            { icon: Link2, label: 'Paste URL' },
            { icon: FileUp, label: 'Upload PDF' },
            { icon: Mic, label: 'Voice Note' },
            { icon: Share2, label: 'Import Social' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              className="whitespace-nowrap px-4 py-2 rounded-full border border-white/5 bg-base-surface text-ink-secondary hover:text-primary hover:border-primary/50 transition-colors text-button font-semibold flex items-center gap-2"
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>

        {/* AI Knowledge Search */}
        <div className="bg-[#0D0D14] border-l-2 border-primary rounded-r-xl flex items-center px-4 py-3 border-y-transparent border-r-transparent">
          <Search size={20} className="text-ink-secondary mr-2 shrink-0" />
          <input
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            placeholder="Search your knowledge... (AI retrieval comes Week 9)"
            className="bg-transparent border-none w-full text-ink-primary placeholder:text-ink-secondary focus:ring-0 text-body-small px-0 py-0"
          />
        </div>

        {notice && (
          <p
            className={`text-body-small rounded-input px-md py-sm border ${
              notice.type === 'error'
                ? 'text-error border-error/40 bg-error/10'
                : 'text-primary border-primary/40 bg-primary/10'
            }`}
          >
            {notice.text}
          </p>
        )}

        {/* Stats */}
        <div className="flex justify-between items-center text-xs text-ink-secondary -mt-2">
          <span>
            {items.length} Captures · Auto + Custom Tags
          </span>
          <button className="border border-primary text-primary px-3 py-1 rounded-full hover:bg-primary/10 transition-colors uppercase text-[10px] font-semibold tracking-wider">
            Smart Labels
          </button>
        </div>

        {/* Toggle */}
        <div className="flex bg-base-surface rounded-lg p-1 border border-white/5 w-full max-w-sm mx-auto">
          <button className="flex-1 py-1.5 rounded-md bg-primary text-base-bg shadow-sm text-sm font-semibold tracking-wide">
            Recent Activity
          </button>
          <button className="flex-1 py-1.5 rounded-md text-ink-secondary hover:text-ink-primary text-sm font-medium">
            Smart Collections
          </button>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="flex justify-center py-xl">
            <Loader2 size={28} className="text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-lg text-center">
            <Sparkles size={32} className="text-primary mx-auto mb-sm" />
            <p className="text-h3 text-ink-primary mb-xs">Nothing captured yet</p>
            <p className="text-body-small text-ink-secondary">
              Paste a URL above to save your first knowledge item.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            {filtered.map((item) => (
              <KnowledgeCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
