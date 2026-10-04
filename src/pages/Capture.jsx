import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Search, Settings, Sparkles, FileText, Link2, FileUp, Mic, Clapperboard,
  RefreshCw, Inbox, Loader2,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import {
  findUrl, normalizeUrl, hostOf, detectPlatform, PLATFORM_LABEL, saveCapture, analyzeItem,
  MAX_UPLOAD_BYTES, safeFileName,
} from '../lib/capture.js'
import ItemCard from '../components/capture/ItemCard.jsx'
import CaptureSheet from '../components/capture/CaptureSheet.jsx'
import ReelSheet from '../components/capture/ReelSheet.jsx'
import SearchOverlay from '../components/capture/SearchOverlay.jsx'
import CollectionsView from '../components/capture/CollectionsView.jsx'

const PAGE_SIZE = 40

const chipClass =
  'whitespace-nowrap px-4 py-2 rounded-full border border-base-border bg-base-surface text-ink-secondary hover:text-primary hover:border-primary/50 transition duration-200 flex items-center gap-2 text-body-small font-semibold'

export default function Capture({ session }) {
  const userId = session.user.id
  const navigate = useNavigate()
  const location = useLocation()

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [tab, setTab] = useState('recent') // 'recent' | 'collections'
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [extractingIds, setExtractingIds] = useState(() => new Set())
  const [sheet, setSheet] = useState(null) // null | { mode: 'note'|'voice'|'link', initialText? } | 'reel'
  const [searchOpen, setSearchOpen] = useState(false)
  const [collectionsKey, setCollectionsKey] = useState(0)

  const fileRef = useRef(null)
  const toastTimer = useRef(null)
  const busyRef = useRef(false)
  const sharedHandled = useRef(false)

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4200)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // ---------- loading ----------
  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error, count } = await supabase
        .from('knowledge_items')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('captured_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)
      if (error) throw error
      setItems(data || [])
      setTotal(count ?? (data || []).length)
    } catch (err) {
      showToast('Could not load captures: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [userId, showToast])

  useEffect(() => { loadItems() }, [loadItems])

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const from = items.length
      const { data, error } = await supabase
        .from('knowledge_items')
        .select('*')
        .eq('user_id', userId)
        .order('captured_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id))
        return [...prev, ...(data || []).filter((i) => !seen.has(i.id))]
      })
    } catch (err) {
      showToast('Could not load more: ' + err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  // ---------- AI analysis ----------
  const runExtraction = useCallback(async (itemId) => {
    setExtractingIds((prev) => new Set(prev).add(itemId))
    try {
      const data = await analyzeItem(itemId)
      if (data?.item) setItems((prev) => prev.map((it) => (it.id === itemId ? data.item : it)))
      setCollectionsKey((k) => k + 1)
      if (data?.needs_details) {
        showToast('Saved. Not much text was shared, so open it to add details or a recording.')
      } else if (data?.collection) {
        showToast(`Filed in “${data.collection}”`)
      }
    } catch (err) {
      // Item is safely saved either way; mark it failed locally so the user can retry.
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: 'failed' } : it)))
      showToast(err.message)
    } finally {
      setExtractingIds((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }, [showToast])

  // Adds a new item to the top of the list and starts AI analysis.
  const addAndAnalyze = useCallback((item) => {
    setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)])
    setTotal((t) => t + 1)
    setTab('recent')
    runExtraction(item.id)
  }, [runExtraction])

  // ---------- capture actions ----------
  const captureLink = useCallback(async (rawUrl, extraText = '') => {
    const url = normalizeUrl(rawUrl)
    if (!url) { showToast("That doesn't look like a valid link."); return false }
    if (busyRef.current) return false
    busyRef.current = true
    setSaving(true)
    try {
      const { item, duplicate } = await saveCapture(userId, {
        sourceType: 'url',
        url,
        title: hostOf(url) || 'Saved link',
        content: extraText || url,
      })
      if (duplicate) {
        showToast('Already saved. Opening it.')
        navigate(`/capture/${item.id}`)
        return true
      }
      const label = PLATFORM_LABEL[detectPlatform(url)]
      showToast(`Saved from ${label || hostOf(url)}. Analyzing…`)
      addAndAnalyze(item)
      return true
    } catch (err) {
      showToast('Save failed: ' + err.message)
      return false
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }, [userId, navigate, addAndAnalyze, showToast])

  const captureText = useCallback(async (text, kind) => {
    if (busyRef.current) return false
    busyRef.current = true
    setSaving(true)
    try {
      const clean = text.trim()
      const firstLine = clean.split('\n')[0]
      const title = kind === 'voice'
        ? 'Voice note: ' + (firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine)
        : firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine
      const { item } = await saveCapture(userId, { sourceType: kind, title, content: clean })
      showToast('Saved. Analyzing…')
      addAndAnalyze(item)
      return true
    } catch (err) {
      showToast('Save failed: ' + err.message)
      return false
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }, [userId, addAndAnalyze, showToast])

  // Main input bar: a link (with optional note) or a quick note.
  async function handleInputCapture() {
    const value = input.trim()
    if (!value || saving) return
    // A link inside the text, or the whole input being a bare "domain.com/path".
    const strict = findUrl(value)
    const url = strict || findUrl(value, { loose: true })
    const rest = strict ? value.replace(strict, ' ').replace(/\s+/g, ' ').trim() : ''
    const ok = url && rest.length < 200 ? await captureLink(url, rest) : await captureText(value, 'note')
    if (ok) setInput('')
  }

  // "Paste URL": reads the clipboard and saves the link in one tap.
  const pasteFromClipboard = useCallback(async () => {
    setSheet(null)
    let text = ''
    try {
      if (!navigator.clipboard?.readText) throw new Error('unsupported')
      text = await navigator.clipboard.readText()
    } catch {
      // Permission denied or unsupported browser: let the user paste manually.
      setSheet({ mode: 'link' })
      return
    }
    const url = findUrl(text, { loose: true })
    if (!url) {
      showToast('No link found on your clipboard. Copy a link first, or paste one below.')
      setSheet({ mode: 'link' })
      return
    }
    const ok = await captureLink(url)
    if (!ok) setSheet({ mode: 'link' })
  }, [captureLink, showToast])

  async function handleSheetSave(payload) {
    let ok = false
    if (payload.kind === 'link') ok = await captureLink(payload.url)
    else ok = await captureText(payload.text, payload.kind)
    if (ok) setSheet(null)
  }

  // Screen-recorded reel: transcript becomes the item's content.
  async function handleRecordingSave({ text, url }) {
    try {
      const firstLine = text.split('\n')[0]
      const { item, duplicate } = await saveCapture(userId, {
        sourceType: url ? 'url' : 'video',
        url: url || null,
        platform: 'screen-recording',
        title: (url ? hostOf(url) : 'Reel') + ': ' + (firstLine.length > 50 ? firstLine.slice(0, 50) + '…' : firstLine),
        content: 'Transcript of the video:\n' + text.slice(0, 20000),
      })
      if (duplicate) {
        // Same reel saved before: enrich it with the transcript instead of creating a copy.
        const base = item.content && item.content.trim() !== item.source_url ? item.content.trim() + '\n\n' : ''
        const { data } = await supabase
          .from('knowledge_items')
          .update({ content: (base + 'Transcript of the video:\n' + text).slice(0, 20000), status: 'processing' })
          .eq('id', item.id)
          .select('*')
          .single()
        const merged = data || item
        setItems((prev) => prev.map((i) => (i.id === merged.id ? merged : i)))
        runExtraction(merged.id)
        showToast('Added the transcript to your existing save. Analyzing…')
      } else {
        showToast('Transcribed. Analyzing…')
        addAndAnalyze(item)
      }
      setSheet(null)
    } catch (err) {
      showToast('Save failed: ' + err.message)
      throw err
    }
  }

  // Upload a PDF / image to private storage + index it
  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) { showToast('That file is over 24 MB. Please choose a smaller one.'); return }
    showToast('Uploading ' + file.name + '…')
    try {
      const path = `${userId}/${Date.now()}-${safeFileName(file.name)}`
      const { error: upErr } = await supabase.storage.from('knowledge-files').upload(path, file)
      if (upErr) throw upErr
      const ext = file.name.split('.').pop().toLowerCase()
      const sourceType = ext === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? 'screenshot' : 'file'
      const { item } = await saveCapture(userId, {
        sourceType,
        title: file.name,
        content: `Uploaded ${sourceType}: ${file.name}`,
        filePath: path,
        fileType: file.type || ext,
      })
      showToast('File saved. Analyzing…')
      addAndAnalyze(item)
    } catch (err) {
      showToast('Upload failed: ' + err.message)
    }
  }

  // ---------- "Share to Nexora" (Web Share Target) ----------
  // The installed app is opened at /capture?title=…&text=…&url=… when the user shares
  // a reel/link/text to Nexora from another app.
  useEffect(() => {
    if (sharedHandled.current) return
    const p = new URLSearchParams(location.search)
    const sharedUrl = p.get('url') || ''
    const sharedText = p.get('text') || ''
    const sharedTitle = p.get('title') || ''
    if (!sharedUrl && !sharedText && !sharedTitle) return
    sharedHandled.current = true
    navigate('/capture', { replace: true }) // clean the address bar so a refresh can't re-save

    const link = findUrl(sharedUrl, { loose: true }) || findUrl(`${sharedText} ${sharedTitle}`)
    if (link) {
      const leftover = `${sharedTitle} ${sharedText}`.replace(link, '').replace(/\s+/g, ' ').trim()
      captureLink(link, leftover.length >= 15 ? leftover.slice(0, 2000) : '')
    } else {
      const text = `${sharedTitle}\n${sharedText}`.trim()
      if (text) setSheet({ mode: 'note', initialText: text.slice(0, 12000) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openItem(item) {
    setSearchOpen(false)
    navigate(`/capture/${item.id}`)
  }

  function askChat(question) {
    setSearchOpen(false)
    navigate('/ai', { state: { prefill: question } })
  }

  const hasMore = items.length < total

  return (
    <div>
      {/* Top app bar */}
      <header
        className="sticky top-0 z-40 bg-base-bg/80 backdrop-blur-xl px-md h-16 border-b border-base-border/50 flex justify-between items-center"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <h1 className="text-h2 text-ink-primary tracking-tight">Smart Capture</h1>
        <div className="flex items-center gap-md">
          <button aria-label="Search your knowledge" onClick={() => setSearchOpen(true)} className="text-ink-secondary hover:text-primary transition duration-200">
            <Search size={22} />
          </button>
          <button aria-label="Refresh" onClick={() => { loadItems(); setCollectionsKey((k) => k + 1) }} className="text-ink-secondary hover:text-primary transition duration-200">
            <RefreshCw size={20} />
          </button>
          <button aria-label="Settings" onClick={() => navigate('/settings')} className="text-ink-secondary hover:text-primary transition duration-200">
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
              onChange={(e) => setInput(e.target.value.slice(0, 12000))}
              onKeyDown={(e) => e.key === 'Enter' && handleInputCapture()}
              placeholder="Paste a URL or write a quick note…"
              className="bg-transparent border-none w-full text-body text-ink-primary placeholder:text-ink-secondary focus:outline-none focus:ring-0 px-0 py-0 h-auto"
            />
            <button aria-label="Capture with AI" onClick={handleInputCapture} disabled={saving || !input.trim()} className="ml-2 text-primary disabled:opacity-40">
              {saving ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
            </button>
          </div>
        </div>

        {/* Quick-action chips */}
        <div className="flex overflow-x-auto gap-sm pb-1 -mx-md px-md" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setSheet({ mode: 'note' })} className={chipClass}>
            <FileText size={18} /> Text Note
          </button>
          <button onClick={pasteFromClipboard} className={chipClass}>
            <Link2 size={18} /> Paste URL
          </button>
          <button onClick={() => setSheet({ mode: 'voice' })} className={chipClass}>
            <Mic size={18} /> Voice Note
          </button>
          <button onClick={() => setSheet('reel')} className={chipClass}>
            <Clapperboard size={18} /> Send Reel
          </button>
          <button onClick={() => fileRef.current?.click()} className={chipClass}>
            <FileUp size={18} /> Upload PDF
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} />

        {/* AI knowledge search (opens the full-screen search) */}
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full text-left bg-[rgb(var(--c-deep))] border-l-2 border-primary rounded-r-input flex items-center px-4 py-3 border-y-transparent border-r-transparent hover:bg-base-elevated transition"
        >
          <Search size={20} className="text-ink-secondary mr-2 shrink-0" />
          <span className="text-body-small text-ink-secondary truncate">Ask your knowledge… “best AI tools for SEO”</span>
          <Sparkles size={16} className="text-primary ml-auto shrink-0" />
        </button>

        {/* Stats line */}
        <div className="flex justify-between items-center text-caption text-ink-secondary">
          <span>{total} Capture{total === 1 ? '' : 's'} · Auto-categorized</span>
          {extractingIds.size > 0 && (
            <span className="text-primary flex items-center gap-1">
              <RefreshCw size={12} className="animate-spin" /> Analyzing {extractingIds.size}
            </span>
          )}
        </div>

        {/* Recent / Collections toggle */}
        <div className="flex bg-base-surface rounded-lg p-1 border border-base-border w-full max-w-sm mx-auto">
          {[['recent', 'Recent Activity'], ['collections', 'Smart Collections']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-1.5 rounded-md text-body-small transition duration-200 ${
                tab === key ? 'bg-primary text-base-bg font-semibold' : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'collections' ? (
          <CollectionsView userId={userId} refreshKey={collectionsKey} onOpenItem={openItem} onToast={showToast} />
        ) : loading ? (
          <div className="flex justify-center py-2xl">
            <RefreshCw size={24} className="text-primary animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="card p-lg text-center">
            <Inbox size={28} className="mx-auto text-ink-tertiary mb-sm" />
            <h3 className="text-h3 text-ink-primary mb-sm">Your knowledge base is empty</h3>
            <p className="text-body-small text-ink-secondary leading-relaxed mb-md">
              Save a reel, link, voice note or file. Nexora extracts the tips and tools, organizes them and remembers them for you.
            </p>
            <button onClick={() => setSheet('reel')} className="btn-primary h-11 inline-flex items-center gap-2">
              <Clapperboard size={16} /> Send your first reel
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                analyzing={extractingIds.has(item.id)}
                onOpen={openItem}
                onRetry={runExtraction}
              />
            ))}
            {hasMore && (
              <button onClick={loadMore} disabled={loadingMore} className="btn-secondary self-center flex items-center gap-2 disabled:opacity-60">
                {loadingMore && <Loader2 size={16} className="animate-spin" />} Load more
              </button>
            )}
          </div>
        )}
      </main>

      {/* Sheets & overlays */}
      {sheet && typeof sheet === 'object' && (
        <CaptureSheet
          key={sheet.mode + (sheet.initialText ? 'shared' : '')}
          mode={sheet.mode}
          userId={userId}
          initialText={sheet.initialText || ''}
          onClose={() => setSheet(null)}
          onSave={handleSheetSave}
        />
      )}
      {sheet === 'reel' && (
        <ReelSheet
          userId={userId}
          onClose={() => setSheet(null)}
          onPasteClipboard={pasteFromClipboard}
          onSaveRecording={handleRecordingSave}
        />
      )}
      {searchOpen && (
        <SearchOverlay items={items} onClose={() => setSearchOpen(false)} onOpenItem={openItem} onAskChat={askChat} />
      )}

      {/* Toast */}
      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-base-elevated border border-base-border text-ink-primary text-body-small px-md py-2.5 rounded-button shadow-card max-w-[92vw] text-center">
          {toast}
        </div>
      )}
    </div>
  )
}
