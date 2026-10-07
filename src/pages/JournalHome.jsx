import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Search, X, MoreVertical, Lock, ShieldCheck, Star, SlidersHorizontal, Plus, PenLine, Sparkles, Archive, ArchiveRestore,
  Copy, Trash2, Pencil, FolderInput, Tags, FolderCog, Download, CheckSquare, BookOpen, CalendarDays, BarChart3, ArrowUpDown,
  MessageCircleQuestion, KeyRound, FileText, ArrowLeft, Loader2, History, LayoutList,
} from 'lucide-react'
import { useJournal } from '../lib/journal/context.jsx'
import {
  fetchEntries, hydrateLocked, setArchived, setFavorite, deleteEntries, moveToFolder, duplicateEntry, setEntryLocked,
  fetchOnThisDay, EMPTY_FILTERS, activeFilterCount, explain,
} from '../lib/journal/data.js'
import { aiPrompts } from '../lib/journal/ai.js'
import { exportJournal } from '../lib/journal/export.js'
import { useVault, requestUnlock, lock, openVaultSettings } from '../lib/journal/vault.js'
import { SORTS, MOODS, dailyPrompt, randomPrompt } from '../lib/journal/constants.js'
import { dayLabel, monthKey, monthLabel, todayLocal } from '../lib/journal/dates.js'
import { ActionSheet, ConfirmSheet, EntrySkeletons, ProBadge, Segmented, TagChip, useToast } from '../components/journal/ui.jsx'
import EntryCard from '../components/journal/EntryCard.jsx'
import StatsStrip from '../components/journal/StatsStrip.jsx'
import FilterSheet from '../components/journal/FilterSheet.jsx'
import TagManager from '../components/journal/TagManager.jsx'
import FolderManager from '../components/journal/FolderManager.jsx'
import FolderPicker from '../components/journal/FolderPicker.jsx'
import CalendarView from '../components/journal/CalendarView.jsx'
import InsightsView from '../components/journal/InsightsView.jsx'
import ReflectionCard from '../components/journal/ReflectionCard.jsx'
import AskJournalSheet from '../components/journal/AskJournalSheet.jsx'
import TemplateSheet from '../components/journal/TemplateSheet.jsx'

// Remembers where you were (filters, scroll, loaded pages) when you open an entry and come back.
const cache = { key: '', version: -1, entries: [], page: 0, hasMore: false, count: null, scroll: 0, view: 'entries', filters: EMPTY_FILTERS, sort: 'newest' }

const groupable = (sort) => sort === 'newest' || sort === 'oldest'

function groupEntries(entries) {
  const months = []
  for (const e of entries) {
    const mk = monthKey(e.entry_date)
    let m = months[months.length - 1]
    if (!m || m.key !== mk) { m = { key: mk, days: [] }; months.push(m) }
    let d = m.days[m.days.length - 1]
    if (!d || d.date !== e.entry_date) { d = { date: e.entry_date, items: [] }; m.days.push(d) }
    d.items.push(e)
  }
  return months
}

