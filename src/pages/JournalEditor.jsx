import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Folder, Lock, LockOpen, Sparkles, Tag, Trash2, FileText, Loader2, X, Wand2, MoreVertical } from 'lucide-react'
import { useJournal } from '../lib/journal/context.jsx'
import { createEntry, updateEntry, fetchEntry, deleteEntries, explain } from '../lib/journal/data.js'
import { requestUnlock, encryptEntry, decryptEntry, touch } from '../lib/journal/vault.js'
import { aiPrompts, aiSuggest } from '../lib/journal/ai.js'
import { FREE, MAX_CHARS, MAX_PRIVATE_CHARS, MAX_TAGS_PER_ENTRY, MOODS, TEMPLATES, normalizeTag, randomPrompt } from '../lib/journal/constants.js'
import { countWords, longDate, readMinutes, todayLocal } from '../lib/journal/dates.js'
import { ActionSheet, ConfirmSheet, ProBadge, TagChip, useToast } from '../components/journal/ui.jsx'
import FolderPicker from '../components/journal/FolderPicker.jsx'
import FolderManager from '../components/journal/FolderManager.jsx'
import TagManager from '../components/journal/TagManager.jsx'
import TemplateSheet from '../components/journal/TemplateSheet.jsx'

const draftKey = (uid, id) => `nexora_journal_draft_v1:${uid}:${id || 'new'}`

