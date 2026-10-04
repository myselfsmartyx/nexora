import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Star, Trash2, ExternalLink, Lightbulb, CheckSquare, Square, Folder, Sparkles,
  RefreshCw, Loader2, PencilLine, Video, Pencil, Check, X, MessageSquare, AlertTriangle, Link2,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { analyzeItem, safeHref, hostOf, PLATFORM_LABEL, transcribeMediaFile } from '../lib/capture.js'
import { catStyle, timeAgo, SOURCE_ICON } from '../components/capture/ItemCard.jsx'

const asList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : [])

export default function KnowledgeDetail({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const userId = session.user.id

  const [item, setItem] = useState(null)
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [toast, setToast] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [details, setDetails] = useState('')
  const [detailsBusy, setDetailsBusy] = useState('') // '' | 'saving' | 'transcribing'
  const [thumbOk, setThumbOk] = useState(true)
  const toastTimer = useRef(null)
  const fileRef = useRef(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('knowledge_items').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
      if (error) throw error
      if (!data) { setNotFound(true); return }
      setItem(data)
      setTitleDraft(data.title || '')
      const { data: links } = await supabase.from('collection_items').select('collection_id').eq('item_id', id)
      const colIds = (links || []).map((l) => l.collection_id)
      if (colIds.length) {
        const { data: cols } = await supabase.from('collections').select('id, name').in('id', colIds)
        setCollections(cols || [])
      }
    } catch (err) {
      showToast('Could not load this item: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [id, userId, showToast])

  useEffect(() => { load() }, [load])

  async function patch(fields) {
    const { data, error } = await supabase.from('knowledge_items').update(fields).eq('id', item.id).select('*').single()
    if (error) throw error
    setItem(data)
    return data
  }

  async function toggleFavorite() {
    try { await patch({ is_favorite: !item.is_favorite }) } catch (err) { showToast('Could not update: ' + err.message) }
  }

  async function saveTitle() {
    const t = titleDraft.trim().slice(0, 120)
    if (!t) { setEditingTitle(false); setTitleDraft(item.title || ''); return }
    try { await patch({ title: t }); setEditingTitle(false) } catch (err) { showToast('Could not rename: ' + err.message) }
  }

  async function toggleAction(text) {
    const ins = item.insights && typeof item.insights === 'object' ? item.insights : {}
    const done = new Set(asList(ins.done_actions))
    if (done.has(text)) done.delete(text); else done.add(text)
    try { await patch({ insights: { ...ins, done_actions: [...done] } }) } catch (err) { showToast('Could not update: ' + err.message) }
  }

  async function reanalyze() {
    if (analyzing) return
    setAnalyzing(true)
    try {
      const data = await analyzeItem(item.id)
      if (data?.item) setItem(data.item)
      showToast(data?.needs_details ? 'Not enough text to analyze — add details below.' : 'Analysis updated.')
      const { data: links } = await supabase.from('collection_items').select('collection_id').eq('item_id', item.id)
      const colIds = (links || []).map((l) => l.collection_id)
      if (colIds.length) {
        const { data: cols } = await supabase.from('collections').select('id, name').in('id', colIds)
        setCollections(cols || [])
      }
    } catch (err) {
      showToast(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  // Adds the user's own words (what they remember / copied caption) and re-runs the AI.
  async function submitDetails() {
    const extra = details.trim()
    if (extra.length < 5 || detailsBusy) return
    setDetailsBusy('saving')
    try {
      const base = item.content && item.content.trim() !== item.source_url ? item.content.trim() + '\n\n' : ''
      await patch({ content: (base + extra).slice(0, 20000) })
      setDetails('')
      await reanalyze()
    } catch (err) {
      showToast('Could not save: ' + err.message)
    } finally {
      setDetailsBusy('')
    }
  }

  // Transcribes a screen recording of the reel and feeds the spoken text to the AI.
  async function handleRecording(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || detailsBusy) return
    setDetailsBusy('transcribing')
    try {
      const text = await transcribeMediaFile(userId, file)
      if (!text) throw new Error("We couldn't hear any speech in that recording.")
      const base = item.content && item.content.trim() !== item.source_url ? item.content.trim() + '\n\n' : ''
      await patch({ content: (base + 'Transcript of the video:\n' + text).slice(0, 20000) })
      await reanalyze()
    } catch (err) {
      showToast(err.message)
    } finally {
      setDetailsBusy('')
    }
  }

  async function remove() {
    if (!window.confirm('Delete this saved item permanently?')) return
    try {
      if (item.file_path) await supabase.storage.from('knowledge-files').remove([item.file_path])
      const { error } = await supabase.from('knowledge_items').delete().eq('id', item.id)
      if (error) throw error
      navigate('/capture', { replace: true })
    } catch (err) {
      showToast('Could not delete: ' + err.message)
    }
  }

  function askAi() {
    navigate('/ai', { state: { prefill: `Based on what I saved in “${item.title}”, what should I do first to put it into practice?` } })
  }

  // ---------- render ----------
  if (loading) {
    return <div className="flex justify-center py-2xl"><Loader2 size={26} className="text-primary animate-spin" /></div>
  }
  if (notFound || !item) {
    return (
      <div className="px-md py-lg text-center">
        <p className="text-body text-ink-secondary mb-md">This item doesn't exist or was deleted.</p>
        <button onClick={() => navigate('/capture')} className="btn-secondary">Back to Smart Capture</button>
      </div>
    )
  }

  const ins = item.insights && typeof item.insights === 'object' && !Array.isArray(item.insights) ? item.insights : {}
  const insights = asList(ins.key_insights)
  const actions = asList(ins.actionable_items)
  const done = new Set(asList(ins.done_actions))
  const tools = (Array.isArray(ins.tools_mentioned) ? ins.tools_mentioned : []).filter((t) => t && t.name)
  const links = asList(item.extracted_links).filter((l) => safeHref(l))
  const sourceHref = safeHref(item.source_url)
  const meta = item.source_meta && typeof item.source_meta === 'object' ? item.source_meta : {}
  const thumb = safeHref(meta.thumbnail)
  const platform = item.source_platform ? PLATFORM_LABEL[item.source_platform] || item.source_platform : null
  const SourceIcon = SOURCE_ICON[item.source_type] || Link2
  const needsDetails = item.status === 'needs_details'
  const failed = item.status === 'failed'

  return (
    <div className="pb-28">
      <header
        className="sticky top-0 z-40 bg-base-bg/80 backdrop-blur-xl px-md h-16 border-b border-base-border/50 flex justify-between items-center"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button aria-label="Back" onClick={() => navigate('/capture')} className="text-ink-secondary hover:text-primary transition flex items-center gap-1">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-md">
          <button aria-label={item.is_favorite ? 'Remove favorite' : 'Add favorite'} onClick={toggleFavorite} className={`transition ${item.is_favorite ? 'text-warning' : 'text-ink-secondary hover:text-warning'}`}>
            <Star size={22} fill={item.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <button aria-label="Delete" onClick={remove} className="text-ink-secondary hover:text-error transition">
            <Trash2 size={21} />
          </button>
        </div>
      </header>

      <main className="px-md pt-md flex flex-col gap-lg">
        {/* Source + title */}
        <section>
          <div className="flex items-center gap-2 text-caption text-ink-secondary mb-2 flex-wrap">
            <SourceIcon size={14} />
            <span>{platform || item.source_type}</span>
            {meta.author && <span>· {String(meta.author).slice(0, 40)}</span>}
            <span>· {timeAgo(item.captured_at)}</span>
          </div>
          {thumb && thumbOk && (
            <img
              src={thumb}
              alt=""
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => setThumbOk(false)}
              className="w-full max-h-52 object-cover rounded-card border border-base-border mb-3"
            />
          )}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${catStyle(item.category)}`}>{item.category || 'Uncategorized'}</span>
            {collections.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 text-[11px] text-ink-secondary border border-base-border rounded px-2 py-0.5">
                <Folder size={11} /> {c.name}
              </span>
            ))}
          </div>

          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value.slice(0, 120))}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                className="input !py-2 text-h3"
              />
              <button aria-label="Save title" onClick={saveTitle} className="text-primary"><Check size={22} /></button>
              <button aria-label="Cancel" onClick={() => { setEditingTitle(false); setTitleDraft(item.title || '') }} className="text-ink-secondary"><X size={22} /></button>
            </div>
          ) : (
            <h1 className="text-h2 text-ink-primary break-words flex items-start gap-2">
              <span className="flex-1">{item.title}</span>
              <button aria-label="Rename" onClick={() => setEditingTitle(true)} className="text-ink-tertiary hover:text-primary mt-1 shrink-0"><Pencil size={16} /></button>
            </h1>
          )}

          {sourceHref && (
            <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-body-small text-primary mt-2 hover:underline break-all">
              <ExternalLink size={14} className="shrink-0" /> Open original · {hostOf(sourceHref)}
            </a>
          )}
        </section>

        {analyzing && (
          <div className="bg-primary/10 border border-primary/20 rounded-card p-md flex items-center gap-3">
            <RefreshCw size={18} className="text-primary animate-spin shrink-0" />
            <p className="text-body-small text-ink-primary">Analyzing with AI…</p>
          </div>
        )}

        {failed && !analyzing && (
          <div className="bg-error/10 border border-error/20 rounded-card p-md flex items-center justify-between gap-3">
            <p className="text-body-small text-error flex items-center gap-2"><AlertTriangle size={16} className="shrink-0" /> The AI analysis didn't finish.</p>
            <button onClick={reanalyze} className="text-body-small font-semibold text-primary shrink-0">Try again</button>
          </div>
        )}

        {item.summary && (
          <section className="card p-md">
            <h2 className="text-caption font-semibold text-ink-secondary uppercase tracking-wider mb-2">Summary</h2>
            <p className="text-body text-ink-primary leading-relaxed">{item.summary}</p>
          </section>
        )}

        {/* Needs details — rescues reels that Instagram won't reveal */}
        {needsDetails && !analyzing && (
          <section className="bg-warning/10 border border-warning/30 rounded-card p-md">
            <h2 className="text-body font-semibold text-ink-primary flex items-center gap-2 mb-1">
              <PencilLine size={18} className="text-warning" /> Help Nexora capture this
            </h2>
            <p className="text-body-small text-ink-secondary mb-3">
              {platform || 'This site'} shared very little text with us. Add what you remember, or upload a screen recording and Nexora will transcribe it.
            </p>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 8000))}
              rows={4}
              disabled={!!detailsBusy}
              placeholder="e.g. 3 AI tools for SEO: Surfer, NeuronWriter, Frase…"
              className="input resize-none text-body-small"
            />
            <div className="flex flex-col sm:flex-row gap-sm mt-sm">
              <button onClick={submitDetails} disabled={details.trim().length < 5 || !!detailsBusy} className="btn-primary h-11 flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                {detailsBusy === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Add &amp; re-analyze
              </button>
              <input ref={fileRef} type="file" accept="video/*,audio/*" className="hidden" onChange={handleRecording} />
              <button onClick={() => fileRef.current?.click()} disabled={!!detailsBusy} className="btn-secondary h-11 flex-1 flex items-center justify-center gap-2 !py-0 disabled:opacity-60">
                {detailsBusy === 'transcribing' ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
                {detailsBusy === 'transcribing' ? 'Transcribing…' : 'Upload recording'}
              </button>
            </div>
          </section>
        )}

        {insights.length > 0 && (
          <section>
            <h2 className="text-h3 text-ink-primary mb-sm">Key insights</h2>
            <div className="flex flex-col gap-sm">
              {insights.map((t, i) => (
                <div key={i} className="bg-primary/5 border border-primary/20 rounded-card p-md flex items-start gap-3">
                  <Lightbulb size={18} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-body-small text-ink-primary leading-relaxed">{t}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {actions.length > 0 && (
          <section>
            <h2 className="text-h3 text-ink-primary mb-sm">Actionable items</h2>
            <div className="card divide-y divide-base-border/60">
              {actions.map((t) => {
                const isDone = done.has(t)
                return (
                  <button key={t} onClick={() => toggleAction(t)} className="w-full flex items-start gap-3 p-md text-left active:bg-base-elevated transition" aria-pressed={isDone}>
                    {isDone ? <CheckSquare size={20} className="text-primary mt-0.5 shrink-0" /> : <Square size={20} className="text-ink-tertiary mt-0.5 shrink-0" />}
                    <span className={`text-body-small leading-relaxed ${isDone ? 'text-ink-tertiary line-through' : 'text-ink-primary'}`}>{t}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {tools.length > 0 && (
          <section>
            <h2 className="text-h3 text-ink-primary mb-sm">Tools mentioned</h2>
            <div className="flex flex-col gap-sm">
              {tools.map((t, i) => {
                const href = safeHref(t.url)
                const inner = (
                  <>
                    <div className="min-w-0">
                      <p className="text-body-small font-semibold text-ink-primary">{t.name}</p>
                      {t.use && <p className="text-caption text-ink-secondary">{t.use}</p>}
                    </div>
                    {href && <ExternalLink size={16} className="text-primary shrink-0" />}
                  </>
                )
                return href ? (
                  <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="bg-base-surface border border-base-border rounded-card p-md flex items-center justify-between gap-3 hover:border-primary/50 transition">{inner}</a>
                ) : (
                  <div key={i} className="bg-base-surface border border-base-border rounded-card p-md flex items-center justify-between gap-3">{inner}</div>
                )
              })}
            </div>
          </section>
        )}

        {links.length > 0 && (
          <section>
            <h2 className="text-h3 text-ink-primary mb-sm">Related links</h2>
            <div className="flex flex-col gap-sm">
              {links.map((l) => (
                <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="text-body-small text-primary flex items-center gap-2 hover:underline break-all">
                  <ExternalLink size={14} className="shrink-0" /> {hostOf(l)}<span className="text-ink-tertiary truncate">{new URL(l).pathname.slice(0, 40)}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {(item.tags || []).length > 0 && (
          <section className="flex flex-wrap gap-2">
            {item.tags.map((t) => <span key={t} className="chip">#{t}</span>)}
          </section>
        )}

        {!analyzing && (
          <button onClick={reanalyze} className="self-start text-caption text-ink-tertiary hover:text-primary transition flex items-center gap-1.5">
            <RefreshCw size={13} /> Re-analyze with AI
          </button>
        )}
      </main>

      {/* Bottom action bar */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-3xl bottom-[calc(env(safe-area-inset-bottom)+68px)] lg:bottom-4 px-md z-40 pointer-events-none"
      >
        <div className="pointer-events-auto bg-base-elevated/95 backdrop-blur border border-base-border rounded-card shadow-card grid grid-cols-2 divide-x divide-base-border">
          <button onClick={toggleFavorite} className="py-3 flex items-center justify-center gap-2 text-body-small font-semibold text-ink-primary active:bg-base-surface transition rounded-l-card">
            <Star size={18} className={item.is_favorite ? 'text-warning' : 'text-ink-secondary'} fill={item.is_favorite ? 'currentColor' : 'none'} />
            {item.is_favorite ? 'Favorited' : 'Favorite'}
          </button>
          <button onClick={askAi} className="py-3 flex items-center justify-center gap-2 text-body-small font-semibold text-primary active:bg-base-surface transition rounded-r-card">
            <MessageSquare size={18} /> Ask AI
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-40 left-1/2 -translate-x-1/2 z-50 bg-base-elevated border border-base-border text-ink-primary text-body-small px-md py-2.5 rounded-button shadow-card max-w-[90vw]">
          {toast}
        </div>
      )}
    </div>
  )
}