export default function JournalHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userId, isPro, folders, folderById, tagColor, overview, touchData, reloadMeta, dataVersion, openUpgrade } = useJournal()
  const vault = useVault()
  const { toast, show } = useToast()

  const [view, setView] = useState(cache.view)
  const [filters, setFilters] = useState(cache.filters)
  const [sort, setSort] = useState(cache.sort)
  const [searchOpen, setSearchOpen] = useState(!!cache.filters.q)
  const [searchText, setSearchText] = useState(cache.filters.q)

  const [entries, setEntries] = useState(cache.entries)
  const [count, setCount] = useState(cache.count)
  const [page, setPage] = useState(cache.page)
  const [hasMore, setHasMore] = useState(cache.hasMore)
  const [loading, setLoading] = useState(cache.version !== dataVersion)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())

  const [sheet, setSheet] = useState(null) // 'filter' | 'tags' | 'folders' | 'menu' | 'ask' | 'templates'
  const [menuEntry, setMenuEntry] = useState(null)
  const [pickerFor, setPickerFor] = useState(null) // array of ids to move
  const [confirmDelete, setConfirmDelete] = useState(null) // ids (permanent, from archive view)
  const [onThisDay, setOnThisDay] = useState([])
  const [aiList, setAiList] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const filtersKey = JSON.stringify(filters) + '|' + sort
  const reqId = useRef(0)
  const sentinel = useRef(null)
  const pending = useRef(null)
  const restored = useRef(cache.version === dataVersion && cache.key === filtersKey)
  const latest = useRef({})
  latest.current = { filters, sort, view, entries, page, hasMore, count, dataVersion, filtersKey }

  // ---------------------------------------------------------------- loading
  const loadFirst = useCallback(async () => {
    const id = ++reqId.current
    setError('')
    try {
      const r = await fetchEntries(latest.current.filters, latest.current.sort, 0)
      const rows = await hydrateLocked(r.rows)
      if (id !== reqId.current) return
      setEntries(rows); setCount(r.count); setPage(0); setHasMore(r.hasMore)
    } catch (e) {
      if (id === reqId.current) setError(e.message || 'Could not load your journal.')
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view !== 'entries') return
    if (restored.current) {
      restored.current = false
      setLoading(false)
      requestAnimationFrame(() => window.scrollTo(0, cache.scroll))
      return
    }
    loadFirst()
  }, [filtersKey, dataVersion, view, loadFirst])

  const loadMore = useCallback(async () => {
    if (loadingMore || !latest.current.hasMore) return
    const id = reqId.current
    setLoadingMore(true)
    try {
      const next = latest.current.page + 1
      const r = await fetchEntries(latest.current.filters, latest.current.sort, next)
      const rows = await hydrateLocked(r.rows)
      if (id !== reqId.current) return
      setEntries((prev) => { const seen = new Set(prev.map((e) => e.id)); return [...prev, ...rows.filter((x) => !seen.has(x.id))] })
      setPage(next); setHasMore(r.hasMore)
    } catch (e) { show('Could not load more: ' + e.message) } finally { setLoadingMore(false) }
  }, [loadingMore, show])

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || loading) return undefined
    const io = new IntersectionObserver((es) => es[0].isIntersecting && loadMore(), { rootMargin: '700px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, loadMore, entries.length])

  // Vault unlocked → reveal private titles/previews in place.
  useEffect(() => {
    if (vault.status !== 'unlocked') return
    hydrateLocked(latest.current.entries).then((rows) => { if (rows !== latest.current.entries) setEntries(rows) })
  }, [vault.status])
  useEffect(() => {
    if (vault.status === 'locked' || vault.status === 'none') setEntries((prev) => prev.map((e) => (e.is_locked ? { ...e, _title: undefined, _preview: undefined, _failed: undefined } : e)))
  }, [vault.status])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { if (searchText !== filters.q) setFilters((f) => ({ ...f, q: searchText })) }, 300)
    return () => clearTimeout(t)
  }, [searchText, filters.q])

  useEffect(() => {
    const t = location.state?.tag
    if (t) { setFilters({ ...EMPTY_FILTERS, tags: [t] }); setSearchText(''); navigate('/journal', { replace: true, state: null }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchOnThisDay().then(setOnThisDay).catch(() => {}) }, [dataVersion])

  // Save state for "back" navigation; flush a pending delete if we leave
  useEffect(() => {
    const onScroll = () => { cache.scroll = window.scrollY }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      const l = latest.current
      Object.assign(cache, { key: l.filtersKey, version: l.dataVersion, entries: l.entries, page: l.page, hasMore: l.hasMore, count: l.count, view: l.view, filters: l.filters, sort: l.sort })
      commitPending()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------- derived
  const filterCount = activeFilterCount(filters)
  const hasAnyFilter = filterCount > 0 || filters.q || filters.favorites || filters.privateOnly || filters.folder !== 'all'
  const grouped = useMemo(() => (groupable(sort) ? groupEntries(entries) : null), [entries, sort])
  const today = todayLocal()
  const wroteToday = entries.some((e) => e.entry_date === today)
  const setF = (patch) => { setFilters((f) => ({ ...f, ...patch })); window.scrollTo({ top: 0 }) }
  const clearAll = () => { setSearchText(''); setFilters({ ...EMPTY_FILTERS, archived: filters.archived }) }

  // ---------------------------------------------------------------- actions
  function removeLocal(ids) {
    setEntries((prev) => prev.filter((e) => !ids.includes(e.id)))
    setCount((c) => (c == null ? c : Math.max(0, c - ids.length)))
  }

  async function commitPending() {
    const p = pending.current
    if (!p) return
    pending.current = null
    clearTimeout(p.timer)
    try { await deleteEntries(p.ids); await touchData(['overview', 'tags', 'folders']) } catch (e) { show('Could not delete: ' + e.message); loadFirst() }
  }

  function scheduleDelete(ids) {
    commitPending()
    removeLocal(ids)
    exitSelect()
    const timer = setTimeout(commitPending, 5500)
    pending.current = { ids, timer }
    show(ids.length > 1 ? `${ids.length} entries deleted` : 'Entry deleted', {
      label: 'Undo', onClick: () => { clearTimeout(timer); pending.current = null; loadFirst() },
    })
  }

  async function toggleFavorite(entry) {
    const v = !entry.is_favorite
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, is_favorite: v } : e)))
    if (filters.favorites && !v) removeLocal([entry.id])
    try { await setFavorite([entry.id], v); reloadMeta(['overview']) } catch (e) { show('Could not update favorite'); loadFirst() }
  }

  async function archive(ids, to) {
    removeLocal(ids); exitSelect()
    try {
      await setArchived(ids, to)
      reloadMeta(['overview', 'folders'])
      show(to ? (ids.length > 1 ? `${ids.length} entries archived` : 'Entry archived') : 'Restored to your journal', {
        label: 'Undo', onClick: async () => { try { await setArchived(ids, !to); await touchData(['overview', 'folders']) } catch { show('Could not undo') } },
      })
    } catch (e) { show('Could not archive: ' + e.message); loadFirst() }
  }

  async function duplicate(entry) {
    try {
      const copy = await duplicateEntry(entry.id, userId)
      await touchData(['overview', 'tags', 'folders'])
      show('Duplicated as today’s entry', { label: 'Edit', onClick: () => navigate(`/journal/${copy.id}/edit`) })
    } catch (e) {
      const x = explain(e)
      if (x.code === 'limit_private') openUpgrade('private'); else show(x.message)
    }
  }

  async function togglePrivate(entry) {
    const to = !entry.is_locked
    if (!(await requestUnlock(to ? 'Unlock to make this entry private.' : 'Unlock to remove privacy from this entry.'))) return
    setBusyId(entry.id)
    try {
      await setEntryLocked(entry.id, to)
      await touchData(['overview'])
      show(to ? 'Entry is now private' : 'Entry is no longer private')
    } catch (e) {
      const x = explain(e)
      if (x.code === 'limit_private') openUpgrade('private'); else show(x.message)
    } finally { setBusyId(null) }
  }

  async function moveTo(ids, folderId) {
    const target = folderId ? folderById.get(folderId) : null
    try {
      if (target?.is_private) {
        if (!(await requestUnlock('Unlock to move entries into a private folder.'))) return
        for (const id of ids) await setEntryLocked(id, true)
      }
      await moveToFolder(ids, folderId)
      await touchData(['overview', 'folders'])
      exitSelect()
      show(target ? `Moved to ${target.emoji} ${target.name}` : 'Moved to Unfiled')
    } catch (e) {
      const x = explain(e)
      if (x.code === 'limit_private') openUpgrade('private'); else show(x.message)
    }
  }

  function exitSelect() { setSelectMode(false); setSelected(new Set()) }
  function onSelect(entry) {
    setSelectMode(true)
    setSelected((prev) => { const n = new Set(prev); n.has(entry.id) ? n.delete(entry.id) : n.add(entry.id); return n })
  }

  async function doExport(fmt) {
    show('Preparing your export…', null, 8000)
    try {
      const r = await exportJournal(fmt)
      show(`Exported ${r.count} entries${r.skipped ? ` · ${r.skipped} private entries skipped (unlock the vault to include them)` : ''}`, null, 6000)
    } catch (e) { show('Export failed: ' + e.message) }
  }

  async function suggestPrompts() {
    if (aiBusy) return
    setAiBusy(true)
    try {
      const r = await aiPrompts()
      setAiList(r.prompts.map((p) => ({ ...p, ai: true })))
    } catch (e) {
      setAiList([{ text: randomPrompt(), theme: 'Library' }, { text: randomPrompt(), theme: 'Library' }])
      if (e.code === 'daily_limit') {
        show("You've used today's free AI prompts — here are two from the library.", { label: 'More', onClick: () => openUpgrade('prompts') })
      } else show(e.message)
    } finally { setAiBusy(false) }
  }

  const openEntry = (e) => navigate(`/journal/${e.id}`)
  const newEntry = (params = {}) => {
    const qs = new URLSearchParams(params)
    if (!params.folder && filters.folder !== 'all' && filters.folder !== 'none') qs.set('folder', filters.folder)
    navigate(`/journal/new${qs.toString() ? `?${qs}` : ''}`)
  }

  const entryActions = menuEntry && [
    { id: 'open', label: 'Open', icon: <BookOpen size={20} />, onClick: () => openEntry(menuEntry) },
    { id: 'edit', label: 'Edit', icon: <Pencil size={20} />, onClick: () => navigate(`/journal/${menuEntry.id}/edit`) },
    { id: 'fav', label: menuEntry.is_favorite ? 'Remove favorite' : 'Add to favorites', icon: <Star size={20} />, onClick: () => toggleFavorite(menuEntry) },
    { id: 'dup', label: 'Duplicate', icon: <Copy size={20} />, onClick: () => duplicate(menuEntry) },
    { id: 'move', label: 'Move to folder', icon: <FolderInput size={20} />, onClick: () => setPickerFor([menuEntry.id]) },
    { id: 'priv', label: menuEntry.is_locked ? 'Remove privacy' : 'Make private', icon: <Lock size={20} />, onClick: () => togglePrivate(menuEntry) },
    { id: 'arch', label: menuEntry.is_archived ? 'Restore from archive' : 'Archive', icon: menuEntry.is_archived ? <ArchiveRestore size={20} /> : <Archive size={20} />, onClick: () => archive([menuEntry.id], !menuEntry.is_archived) },
    { id: 'del', label: 'Delete', icon: <Trash2 size={20} />, danger: true, onClick: () => (menuEntry.is_archived ? setConfirmDelete([menuEntry.id]) : scheduleDelete([menuEntry.id])) },
  ]

  const mainMenu = [
    { id: 'select', label: 'Select entries', icon: <CheckSquare size={20} />, onClick: () => { setView('entries'); setSelectMode(true) } },
    { id: 'ask', label: 'Ask your journal', icon: <MessageCircleQuestion size={20} />, badge: !isPro && <ProBadge />, onClick: () => (isPro ? setSheet('ask') : openUpgrade('ask')) },
    { id: 'tags', label: 'Manage tags', icon: <Tags size={20} />, onClick: () => setSheet('tags') },
    { id: 'folders', label: 'Manage folders', icon: <FolderCog size={20} />, onClick: () => setSheet('folders') },
    { id: 'archive', label: filters.archived ? 'Back to journal' : `Archive${overview?.archived ? ` (${overview.archived})` : ''}`, icon: filters.archived ? <ArrowLeft size={20} /> : <Archive size={20} />, onClick: () => { setView('entries'); setF({ archived: !filters.archived }) } },
    { id: 'vault', label: 'Private vault settings', icon: <KeyRound size={20} />, onClick: () => openVaultSettings() },
    { id: 'exp-md', label: 'Export all (Markdown)', icon: <FileText size={20} />, onClick: () => doExport('md') },
    { id: 'exp-json', label: 'Export all (JSON)', icon: <Download size={20} />, onClick: () => doExport('json') },
  ]

  const selIds = [...selected]
  const selEntries = entries.filter((e) => selected.has(e.id))
  const allArchived = selEntries.length > 0 && selEntries.every((e) => e.is_archived)

  // ---------------------------------------------------------------- render
  const renderCard = (e, i) => (
    <EntryCard key={e.id} entry={e} index={i} query={filters.q} showDate={!grouped} selecting={selectMode} selected={selected.has(e.id)}
      folder={e.folder_id ? folderById.get(e.folder_id) : null} tagColor={tagColor}
      onOpen={openEntry} onSelect={onSelect} onMenu={setMenuEntry} onFavorite={toggleFavorite} />
  )

  return (
    <div className="relative">
      {/* ---------- header ---------- */}
      <header className="sticky top-0 z-40 bg-base-bg/85 backdrop-blur-xl border-b border-base-border/50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {selectMode ? (
          <div className="px-md h-16 flex items-center gap-sm animate-fade-in">
            <button aria-label="Cancel selection" onClick={exitSelect} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-base-elevated"><X size={22} /></button>
            <h1 className="text-h3 flex-1">{selected.size ? `${selected.size} selected` : 'Select entries'}</h1>
            <button className="text-body-small text-primary font-semibold px-2" onClick={() => setSelected(new Set(entries.map((e) => e.id)))}>All loaded</button>
          </div>
        ) : (
          <div className="px-md h-16 flex items-center gap-1">
            <h1 className="text-h2 text-ink-primary tracking-tight flex-1">{filters.archived ? 'Archive' : 'My Journal'}</h1>
            <button aria-label="Search" onClick={() => { setSearchOpen((o) => !o); setView('entries') }} className={`w-10 h-10 rounded-full flex items-center justify-center transition ${searchOpen ? 'text-primary bg-primary/10' : 'text-ink-secondary hover:bg-base-elevated'}`}><Search size={21} /></button>
            <button aria-label={vault.status === 'unlocked' ? 'Lock private entries' : 'Unlock private entries'}
              onClick={() => (vault.status === 'unlocked' ? lock() : requestUnlock())}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition hover:bg-base-elevated ${vault.status === 'unlocked' ? 'text-success' : 'text-ink-secondary'}`}>
              {vault.status === 'unlocked' ? <ShieldCheck size={21} /> : <Lock size={21} />}
            </button>
            <button aria-label="More" onClick={() => setSheet('menu')} className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-ink-secondary hover:bg-base-elevated"><MoreVertical size={21} /></button>
          </div>
        )}
        {searchOpen && !selectMode && (
          <div className="px-md pb-3 animate-rise">
            <div className="relative">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input autoFocus value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search titles, text and tags" className="input pl-10 pr-10" />
              {searchText && <button aria-label="Clear search" onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-ink-tertiary"><X size={17} /></button>}
            </div>
            {filters.q && <p className="text-caption text-ink-tertiary mt-1.5 px-1">Private entries are encrypted, so they’re not included in search.</p>}
          </div>
        )}
      </header>

      <main className="px-md pt-md pb-[140px] flex flex-col gap-md">
        {!filters.archived && (
          <Segmented className="self-start" value={view} onChange={(v) => { setView(v); exitSelect() }} options={[
            { id: 'entries', label: 'Entries', icon: <LayoutList size={15} /> },
            { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={15} /> },
            { id: 'insights', label: 'Insights', icon: <BarChart3 size={15} /> },
          ]} />
        )}

        {view === 'calendar' && !filters.archived && (
          <CalendarView dataVersion={dataVersion} onOpenDay={(d) => { setView('entries'); setF({ date: d, from: '', to: '' }) }} onWriteDay={(d) => newEntry({ date: d })} />
        )}
        {view === 'insights' && !filters.archived && (
          <InsightsView dataVersion={dataVersion} onFilterTag={(t) => { setView('entries'); setF({ tags: [t], tagMode: 'any' }) }} />
        )}

        {(view === 'entries' || filters.archived) && (
          <>
            {!hasAnyFilter && !filters.archived && <StatsStrip overview={overview} />}

            {/* folders */}
            {!filters.archived && (
              <div className="flex gap-sm overflow-x-auto -mx-md px-md pb-1" style={{ scrollbarWidth: 'none' }} role="tablist" aria-label="Folders">
                <button role="tab" aria-selected={filters.folder === 'all'} className={`chip whitespace-nowrap ${filters.folder === 'all' ? 'chip-active' : ''}`} onClick={() => setF({ folder: 'all' })}>All{overview ? ` · ${overview.total}` : ''}</button>
                {folders.length > 0 && <button role="tab" aria-selected={filters.folder === 'none'} className={`chip whitespace-nowrap ${filters.folder === 'none' ? 'chip-active' : ''}`} onClick={() => setF({ folder: 'none' })}>Unfiled{overview ? ` · ${overview.unfiled}` : ''}</button>}
                {folders.map((f) => {
                  const on = filters.folder === f.id
                  return (
                    <button key={f.id} role="tab" aria-selected={on} onClick={() => setF({ folder: f.id })}
                      className="chip whitespace-nowrap transition" style={on ? { color: f.color, background: `${f.color}26`, borderColor: f.color } : undefined}>
                      <span>{f.emoji}</span>{f.name}{f.is_private && <Lock size={11} />}<span className="opacity-60">· {overview?.folders?.[f.id] || 0}</span>
                    </button>
                  )
                })}
                <button className="chip whitespace-nowrap text-primary border-dashed" onClick={() => setSheet('folders')}><Plus size={13} /> Folder</button>
              </div>
            )}

            {/* quick filters */}
            <div className="flex gap-sm overflow-x-auto -mx-md px-md" style={{ scrollbarWidth: 'none' }}>
              <button className={`chip whitespace-nowrap ${filterCount ? 'chip-active' : ''}`} onClick={() => setSheet('filter')}><SlidersHorizontal size={13} /> Filters{filterCount ? ` · ${filterCount}` : ''}</button>
              <button className="chip whitespace-nowrap" onClick={() => setSheet('filter')}><ArrowUpDown size={13} /> {SORTS.find((s) => s.id === sort)?.label}</button>
              <button className={`chip whitespace-nowrap ${filters.favorites ? 'chip-active' : ''}`} onClick={() => setF({ favorites: !filters.favorites })}><Star size={13} className={filters.favorites ? 'fill-current' : ''} /> Favorites</button>
              <button className={`chip whitespace-nowrap ${filters.privateOnly ? 'chip-active' : ''}`} onClick={() => setF({ privateOnly: !filters.privateOnly })}><Lock size={13} /> Private</button>
              <button className="chip whitespace-nowrap" onClick={() => (isPro ? setSheet('ask') : openUpgrade('ask'))}><MessageCircleQuestion size={13} /> Ask AI {!isPro && <ProBadge />}</button>
            </div>

            {/* active filters */}
            {(filters.moods.length > 0 || filters.tags.length > 0 || filters.from || filters.to || filters.date) && (
              <div className="flex flex-wrap gap-1.5 items-center animate-fade-in">
                {filters.moods.map((m) => { const mi = MOODS.find((x) => x.id === m); return <button key={m} className="chip" onClick={() => setF({ moods: filters.moods.filter((x) => x !== m) })}>{mi.emoji} {mi.label} <X size={11} /></button> })}
                {filters.tags.map((t) => <TagChip key={t} name={t} color={tagColor(t)} onRemove={() => setF({ tags: filters.tags.filter((x) => x !== t) })} />)}
                {(filters.from || filters.to || filters.date) && <button className="chip" onClick={() => setF({ from: '', to: '', date: '' })}>{filters.date || `${filters.from || '…'} → ${filters.to || '…'}`} <X size={11} /></button>}
                <button className="text-caption text-primary px-1" onClick={clearAll}>Clear all</button>
              </div>
            )}

            {filters.archived && (
              <div className="rounded-card bg-base-elevated border border-base-border p-md text-body-small text-ink-secondary flex items-center gap-sm"><Archive size={18} className="text-primary shrink-0" /> Archived entries are hidden from your journal, search and stats. Restore them any time.</div>
            )}

            {/* write today + insight cards */}
            {!hasAnyFilter && !filters.archived && !loading && (
              <>
                <section className="card p-md animate-rise" aria-label="Write today">
                  <p className="text-caption uppercase tracking-wider text-primary flex items-center gap-1.5 mb-1.5"><PenLine size={13} /> {wroteToday ? 'You’ve written today' : 'Today’s prompt'}</p>
                  <p className="text-body text-ink-primary leading-snug">{dailyPrompt(today)}</p>
                  <div className="flex flex-wrap gap-sm mt-md">
                    <button className="btn-primary !normal-case !tracking-normal py-2 px-md flex items-center gap-1.5" onClick={() => newEntry({ prompt: dailyPrompt(today) })}><PenLine size={15} /> Write</button>
                    <button className="btn-secondary !normal-case !tracking-normal !py-2 flex items-center gap-1.5 disabled:opacity-60" onClick={suggestPrompts} disabled={aiBusy}>{aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} className="text-primary" />} Suggest topic</button>
                    <button className="btn-secondary !normal-case !tracking-normal !py-2 flex items-center gap-1.5" onClick={() => setSheet('templates')}><FileText size={15} /> Templates</button>
                  </div>
                  {aiList && (
                    <div className="flex flex-col gap-1.5 mt-md animate-rise">
                      {aiList.map((p, i) => (
                        <button key={i} onClick={() => newEntry({ prompt: p.text, ...(p.ai ? { ai: '1' } : {}) })} className="text-left rounded-button bg-base-elevated border border-base-border px-md py-2.5 hover:border-primary/50 transition">
                          <span className="text-caption text-primary">{p.theme}</span>
                          <span className="block text-body-small text-ink-primary">{p.text}</span>
                        </button>
                      ))}
                      <button className="text-caption text-ink-secondary self-start px-1" onClick={() => setAiList(null)}>Hide</button>
                    </div>
                  )}
                </section>
                <ReflectionCard notify={show} />
                {onThisDay.length > 0 && (
                  <section className="card p-md animate-rise" aria-label="On this day">
                    <p className="text-caption uppercase tracking-wider text-warning flex items-center gap-1.5 mb-sm"><History size={13} /> On this day</p>
                    <div className="flex flex-col gap-1.5">
                      {onThisDay.slice(0, 3).map((m) => (
                        <button key={m.id} className="text-left rounded-button hover:bg-base-elevated px-2 py-1.5 -mx-2 transition" onClick={() => navigate(`/journal/${m.id}`)}>
                          <span className="text-caption text-ink-tertiary">{m.years_ago} year{m.years_ago === 1 ? '' : 's'} ago</span>
                          <span className="block text-body-small text-ink-primary truncate">{m.is_locked ? '🔒 Private entry' : m.title || m.preview || 'Untitled'}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* list */}
            {loading ? <EntrySkeletons /> : error ? (
              <div className="card p-lg text-center"><p className="text-body-small text-error mb-md">{error}</p><button className="btn-secondary px-lg py-2" onClick={loadFirst}>Try again</button></div>
            ) : entries.length === 0 ? (
              <div className="card p-lg text-center animate-rise">
                <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-md">{hasAnyFilter || filters.archived ? <Search size={26} className="text-primary" /> : <PenLine size={26} className="text-primary" />}</div>
                <h3 className="text-h3 text-ink-primary mb-sm">{filters.archived ? 'Archive is empty' : hasAnyFilter ? 'No matching entries' : 'Your journal starts here'}</h3>
                <p className="text-body-small text-ink-secondary leading-relaxed mb-md">
                  {filters.archived ? 'Entries you archive will wait here.' : hasAnyFilter ? 'Try different words or loosen a filter.' : 'Write a few lines — or start from a template. Two minutes a day is enough.'}
                </p>
                {hasAnyFilter ? <button className="btn-secondary px-lg py-2" onClick={clearAll}>Clear filters</button> : !filters.archived && <button className="btn-primary px-lg py-3" onClick={() => newEntry()}>Write first entry</button>}
              </div>
            ) : grouped ? (
              <div className="flex flex-col gap-lg">
                {grouped.map((m) => (
                  <section key={m.key} className="flex flex-col gap-md">
                    <h2 className="text-h3 text-ink-primary sticky top-[64px] z-10 bg-base-bg/90 backdrop-blur py-1.5 -mx-md px-md">{monthLabel(m.key)}</h2>
                    {m.days.map((d) => (
                      <div key={d.date} className="flex flex-col gap-sm">
                        <h3 className="text-caption uppercase tracking-wider text-ink-tertiary">{dayLabel(d.date)}</h3>
                        {d.items.map((e, i) => renderCard(e, i))}
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-md">{entries.map((e, i) => renderCard(e, i))}</div>
            )}

            {hasMore && !loading && <div ref={sentinel} className="py-md flex justify-center">{loadingMore && <Loader2 className="animate-spin text-primary" size={20} />}</div>}
            {!hasMore && !loading && entries.length > 0 && (
              <p className="text-caption text-ink-tertiary text-center py-md">{count != null ? `${count} entr${count === 1 ? 'y' : 'ies'}` : ''} · that’s everything</p>
            )}
          </>
        )}
      </main>

      {/* ---------- floating actions ---------- */}
      {selectMode ? (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(76px+env(safe-area-inset-bottom))] lg:bottom-6 z-50 w-[calc(100%-32px)] max-w-md lg:max-w-lg animate-pop-in">
          <div className="flex items-center justify-around bg-base-surface border border-base-border rounded-card shadow-card p-1.5">
            {[
              { l: 'Move', i: <FolderInput size={20} />, f: () => setPickerFor(selIds) },
              { l: 'Favorite', i: <Star size={20} />, f: async () => { try { await setFavorite(selIds, true); exitSelect(); await touchData(['overview']); show('Added to favorites') } catch { show('Could not update') } } },
              { l: allArchived ? 'Restore' : 'Archive', i: allArchived ? <ArchiveRestore size={20} /> : <Archive size={20} />, f: () => archive(selIds, !allArchived) },
              { l: 'Delete', i: <Trash2 size={20} />, f: () => (allArchived ? setConfirmDelete(selIds) : scheduleDelete(selIds)), danger: true },
            ].map((a) => (
              <button key={a.l} disabled={!selIds.length} onClick={a.f} className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-button text-[11px] font-medium disabled:opacity-35 hover:bg-base-elevated transition ${a.danger ? 'text-error' : 'text-ink-primary'}`}>{a.i}{a.l}</button>
            ))}
          </div>
        </div>
      ) : (
        <button aria-label="New journal entry" onClick={() => newEntry()}
          className="fixed right-md bottom-[calc(80px+16px)] lg:right-10 lg:bottom-10 w-14 h-14 bg-primary text-base-bg rounded-full shadow-glow flex items-center justify-center transition-transform active:scale-90 hover:scale-105 z-40">
          <PenLine size={24} />
        </button>
      )}

      {/* ---------- sheets ---------- */}
      <ActionSheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="Journal" actions={mainMenu} />
      <ActionSheet open={!!menuEntry} onClose={() => setMenuEntry(null)} title={menuEntry ? (menuEntry.is_locked ? 'Private entry' : menuEntry.title || 'Untitled entry') : ''} actions={entryActions || []} />
      <FilterSheet open={sheet === 'filter'} onClose={() => setSheet(null)} filters={filters} sort={sort} onApply={(f, s) => { setFilters({ ...f, q: filters.q, folder: filters.folder, favorites: filters.favorites, privateOnly: filters.privateOnly, archived: filters.archived }); setSort(s); window.scrollTo({ top: 0 }) }} />
      <TagManager open={sheet === 'tags'} onClose={() => setSheet(null)} notify={show} onPick={(t) => { setView('entries'); setF({ tags: [t], tagMode: 'any' }) }} />
      <FolderManager open={sheet === 'folders'} onClose={() => setSheet(null)} notify={show} onDeleted={(id) => filters.folder === id && setF({ folder: 'all' })} />
      <FolderPicker open={!!pickerFor} onClose={() => setPickerFor(null)} value={false} onPick={(fid) => moveTo(pickerFor, fid)} onManage={() => setSheet('folders')} />
      <AskJournalSheet open={sheet === 'ask'} onClose={() => setSheet(null)} />
      <TemplateSheet open={sheet === 'templates'} onClose={() => setSheet(null)} onPick={(t) => newEntry({ template: t.id })} />
      <ConfirmSheet open={!!confirmDelete} onClose={() => setConfirmDelete(null)} danger title="Delete permanently?" confirmLabel="Delete"
        message={`This permanently deletes ${confirmDelete?.length || 0} archived entr${confirmDelete?.length === 1 ? 'y' : 'ies'}. This can't be undone.`}
        onConfirm={async () => { const ids = confirmDelete; setConfirmDelete(null); removeLocal(ids); exitSelect(); try { await deleteEntries(ids); await touchData(['overview', 'tags', 'folders']) } catch (e) { show('Could not delete: ' + e.message); loadFirst() } }} />
      {busyId && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30"><Loader2 className="animate-spin text-primary" /></div>}
      {toast}
    </div>
  )
}