export default function JournalEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { userId, isPro, folders, folderById, tags: tagStats, tagColor, overview, touchData, openUpgrade } = useJournal()
  const { toast, show } = useToast()

  const [ready, setReady] = useState(!id)
  const [loadError, setLoadError] = useState('')
  const [original, setOriginal] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState(null)
  const [tags, setTags] = useState([])
  const [tagDraft, setTagDraft] = useState('')
  const [folderId, setFolderId] = useState(params.get('folder') || null)
  const [entryDate, setEntryDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : todayLocal())
  const [isPrivate, setIsPrivate] = useState(false)
  const [aiPrompt, setAiPrompt] = useState(params.get('prompt') || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(null) // folder | folders | tags | templates | menu | discard | delete
  const [draftOffer, setDraftOffer] = useState(null)
  const [smart, setSmart] = useState({ busy: false, tags: [], mood: null })
  const [promptBusy, setPromptBusy] = useState(false)
  const baseline = useRef('')
  const taRef = useRef(null)
  const saved = useRef(false)

  const snapshot = useCallback(() => JSON.stringify({ title, content, mood, tags, folderId, entryDate, isPrivate }), [title, content, mood, tags, folderId, entryDate, isPrivate])
  const dirty = ready && snapshot() !== baseline.current && !saved.current

  // ---------------------------------------------------------------- load / initialise
  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!id) {
        let t = '', c = '', tg = []
        const tpl = TEMPLATES.find((x) => x.id === params.get('template'))
        if (tpl && (!tpl.pro || isPro)) { t = tpl.title; c = tpl.body; tg = tpl.tags }
        const f = params.get('folder') && folderById.get(params.get('folder'))
        const priv = !!f?.is_private
        if (!cancelled) {
          setTitle(t); setContent(c); setTags(tg); setIsPrivate(priv)
          baseline.current = JSON.stringify({ title: t, content: c, mood: null, tags: tg, folderId: params.get('folder') || null, entryDate, isPrivate: priv })
          // offer a crashed/abandoned draft
          try {
            const d = JSON.parse(localStorage.getItem(draftKey(userId, null)) || 'null')
            if (d && (d.content || d.title) && !tpl) setDraftOffer(d)
          } catch { /* ignore */ }
          setReady(true)
        }
        return
      }
      try {
        const e = await fetchEntry(id)
        if (!e) throw new Error('This entry no longer exists.')
        let t = e.title || '', c = e.content
        if (e.is_locked) {
          const ok = await requestUnlock('Unlock to edit this private entry.')
          if (!ok) { if (!cancelled) navigate(`/journal/${id}`, { replace: true }); return }
          const d = await decryptEntry(e.content)
          t = d.title; c = d.content
        }
        if (cancelled) return
        setOriginal(e); setTitle(t); setContent(c); setMood(e.mood); setTags(e.tags || []); setFolderId(e.folder_id)
        setEntryDate(e.entry_date); setIsPrivate(!!e.is_locked); setAiPrompt(e.ai_prompt_used || '')
        baseline.current = JSON.stringify({ title: t, content: c, mood: e.mood, tags: e.tags || [], folderId: e.folder_id, entryDate: e.entry_date, isPrivate: !!e.is_locked })
        if (!e.is_locked) {
          try {
            const d = JSON.parse(localStorage.getItem(draftKey(userId, id)) || 'null')
            if (d && d.at > new Date(e.updated_at).getTime() && (d.content !== c || d.title !== t)) setDraftOffer(d)
          } catch { /* ignore */ }
        }
        setReady(true)
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Could not open this entry.')
      }
    }
    init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // auto-grow textarea
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 220)}px`
  }, [content, ready])

  // local draft (never for private entries — plaintext must not touch localStorage)
  useEffect(() => {
    if (!ready || isPrivate || !dirty) return undefined
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey(userId, id), JSON.stringify({ title, content, mood, tags, folderId, entryDate, at: Date.now() })) } catch { /* storage full */ }
    }, 700)
    return () => clearTimeout(t)
  }, [ready, isPrivate, dirty, title, content, mood, tags, folderId, entryDate, userId, id])

  // keep the vault awake while writing a private entry
  useEffect(() => { if (isPrivate && content) touch() }, [isPrivate, content])

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // ---------------------------------------------------------------- helpers
  const words = useMemo(() => countWords(content), [content])
  const limit = isPrivate ? MAX_PRIVATE_CHARS : MAX_CHARS
  const over = title.length + content.length > limit

  const localSuggestions = useMemo(() => {
    const text = `${title} ${content}`.toLowerCase()
    if (text.trim().length < 12) return []
    return tagStats.filter((t) => !tags.includes(t.tag) && new RegExp(`(^|[^\\p{L}\\p{N}])${t.tag.replace(/[-]/g, '[- ]')}`, 'u').test(text)).slice(0, 5).map((t) => t.tag)
  }, [title, content, tagStats, tags])

  const tagMatches = useMemo(() => {
    const q = normalizeTag(tagDraft)
    if (!q) return []
    return tagStats.filter((t) => t.tag.includes(q) && !tags.includes(t.tag)).slice(0, 5).map((t) => t.tag)
  }, [tagDraft, tagStats, tags])

  const addTag = (raw) => {
    const t = normalizeTag(raw)
    if (!t) return
    if (tags.length >= MAX_TAGS_PER_ENTRY) return show(`Up to ${MAX_TAGS_PER_ENTRY} tags per entry`)
    if (!tags.includes(t)) setTags((p) => [...p, t])
    setTagDraft('')
  }

  async function setPrivate(on) {
    if (!on) { setIsPrivate(false); return }
    if (!isPro && !original?.is_locked && (overview?.locked || 0) >= FREE.privateEntries) return openUpgrade('private')
    if (!(await requestUnlock('Unlock to write a private entry.'))) return
    setIsPrivate(true)
  }

  async function chooseFolder(fid) {
    setFolderId(fid)
    if (fid && folderById.get(fid)?.is_private && !isPrivate) await setPrivate(true)
  }

  async function suggestTopic() {
    if (promptBusy) return
    setPromptBusy(true)
    try {
      const r = await aiPrompts()
      setAiPrompt(r.prompts[0].text)
      show('Prompt added — tap ✨ again for another', null, 2500)
    } catch (e) {
      setAiPrompt(randomPrompt(aiPrompt))
      if (e.code === 'daily_limit') show("Today's free AI prompts are used — here's one from the library.", { label: 'More', onClick: () => openUpgrade('prompts') })
    } finally { setPromptBusy(false) }
  }

  async function runSmartTags() {
    if (!isPro) return openUpgrade('smart_tags')
    if (content.trim().length < 20) return show('Write a little more first.')
    setSmart((s) => ({ ...s, busy: true }))
    try {
      const r = await aiSuggest(content.slice(0, 4000), tagStats.map((t) => t.tag).slice(0, 60))
      setSmart({ busy: false, tags: r.tags.filter((t) => !tags.includes(t)), mood: r.mood && r.mood !== mood ? r.mood : null })
    } catch (e) { setSmart({ busy: false, tags: [], mood: null }); show(e.message) }
  }

  function applyTemplate(t) {
    setTitle(t.title); setContent(t.body)
    setTags((prev) => [...new Set([...prev, ...t.tags])])
    requestAnimationFrame(() => taRef.current?.focus())
  }

  // ---------------------------------------------------------------- save / delete
  async function save() {
    if (saving) return
    if (!content.trim()) return setError('Write something first.')
    if (over) return setError(`That’s over the ${limit.toLocaleString()} character limit${isPrivate ? ' for private entries' : ''}.`)
    setError('')
    if (isPrivate && !(await requestUnlock('Unlock to save this private entry.'))) return
    setSaving(true)
    try {
      const base = { mood, tags, folder_id: folderId, entry_date: entryDate, ai_prompt_used: aiPrompt || null, is_locked: isPrivate, category: original?.category || 'general' }
      const payload = isPrivate
        ? { ...base, title: null, content: await encryptEntry({ title: title.trim(), content: content.trim() }) }
        : { ...base, title: title.trim() || null, content: content.trim() }
      const row = id ? await updateEntry(id, payload) : await createEntry({ user_id: userId, ...payload })
      saved.current = true
      try { localStorage.removeItem(draftKey(userId, id)) } catch { /* ignore */ }
      await touchData(['overview', 'tags', 'folders'])
      navigate(`/journal/${row.id}`, { replace: true })
    } catch (e) {
      const x = explain(e)
      if (x.code === 'limit_private') { setIsPrivate(false); openUpgrade('private'); setError('Free plan includes 5 private entries — turn privacy off to save this entry normally, or upgrade.') }
      else setError(x.message)
    } finally { setSaving(false) }
  }

  async function remove() {
    try {
      await deleteEntries([id])
      saved.current = true
      try { localStorage.removeItem(draftKey(userId, id)) } catch { /* ignore */ }
      await touchData(['overview', 'tags', 'folders'])
      navigate('/journal', { replace: true })
    } catch (e) { show('Could not delete: ' + e.message) }
  }

  const leave = () => navigate(id ? `/journal/${id}` : '/journal', { replace: true })
  const back = () => (dirty ? setSheet('discard') : leave())

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---------------------------------------------------------------- render
  const folder = folderId ? folderById.get(folderId) : null
  const privateCount = overview?.locked || 0

  if (loadError) {
    return (
      <div className="fixed inset-0 z-[60] bg-base-bg flex items-center justify-center p-md">
        <div className="card p-lg text-center max-w-sm"><p className="text-body text-ink-primary mb-md">{loadError}</p><button className="btn-primary px-lg py-3" onClick={() => navigate('/journal', { replace: true })}>Back to journal</button></div>
      </div>
    )
  }
  if (!ready) {
    return <div className="fixed inset-0 z-[60] bg-base-bg flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="fixed inset-0 z-[60] bg-base-bg flex flex-col animate-fade-in">
      <div className="w-full max-w-md lg:max-w-3xl mx-auto flex flex-col h-full">
        <header className="shrink-0 flex items-center gap-sm px-md h-16" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <button aria-label="Back" onClick={back} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-base-elevated transition"><ArrowLeft size={22} /></button>
          <div className="flex-1 min-w-0">
            <h1 className="text-body font-semibold text-ink-primary truncate">{id ? 'Edit entry' : 'New entry'}</h1>
            <p className="text-caption text-ink-tertiary flex items-center gap-1">{isPrivate && <Lock size={11} className="text-primary" />}{dirty ? 'Unsaved changes' : id ? 'All changes saved' : 'Draft'}</p>
          </div>
          {id && <button aria-label="More" onClick={() => setSheet('menu')} className="w-10 h-10 rounded-full flex items-center justify-center text-ink-secondary hover:bg-base-elevated"><MoreVertical size={20} /></button>}
          <button onClick={save} disabled={saving || !content.trim()} className="btn-primary !normal-case !tracking-normal px-lg py-2 disabled:opacity-50 flex items-center gap-1.5">{saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Saving' : 'Save'}</button>
        </header>

        <main className="flex-1 overflow-y-auto px-md pb-lg">
          {draftOffer && (
            <div className="rounded-card border border-warning/40 bg-warning/10 p-md mb-md flex items-center gap-md animate-pop-in">
              <p className="text-body-small text-ink-primary flex-1">You have an unsaved draft from earlier.</p>
              <button className="text-body-small text-ink-secondary" onClick={() => { try { localStorage.removeItem(draftKey(userId, id)) } catch { /* ignore */ } setDraftOffer(null) }}>Discard</button>
              <button className="text-body-small text-primary font-semibold" onClick={() => {
                const d = draftOffer
                setTitle(d.title || ''); setContent(d.content || ''); setMood(d.mood ?? null); setTags(d.tags || []); setFolderId(d.folderId ?? null); setEntryDate(d.entryDate || todayLocal()); setDraftOffer(null)
              }}>Restore</button>
            </div>
          )}

          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} aria-label="Title"
            className="w-full bg-transparent border-none text-h1 text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-0 px-0 mt-sm mb-md" />

          {/* meta chips */}
          <div className="flex flex-wrap gap-sm mb-md">
            <label className="chip cursor-pointer relative"><Calendar size={13} />{longDate(entryDate).replace(/^\w+, /, '')}
              <input type="date" value={entryDate} onChange={(e) => e.target.value && setEntryDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Entry date" />
            </label>
            <button className="chip" onClick={() => setSheet('folder')} style={folder ? { color: folder.color, borderColor: `${folder.color}66`, background: `${folder.color}1A` } : undefined}>
              {folder ? <span>{folder.emoji}</span> : <Folder size={13} />}{folder ? folder.name : 'No folder'}
            </button>
            <button className={`chip ${isPrivate ? 'chip-active' : ''}`} onClick={() => setPrivate(!isPrivate)} aria-pressed={isPrivate}>
              {isPrivate ? <Lock size={13} /> : <LockOpen size={13} />}{isPrivate ? 'Private' : 'Make private'}
            </button>
            {!id && !content.trim() && <button className="chip" onClick={() => setSheet('templates')}><FileText size={13} /> Template</button>}
          </div>

          {isPrivate && (
            <p className="text-caption text-ink-secondary mb-md leading-relaxed">
              🔒 Encrypted on this device before saving — nobody else can read it, and AI never sees it.
              {!isPro && !original?.is_locked && ` ${privateCount} of ${FREE.privateEntries} free private entries used.`}
            </p>
          )}
          {!isPrivate && original?.is_locked && <p className="text-caption text-warning mb-md">This entry will be saved without encryption.</p>}

          {/* mood */}
          <div className="flex items-center gap-1.5 mb-md" role="radiogroup" aria-label="Mood">
            {MOODS.map((m) => (
              <button key={m.id} role="radio" aria-checked={mood === m.id} aria-label={m.label} title={m.label} onClick={() => setMood(mood === m.id ? null : m.id)}
                className={`w-11 h-11 rounded-full text-xl flex items-center justify-center border transition-all duration-200 active:scale-90 ${mood === m.id ? 'scale-110 shadow-glow' : 'grayscale opacity-60 hover:grayscale-0 hover:opacity-100 border-base-border'}`}
                style={mood === m.id ? { borderColor: m.color, background: `${m.color}26` } : undefined}>{m.emoji}</button>
            ))}
            {smart.mood && (() => { const m = MOODS.find((x) => x.id === smart.mood); return <button className="chip ml-1 animate-pop-in" onClick={() => { setMood(smart.mood); setSmart((s) => ({ ...s, mood: null })) }}><Wand2 size={12} /> {m.emoji} {m.label}?</button> })()}
          </div>

          {aiPrompt && (
            <div className="mb-md bg-base-elevated border border-base-border rounded-card px-md py-2.5 flex items-start gap-sm animate-rise">
              <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-body-small text-ink-secondary flex-1">{aiPrompt}</p>
              <button aria-label="Remove prompt" onClick={() => setAiPrompt('')} className="text-ink-tertiary hover:text-ink-primary"><X size={15} /></button>
            </div>
          )}

          <textarea ref={taRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Start writing your thoughts…" aria-label="Entry text"
            className="w-full bg-transparent border-none text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-0 px-0 py-0 resize-none leading-relaxed min-h-[220px]" />

          {/* tags */}
          <div className="mt-lg pt-md border-t border-base-border/60">
            <div className="flex items-start gap-sm">
              <Tag size={17} className="text-ink-secondary mt-2 shrink-0" />
              <div className="flex flex-wrap gap-1.5 items-center flex-1">
                {tags.map((t) => <TagChip key={t} name={t} color={tagColor(t)} onRemove={() => setTags((p) => p.filter((x) => x !== t))} />)}
                <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder={tags.length ? 'Add tag' : 'Add tags (Enter)'} aria-label="Add tag" maxLength={31}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagDraft) } else if (e.key === 'Backspace' && !tagDraft && tags.length) setTags((p) => p.slice(0, -1)) }}
                  onBlur={() => tagDraft && addTag(tagDraft)}
                  className="bg-transparent text-caption text-ink-primary placeholder:text-ink-tertiary focus:outline-none px-1 py-1.5 min-w-[96px] flex-1" />
              </div>
              <button className="text-caption text-primary px-1 py-1.5 shrink-0" onClick={() => setSheet('tags')}>Manage</button>
            </div>
            {(tagMatches.length > 0 || localSuggestions.length > 0 || smart.tags.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-sm pl-[25px] animate-fade-in">
                {tagMatches.map((t) => <TagChip key={`m${t}`} name={t} color={tagColor(t)} onClick={() => addTag(t)} />)}
                {!tagDraft && [...new Set([...smart.tags, ...localSuggestions])].map((t) => (
                  <button key={`s${t}`} onClick={() => { addTag(t); setSmart((s) => ({ ...s, tags: s.tags.filter((x) => x !== t) })) }} className="inline-flex items-center gap-1 rounded-chip border border-dashed border-primary/50 text-primary text-caption px-2.5 py-1 hover:bg-primary/10 transition">
                    <Sparkles size={11} />#{t}
                  </button>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-body-small text-error mt-md" role="alert">{error}</p>}
        </main>

        {/* bottom bar */}
        <div className="shrink-0 px-md py-sm border-t border-base-border/60 bg-base-bg flex items-center gap-sm" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
          <button onClick={suggestTopic} disabled={promptBusy} className="h-10 px-3 rounded-full border border-primary/60 text-primary bg-base-elevated flex items-center gap-1.5 text-body-small active:scale-95 transition disabled:opacity-60" aria-label="Suggest a topic">
            {promptBusy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Topic
          </button>
          <button onClick={runSmartTags} disabled={smart.busy} className="h-10 px-3 rounded-full border border-base-border text-ink-secondary bg-base-elevated flex items-center gap-1.5 text-body-small active:scale-95 transition disabled:opacity-60" aria-label="AI smart tags">
            {smart.busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Smart tags {!isPro && <ProBadge />}
          </button>
          <p className={`ml-auto text-caption tabular-nums ${over ? 'text-error' : 'text-ink-tertiary'}`}>{words} words{words > 0 ? ` · ${readMinutes(words)} min` : ''}{content.length > limit * 0.9 ? ` · ${(title.length + content.length).toLocaleString()}/${limit.toLocaleString()}` : ''}</p>
        </div>
      </div>

      <FolderPicker open={sheet === 'folder'} onClose={() => setSheet(null)} value={folderId} title="Folder" onPick={chooseFolder} onManage={() => setSheet('folders')} />
      <FolderManager open={sheet === 'folders'} onClose={() => setSheet(null)} notify={show} />
      <TagManager open={sheet === 'tags'} onClose={() => setSheet(null)} notify={show} onPick={(t) => addTag(t)} />
      <TemplateSheet open={sheet === 'templates'} onClose={() => setSheet(null)} onPick={applyTemplate} />
      <ActionSheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="Entry" actions={[{ id: 'del', label: 'Delete entry', icon: <Trash2 size={20} />, danger: true, onClick: () => setSheet('delete') }]} />
      <ConfirmSheet open={sheet === 'discard'} onClose={() => setSheet(null)} title="Discard changes?" message={isPrivate ? 'Your unsaved changes to this private entry will be lost.' : 'Your changes are kept as a local draft on this device, so you can restore them next time.'} confirmLabel="Discard" danger onConfirm={leave} />
      <ConfirmSheet open={sheet === 'delete'} onClose={() => setSheet(null)} title="Delete this entry?" message="This permanently deletes the entry. You can archive it instead to keep it out of the way." confirmLabel="Delete" danger onConfirm={remove} />
      {toast}
    </div>
  )
}
