import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Star, Trash2, ExternalLink, Lightbulb, CheckSquare, Square, Folder, FolderPlus, Sparkles,
  RefreshCw, Loader2, PencilLine, Video, Pencil, Check, X, MessageSquare, AlertTriangle, Link2,
  ShieldCheck, ChevronDown, ChevronUp, Undo2, RotateCcw, FileText,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import {
  analyzeItem, safeHref, hostOf, PLATFORM_LABEL, transcribeMediaFile, asList, insightsOf, editInsights,
  patchItem, fetchTagVocabulary, UNDERSTANDING_SOURCE,
} from '../lib/capture.js'
import { catStyle, timeAgo, SOURCE_ICON } from '../components/capture/ItemCard.jsx'
import EditableList from '../components/capture/EditableList.jsx'
import TagEditor from '../components/capture/TagEditor.jsx'
import ToolsEditor from '../components/capture/ToolsEditor.jsx'
import CollectionPicker from '../components/capture/CollectionPicker.jsx'

function SectionTitle({ children, edited }) {
  return (
    <h2 className="text-h3 text-ink-primary mb-sm flex items-center gap-2">
      {children}
      {edited && <span className="text-[10px] font-semibold text-primary border border-primary/30 bg-primary/10 rounded px-1.5 py-0.5">Edited by you</span>}
    </h2>
  )
}

// One piece of text (summary, takeaway…). Read-only normally; editable in edit mode. May be cleared.
function InlineText({ value, editing, onSave, placeholder, empty, maxLen = 700, rows = 3, className = '' }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  if (!editing) return value ? <p className={className}>{value}</p> : null

  async function save() {
    setBusy(true)
    try { await onSave(draft.trim().slice(0, maxLen)); setOpen(false) } catch { /* parent shows the error */ } finally { setBusy(false) }
  }

  if (open) {
    return (
      <div className="flex flex-col gap-sm">
        <textarea
          autoFocus
          value={draft}
          rows={rows}
          disabled={busy}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value.slice(0, maxLen))}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save() }}
          className="input resize-none text-body-small"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption text-ink-tertiary">{draft.length}/{maxLen}</span>
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} disabled={busy} className="btn-secondary !py-1.5 !px-3 text-body-small flex items-center gap-1"><X size={14} /> Cancel</button>
            <button onClick={save} disabled={busy} className="btn-primary !py-1.5 !px-3 text-body-small flex items-center gap-1 disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
            </button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-1">
      <p className={`${className} flex-1`}>{value || <span className="text-ink-tertiary italic">{empty}</span>}</p>
      <button aria-label="Edit" onClick={() => { setDraft(value || ''); setOpen(true) }} className="text-ink-tertiary hover:text-primary p-1.5 shrink-0"><Pencil size={15} /></button>
    </div>
  )
}

function UnderstandingPill({ level, source }) {
  const from = UNDERSTANDING_SOURCE[source]
  const cfg = level === 'full'
    ? { cls: 'text-success border-success/30 bg-success/10', text: `Fully understood${from ? ` from ${from}` : ''}` }
    : level === 'partial'
      ? { cls: 'text-warning border-warning/30 bg-warning/10', text: `Partly understood${from ? ` from ${from}` : ''}` }
      : { cls: 'text-warning border-warning/30 bg-warning/10', text: 'Not enough to go on yet' }
  return <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold border rounded-full px-2.5 py-1 ${cfg.cls}`}><Sparkles size={12} /> {cfg.text}</span>
}

export default function KnowledgeDetail({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const userId = session.user.id

  const [item, setItem] = useState(null)
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [toast, setToast] = useState(null) // { msg, undo }
  const [analyzing, setAnalyzing] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [details, setDetails] = useState('')
  const [detailsBusy, setDetailsBusy] = useState('') // '' | 'saving' | 'transcribing'
  const [thumbOk, setThumbOk] = useState(true)
  const [editing, setEditing] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [vocab, setVocab] = useState({ tags: [], categories: [] })
  const [categoryDraft, setCategoryDraft] = useState('')
  const [sourceOpen, setSourceOpen] = useState(false)
  const [sourceDraft, setSourceDraft] = useState(null) // null = not editing the source text
  const [sourceBusy, setSourceBusy] = useState('') // '' | 'save' | 'reanalyze'
  const toastTimer = useRef(null)
  const fileRef = useRef(null)
  const vocabLoaded = useRef(false)
  const itemRef = useRef(null)
  itemRef.current = item

  const showToast = useCallback((msg, undo = null) => {
    setToast({ msg, undo })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), undo ? 7000 : 3500)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const loadCollections = useCallback(async (itemId) => {
    const { data: links } = await supabase.from('collection_items').select('collection_id').eq('item_id', itemId)
    const colIds = (links || []).map((l) => l.collection_id)
    if (!colIds.length) { setCollections([]); return }
    const { data: cols } = await supabase.from('collections').select('id, name').in('id', colIds)
    setCollections(cols || [])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('knowledge_items').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
      if (error) throw error
      if (!data) { setNotFound(true); return }
      setItem(data)
      setTitleDraft(data.title || '')
      await loadCollections(id)
    } catch (err) {
      showToast('Could not load this item: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [id, userId, showToast, loadCollections])

  useEffect(() => { load() }, [load])

  // Tag + category suggestions are only needed once the user starts editing.
  useEffect(() => {
    if (!editing || vocabLoaded.current) return
    vocabLoaded.current = true
    fetchTagVocabulary(userId).then(setVocab).catch(() => { vocabLoaded.current = false })
  }, [editing, userId])

  useEffect(() => { setCategoryDraft(item?.category || '') }, [item?.category])

  async function patch(fields) {
    const data = await patchItem(itemRef.current.id, fields)
    itemRef.current = data // update now, not on the next render, so a fast follow-up edit never reads stale data
    setItem(data)
    return data
  }

  async function undoPatch(fields) {
    try { await patch(fields); showToast('Restored.') } catch (err) { showToast('Could not undo: ' + err.message) }
  }

  // Saves a change inside the insights JSON, marks that part "edited by you" (the AI will never
  // overwrite it) and offers Undo after a deletion. Throws on failure so editors stay open.
  async function saveInsights(changes, lockKey, meta) {
    const prev = itemRef.current.insights
    try {
      await patch({ insights: editInsights(prev, changes, lockKey) })
      if (meta?.kind === 'delete') showToast('Removed.', () => undoPatch({ insights: prev }))
    } catch (err) {
      showToast('Could not save: ' + err.message)
      throw err
    }
  }

  // Same, for real columns (title, summary, category, tags, links).
  async function saveColumn(fields, lockKey, meta) {
    const cur = itemRef.current
    const prev = { insights: cur.insights }
    for (const k of Object.keys(fields)) prev[k] = cur[k]
    try {
      await patch({ ...fields, insights: editInsights(cur.insights, {}, lockKey) })
      if (meta?.kind === 'delete') showToast('Removed.', () => undoPatch(prev))
    } catch (err) {
      showToast('Could not save: ' + err.message)
      throw err
    }
  }

  const commitInsights = (next, meta) => saveInsights({ key_insights: next }, 'insights', meta)
  const commitSteps = (next, meta) => saveInsights({ steps: next }, 'steps', meta)
  const commitTools = (next, meta) => saveInsights({ tools_mentioned: next }, 'tools', meta)
  const commitActions = (next, meta) => {
    // "Done" ticks follow the action's text, so keep them in step with edits and deletions.
    let done = asList(insightsOf(itemRef.current).done_actions)
    if (meta.kind === 'edit') done = done.map((d) => (d === meta.prev ? next[meta.index] : d))
    if (meta.kind === 'delete') done = done.filter((d) => d !== meta.prev)
    return saveInsights({ actionable_items: next, done_actions: done }, 'actions', meta)
  }
  const commitTags = (next, meta) => saveColumn({ tags: next }, 'tags', meta)
  const commitSummary = (text) => saveColumn({ summary: text }, 'summary')
  const commitTldr = (text) => saveInsights({ tldr: text }, 'tldr')
  const commitWhy = (text) => saveInsights({ why_it_matters: text }, 'why_it_matters')
  const removeLink = (l) => saveColumn({ extracted_links: asList(itemRef.current.extracted_links).filter((x) => x !== l) }, 'links', { kind: 'delete' })

  async function commitCategory() {
    const c = categoryDraft.trim().slice(0, 40)
    if (!c) { setCategoryDraft(item.category || ''); return }
    if (c === item.category) return
    try { await saveColumn({ category: c }, 'category') } catch { setCategoryDraft(item.category || '') }
  }

  async function toggleFavorite() {
    try { await patch({ is_favorite: !item.is_favorite }) } catch (err) { showToast('Could not update: ' + err.message) }
  }

  async function saveTitle() {
    const t = titleDraft.trim().slice(0, 120)
    if (!t) { setEditingTitle(false); setTitleDraft(item.title || ''); return }
    if (t === item.title) { setEditingTitle(false); return }
    try { await saveColumn({ title: t }, 'title'); setEditingTitle(false) } catch { /* toast already shown */ }
  }

  async function toggleAction(text) {
    const ins = insightsOf(item)
    const done = new Set(asList(ins.done_actions))
    if (done.has(text)) done.delete(text); else done.add(text)
    try { await patch({ insights: { ...ins, done_actions: [...done] } }) } catch (err) { showToast('Could not update: ' + err.message) }
  }

  async function onFoldersChanged(ids, all) {
    const picked = (all || []).filter((c) => ids.includes(c.id)).map((c) => ({ id: c.id, name: c.name }))
    setCollections(picked)
    // Once the user files this item by hand, the AI stops re-filing it.
    if (!insightsOf(itemRef.current).locked?.collections) {
      try { await patch({ insights: editInsights(itemRef.current.insights, {}, 'collections') }) } catch { /* not critical */ }
    }
  }

  async function reanalyze() {
    if (analyzing) return false
    const hadEdits = Object.values(insightsOf(itemRef.current).locked || {}).some(Boolean)
    setAnalyzing(true)
    try {
      const data = await analyzeItem(itemRef.current.id)
      if (data?.item) { itemRef.current = data.item; setItem(data.item) }
      showToast(data?.needs_details ? 'Not enough text to analyze. Add details below.' : hadEdits ? 'Analysis updated. Your edits were kept.' : 'Analysis updated.')
      await loadCollections(itemRef.current.id)
      return true
    } catch (err) {
      showToast(err.message)
      return false
    } finally {
      setAnalyzing(false)
    }
  }

  async function resetEdits() {
    if (!window.confirm('Let the AI redo everything for this item? Your manual edits will be replaced.')) return
    try {
      await patch({ insights: { ...insightsOf(itemRef.current), locked: {} } })
      await reanalyze()
    } catch (err) {
      showToast('Could not reset: ' + err.message)
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
      if (!text) throw new Error("We couldn't hear any speech in that recording. Reels with only music can't be transcribed.")
      const base = item.content && item.content.trim() !== item.source_url ? item.content.trim() + '\n\n' : ''
      await patch({ content: (base + 'Transcript of the video:\n' + text).slice(0, 20000) })
      await reanalyze()
    } catch (err) {
      showToast(err.message)
    } finally {
      setDetailsBusy('')
    }
  }

  // Edit the raw text (transcript / notes) the AI works from, e.g. to fix a misheard tool name.
  async function saveSource(thenReanalyze) {
    if (sourceDraft === null || sourceBusy) return
    setSourceBusy(thenReanalyze ? 'reanalyze' : 'save')
    try {
      await patch({ content: sourceDraft.trim().slice(0, 20000) })
      setSourceDraft(null)
      if (thenReanalyze) await reanalyze(); else showToast('Saved.')
    } catch (err) {
      showToast('Could not save: ' + err.message)
    } finally {
      setSourceBusy('')
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

  const ins = insightsOf(item)
  const locked = ins.locked && typeof ins.locked === 'object' ? ins.locked : {}
  const hasLocks = Object.values(locked).some(Boolean)
  const insights = asList(ins.key_insights)
  const steps = asList(ins.steps)
  const actions = asList(ins.actionable_items)
  const done = new Set(asList(ins.done_actions))
  const tools = (Array.isArray(ins.tools_mentioned) ? ins.tools_mentioned : []).filter((t) => t && t.name)
  const links = asList(item.extracted_links).filter((l) => safeHref(l))
  const tags = asList(item.tags)
  const sourceHref = safeHref(item.source_url)
  const meta = item.source_meta && typeof item.source_meta === 'object' ? item.source_meta : {}
  const thumb = safeHref(meta.thumbnail)
  const platform = item.source_platform ? PLATFORM_LABEL[item.source_platform] || item.source_platform : null
  const SourceIcon = SOURCE_ICON[item.source_type] || Link2
  const needsDetails = item.status === 'needs_details'
  const failed = item.status === 'failed'
  const understanding = ins.understanding && typeof ins.understanding === 'object' ? ins.understanding : null
  const level = understanding?.level || (needsDetails ? 'minimal' : null)
  const showBoost = !analyzing && !!level && level !== 'full' && (needsDetails || !!item.source_url)
  const isSocial = ['instagram', 'tiktok', 'facebook'].includes(item.source_platform)
  const ytNoCaptions = item.source_platform === 'youtube' && understanding?.transcript_status === 'unavailable'
  const sourceText = item.content && item.content.trim() !== item.source_url ? item.content.trim() : ''
  const sourceHasTranscript = /Transcript of the video/i.test(sourceText)

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
          {!analyzing && (
            <button
              onClick={() => setEditing((e) => !e)}
              aria-pressed={editing}
              className={`flex items-center gap-1.5 text-body-small font-semibold px-3 py-1.5 rounded-button border transition ${editing ? 'bg-primary text-base-bg border-primary' : 'text-ink-secondary border-base-border hover:text-primary hover:border-primary/50'}`}
            >
              {editing ? <><Check size={16} /> Done</> : <><Pencil size={15} /> Edit</>}
            </button>
          )}
          <button aria-label={item.is_favorite ? 'Remove favorite' : 'Add favorite'} onClick={toggleFavorite} className={`transition ${item.is_favorite ? 'text-warning' : 'text-ink-secondary hover:text-warning'}`}>
            <Star size={22} fill={item.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <button aria-label="Delete" onClick={remove} className="text-ink-secondary hover:text-error transition">
            <Trash2 size={21} />
          </button>
        </div>
      </header>

      <main className="px-md pt-md flex flex-col gap-lg">
        {editing && (
          <div className="bg-primary/10 border border-primary/20 rounded-card p-md flex items-start gap-3">
            <ShieldCheck size={18} className="text-primary mt-0.5 shrink-0" />
            <p className="text-body-small text-ink-primary">
              You're editing. Every change saves instantly, and the AI will never overwrite what you change, even when you re-analyze.
            </p>
          </div>
        )}

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
            {editing ? (
              <>
                <input
                  list="nx-categories"
                  value={categoryDraft}
                  onChange={(e) => setCategoryDraft(e.target.value.slice(0, 40))}
                  onBlur={commitCategory}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  aria-label="Category"
                  placeholder="Category"
                  className="input !py-1 !px-2 text-[11px] w-44"
                />
                <datalist id="nx-categories">{vocab.categories.map((c) => <option key={c} value={c} />)}</datalist>
              </>
            ) : (
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${catStyle(item.category)}`}>{item.category || 'Uncategorized'}</span>
            )}
            {collections.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 text-[11px] text-ink-secondary border border-base-border rounded px-2 py-0.5">
                <Folder size={11} /> {c.name}
              </span>
            ))}
            {editing && (
              <button onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary border border-primary/40 rounded px-2 py-0.5 hover:bg-primary/10 transition">
                <FolderPlus size={12} /> Folders
              </button>
            )}
          </div>

          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value.slice(0, 120))}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(item.title || '') } }}
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
          {level && !analyzing && !failed && (
            <div className="mt-3"><UnderstandingPill level={level} source={understanding?.source} /></div>
          )}
        </section>

        {analyzing && (
          <div className="bg-primary/10 border border-primary/20 rounded-card p-md flex items-center gap-3">
            <RefreshCw size={18} className="text-primary animate-spin shrink-0" />
            <p className="text-body-small text-ink-primary">Reading and analyzing with AI…</p>
          </div>
        )}

        {failed && !analyzing && (
          <div className="bg-error/10 border border-error/20 rounded-card p-md flex items-center justify-between gap-3">
            <p className="text-body-small text-error flex items-center gap-2"><AlertTriangle size={16} className="shrink-0" /> The AI analysis didn't finish.</p>
            <button onClick={reanalyze} className="text-body-small font-semibold text-primary shrink-0">Try again</button>
          </div>
        )}

        {/* TL;DR + summary */}
        {(item.summary || ins.tldr || ins.why_it_matters || editing) && (
          <section className="card p-md flex flex-col gap-sm">
            <SectionTitle edited={locked.summary || locked.tldr}>Summary</SectionTitle>
            {(ins.tldr || editing) && (
              <InlineText
                value={ins.tldr}
                editing={editing}
                onSave={commitTldr}
                maxLen={160}
                rows={2}
                placeholder="One-line takeaway"
                empty="Add a one-line takeaway"
                className="text-body font-semibold text-primary leading-snug"
              />
            )}
            <InlineText
              value={item.summary}
              editing={editing}
              onSave={commitSummary}
              maxLen={900}
              rows={5}
              placeholder="Write your own summary"
              empty="Add a summary"
              className="text-body text-ink-primary leading-relaxed"
            />
            {(ins.why_it_matters || editing) && (
              <div className="border-t border-base-border/60 pt-sm">
                <p className="text-caption font-semibold text-ink-secondary uppercase tracking-wider mb-1">Why it matters</p>
                <InlineText
                  value={ins.why_it_matters}
                  editing={editing}
                  onSave={commitWhy}
                  maxLen={220}
                  rows={2}
                  placeholder="How could you use this?"
                  empty="Add why this matters to you"
                  className="text-body-small text-ink-secondary leading-relaxed"
                />
              </div>
            )}
          </section>
        )}

        {/* Boost understanding: reels and sparse pages */}
        {showBoost && (
          <section className="bg-warning/10 border border-warning/30 rounded-card p-md">
            <h2 className="text-body font-semibold text-ink-primary flex items-center gap-2 mb-1">
              <PencilLine size={18} className="text-warning" /> Help Nexora understand this better
            </h2>
            <p className="text-body-small text-ink-secondary mb-3">
              {ytNoCaptions
                ? "YouTube didn't share captions for this video, so Nexora only has the description."
                : isSocial
                  ? `${platform} keeps reel audio and on-screen text private, so Nexora only saw the caption.`
                  : `${platform || 'This site'} shared very little text with us.`}
              {' '}For the full tips and tools, screen-record the video <b>with sound on</b> (swipe down on your phone and tap Screen Record) and upload it here. Nexora transcribes it. Or just type what you remember.
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

        {(insights.length > 0 || editing) && (
          <section>
            <SectionTitle edited={locked.insights}>Key insights</SectionTitle>
            <div className="flex flex-col gap-sm">
              <EditableList
                items={insights}
                editing={editing}
                onCommit={commitInsights}
                max={12}
                rows={3}
                placeholder="A tip, fact or idea worth keeping"
                addLabel="Add an insight"
                renderView={(t) => (
                  <div className="bg-primary/5 border border-primary/20 rounded-card p-md flex items-start gap-3">
                    <Lightbulb size={18} className="text-primary mt-0.5 shrink-0" />
                    <p className="text-body-small text-ink-primary leading-relaxed">{t}</p>
                  </div>
                )}
              />
            </div>
          </section>
        )}

        {(steps.length > 0 || editing) && (
          <section>
            <SectionTitle edited={locked.steps}>Step by step</SectionTitle>
            <div className="flex flex-col gap-sm">
              <EditableList
                items={steps}
                editing={editing}
                onCommit={commitSteps}
                max={15}
                placeholder="One step"
                addLabel="Add a step"
                renderView={(t, i) => (
                  <div className="bg-base-surface border border-base-border rounded-card p-md flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-caption font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                    <p className="text-body-small text-ink-primary leading-relaxed">{t}</p>
                  </div>
                )}
              />
            </div>
          </section>
        )}

        {(actions.length > 0 || editing) && (
          <section>
            <SectionTitle edited={locked.actions}>Actionable items</SectionTitle>
            {editing ? (
              <EditableList
                items={actions}
                editing
                onCommit={commitActions}
                max={10}
                placeholder="Something you will do"
                addLabel="Add an action"
                renderView={() => null}
              />
            ) : (
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
            )}
          </section>
        )}

        {(tools.length > 0 || editing) && (
          <section>
            <SectionTitle edited={locked.tools}>Tools mentioned</SectionTitle>
            <div className="flex flex-col gap-sm">
              <ToolsEditor tools={tools} editing={editing} onCommit={commitTools} />
            </div>
          </section>
        )}

        {links.length > 0 && (
          <section>
            <SectionTitle edited={locked.links}>Related links</SectionTitle>
            <div className="flex flex-col gap-sm">
              {links.map((l) => (
                <div key={l} className="flex items-center gap-2">
                  <a href={l} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-body-small text-primary flex items-center gap-2 hover:underline break-all">
                    <ExternalLink size={14} className="shrink-0" /> {hostOf(l)}<span className="text-ink-tertiary truncate">{new URL(l).pathname.slice(0, 40)}</span>
                  </a>
                  {editing && (
                    <button aria-label="Remove link" onClick={() => removeLink(l).catch(() => {})} className="text-ink-tertiary hover:text-error p-1.5 shrink-0"><Trash2 size={15} /></button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {(tags.length > 0 || editing) && (
          <section>
            {editing && <SectionTitle edited={locked.tags}>Tags</SectionTitle>}
            {editing ? (
              <TagEditor tags={tags} suggestions={vocab.tags} onChange={commitTags} />
            ) : (
              <div className="flex flex-wrap gap-2">{tags.map((t) => <span key={t} className="chip">#{t}</span>)}</div>
            )}
          </section>
        )}

        {/* The raw text the AI worked from. Fix mistakes here, then re-analyze. */}
        {(sourceText || editing) && (
          <section className="card">
            <button onClick={() => setSourceOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 p-md text-left" aria-expanded={sourceOpen}>
              <span className="flex items-center gap-2 text-body-small font-semibold text-ink-primary">
                <FileText size={16} className="text-ink-secondary" /> {sourceHasTranscript ? 'Transcript & notes' : 'Original text'}
              </span>
              {sourceOpen ? <ChevronUp size={18} className="text-ink-tertiary" /> : <ChevronDown size={18} className="text-ink-tertiary" />}
            </button>
            {sourceOpen && (
              <div className="px-md pb-md flex flex-col gap-sm">
                {sourceDraft !== null ? (
                  <>
                    <textarea
                      value={sourceDraft}
                      onChange={(e) => setSourceDraft(e.target.value.slice(0, 20000))}
                      rows={10}
                      disabled={!!sourceBusy}
                      className="input resize-y text-body-small"
                    />
                    <p className="text-caption text-ink-tertiary">Speech-to-text can misspell names. Fix them here, then re-analyze. {sourceDraft.length}/20000</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => saveSource(true)} disabled={!!sourceBusy} className="btn-primary !py-2 !px-3 text-body-small flex items-center gap-1.5 disabled:opacity-50">
                        {sourceBusy === 'reanalyze' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Save &amp; re-analyze
                      </button>
                      <button onClick={() => saveSource(false)} disabled={!!sourceBusy} className="btn-secondary !py-2 !px-3 text-body-small">Save only</button>
                      <button onClick={() => setSourceDraft(null)} disabled={!!sourceBusy} className="btn-secondary !py-2 !px-3 text-body-small">Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    {sourceText ? (
                      <pre className="whitespace-pre-wrap break-words font-sans text-body-small text-ink-secondary max-h-72 overflow-y-auto leading-relaxed">{sourceText}</pre>
                    ) : (
                      <p className="text-body-small text-ink-tertiary">Nothing stored yet.</p>
                    )}
                    {editing && (
                      <button onClick={() => setSourceDraft(sourceText)} className="self-start text-body-small font-semibold text-primary flex items-center gap-1.5">
                        <Pencil size={14} /> Edit text
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {!analyzing && (
          <div className="flex flex-col items-start gap-2">
            <button onClick={reanalyze} className="text-caption text-ink-tertiary hover:text-primary transition flex items-center gap-1.5">
              <RefreshCw size={13} /> Re-analyze with AI{hasLocks ? ' (keeps your edits)' : ''}
            </button>
            {hasLocks && (
              <button onClick={resetEdits} className="text-caption text-ink-tertiary hover:text-error transition flex items-center gap-1.5">
                <RotateCcw size={13} /> Discard my edits and let the AI redo everything
              </button>
            )}
          </div>
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

      {pickerOpen && (
        <CollectionPicker
          userId={userId}
          itemId={item.id}
          memberIds={collections.map((c) => c.id)}
          onChanged={onFoldersChanged}
          onClose={() => setPickerOpen(false)}
          onToast={showToast}
        />
      )}

      {toast && (
        <div className="fixed bottom-40 left-1/2 -translate-x-1/2 z-[70] bg-base-elevated border border-base-border text-ink-primary text-body-small pl-md pr-sm py-2 rounded-button shadow-card max-w-[90vw] flex items-center gap-3">
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              onClick={() => { const u = toast.undo; setToast(null); u() }}
              className="flex items-center gap-1 font-semibold text-primary px-2 py-1 rounded hover:bg-primary/10"
            >
              <Undo2 size={14} /> Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
