import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Star, Pencil, MoreVertical, Lock, ChevronLeft, ChevronRight, Copy, FolderInput, Archive, ArchiveRestore, Trash2, Loader2, Sparkles,
} from 'lucide-react'
import { useJournal } from '../lib/journal/context.jsx'
import {
  fetchEntry, fetchNeighbors, setFavorite, setArchived, deleteEntries, moveToFolder, duplicateEntry, setEntryLocked, explain,
} from '../lib/journal/data.js'
import { useVault, requestUnlock, decryptEntry } from '../lib/journal/vault.js'
import { moodInfo } from '../lib/journal/constants.js'
import { countWords, longDate, readMinutes, timeLabel } from '../lib/journal/dates.js'
import { ActionSheet, ConfirmSheet, TagChip, useToast } from '../components/journal/ui.jsx'
import FolderPicker from '../components/journal/FolderPicker.jsx'
import FolderManager from '../components/journal/FolderManager.jsx'

export default function JournalEntry() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { userId, folderById, tagColor, touchData, reloadMeta, openUpgrade, dataVersion } = useJournal()
  const vault = useVault()
  const { toast, show } = useToast()

  const [entry, setEntry] = useState(undefined) // undefined = loading, null = missing
  const [plain, setPlain] = useState(null) // { title, content } for private entries once decrypted
  const [decryptFailed, setDecryptFailed] = useState(false)
  const [nb, setNb] = useState({ prev_id: null, next_id: null })
  const [sheet, setSheet] = useState(null)
  const [error, setError] = useState('')
  const lastId = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (lastId.current !== id) { lastId.current = id; setEntry(undefined); setPlain(null); setDecryptFailed(false); window.scrollTo({ top: 0 }) }
    fetchEntry(id).then((e) => { if (!cancelled) setEntry(e || null) }).catch((e) => { if (!cancelled) { setError(e.message); setEntry(null) } })
    fetchNeighbors(id).then((n) => !cancelled && setNb(n)).catch(() => {})
    return () => { cancelled = true }
  }, [id, dataVersion])

  // Private entry: decrypt as soon as the vault is unlocked.
  useEffect(() => {
    if (!entry?.is_locked || vault.status !== 'unlocked') return
    let cancelled = false
    decryptEntry(entry.content)
      .then((d) => { if (!cancelled) { setPlain(d); setDecryptFailed(false) } })
      .catch(() => !cancelled && setDecryptFailed(true))
    return () => { cancelled = true }
  }, [entry, vault.status])
  useEffect(() => { if (entry?.is_locked && vault.status !== 'unlocked') setPlain(null) }, [entry, vault.status])

  const toggleFav = useCallback(async () => {
    const v = !entry.is_favorite
    setEntry((e) => ({ ...e, is_favorite: v }))
    try { await setFavorite([id], v); reloadMeta(['overview']) } catch { setEntry((e) => ({ ...e, is_favorite: !v })); show('Could not update favorite') }
  }, [entry, id, reloadMeta, show])

  if (entry === undefined) return <div className="flex justify-center py-2xl"><Loader2 className="animate-spin text-primary" /></div>
  if (entry === null) {
    return (
      <div className="px-md pt-lg"><div className="card p-lg text-center">
        <p className="text-body text-ink-primary mb-md">{error || 'This entry doesn’t exist or was deleted.'}</p>
        <button className="btn-primary px-lg py-3" onClick={() => navigate('/journal', { replace: true })}>Back to journal</button>
      </div></div>
    )
  }

  const locked = entry.is_locked
  const mood = moodInfo(entry.mood)
  const folder = entry.folder_id ? folderById.get(entry.folder_id) : null
  const title = locked ? plain?.title : entry.title
  const body = locked ? plain?.content : entry.content
  const words = body ? countWords(body) : 0

  async function togglePrivate() {
    const to = !locked
    if (!(await requestUnlock(to ? 'Unlock to make this entry private.' : 'Unlock to remove privacy from this entry.'))) return
    try { await setEntryLocked(id, to); await touchData(['overview']); show(to ? 'Entry is now private' : 'Entry is no longer private') } catch (e) {
      const x = explain(e)
      if (x.code === 'limit_private') openUpgrade('private'); else show(x.message)
    }
  }

  const actions = [
    { id: 'edit', label: 'Edit', icon: <Pencil size={20} />, onClick: () => navigate(`/journal/${id}/edit`) },
    { id: 'dup', label: 'Duplicate', icon: <Copy size={20} />, onClick: async () => {
      try { const c = await duplicateEntry(id, userId); await touchData(['overview', 'tags', 'folders']); show('Duplicated as today’s entry', { label: 'Open', onClick: () => navigate(`/journal/${c.id}`) }) } catch (e) {
        const x = explain(e); if (x.code === 'limit_private') openUpgrade('private'); else show(x.message)
      } } },
    { id: 'move', label: 'Move to folder', icon: <FolderInput size={20} />, onClick: () => setSheet('move') },
    { id: 'priv', label: locked ? 'Remove privacy' : 'Make private', icon: <Lock size={20} />, onClick: togglePrivate },
    { id: 'arch', label: entry.is_archived ? 'Restore from archive' : 'Archive', icon: entry.is_archived ? <ArchiveRestore size={20} /> : <Archive size={20} />, onClick: async () => {
      try { await setArchived([id], !entry.is_archived); await touchData(['overview', 'folders']); show(entry.is_archived ? 'Restored' : 'Archived'); if (!entry.is_archived) navigate('/journal', { replace: true }) } catch { show('Could not update') } } },
    { id: 'del', label: 'Delete', icon: <Trash2 size={20} />, danger: true, onClick: () => setSheet('delete') },
  ]

  async function moveTo(fid) {
    const target = fid ? folderById.get(fid) : null
    try {
      if (target?.is_private && !locked) {
        if (!(await requestUnlock('Unlock to move this entry into a private folder.'))) return
        await setEntryLocked(id, true)
      }
      await moveToFolder([id], fid)
      await touchData(['overview', 'folders'])
      show(target ? `Moved to ${target.emoji} ${target.name}` : 'Moved to Unfiled')
    } catch (e) { const x = explain(e); if (x.code === 'limit_private') openUpgrade('private'); else show(x.message) }
  }

  return (
    <div className="animate-fade-in">
      <header className="sticky top-0 z-40 bg-base-bg/85 backdrop-blur-xl border-b border-base-border/50 px-md h-16 flex items-center gap-1" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button aria-label="Back to journal" onClick={() => navigate('/journal')} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-base-elevated transition"><ArrowLeft size={22} /></button>
        <div className="flex-1" />
        <button aria-label={entry.is_favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={toggleFav} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-base-elevated transition">
          <Star size={21} className={`transition ${entry.is_favorite ? 'fill-warning text-warning scale-110' : 'text-ink-secondary'}`} />
        </button>
        <button aria-label="Edit" onClick={() => navigate(`/journal/${id}/edit`)} className="w-10 h-10 rounded-full flex items-center justify-center text-ink-secondary hover:bg-base-elevated transition"><Pencil size={20} /></button>
        <button aria-label="More" onClick={() => setSheet('menu')} className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-ink-secondary hover:bg-base-elevated transition"><MoreVertical size={20} /></button>
      </header>

      <article className="px-md pt-lg pb-[140px]">
        <p className="text-caption uppercase tracking-wider text-ink-tertiary mb-sm">{longDate(entry.entry_date)} · {timeLabel(entry.created_at)}</p>

        {locked && !plain ? (
          <div className="card p-lg text-center animate-rise mt-md">
            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-md"><Lock size={26} /></div>
            <h1 className="text-h3 text-ink-primary mb-sm">Private entry</h1>
            <p className="text-body-small text-ink-secondary mb-md">{decryptFailed ? 'This entry couldn’t be decrypted with the current vault key.' : 'Unlock your vault to read it.'}</p>
            {!decryptFailed && <button className="btn-primary px-lg py-3" onClick={() => requestUnlock()}>Unlock</button>}
          </div>
        ) : (
          <>
            <h1 className="text-h1 text-ink-primary leading-tight mb-md">{title || 'Untitled entry'}</h1>
            <div className="flex flex-wrap items-center gap-sm mb-lg">
              {mood && <span className="chip" style={{ color: mood.color, background: `${mood.color}1F`, borderColor: `${mood.color}55` }}>{mood.emoji} {mood.label}</span>}
              {folder && <span className="chip" style={{ color: folder.color, background: `${folder.color}1A`, borderColor: `${folder.color}55` }}>{folder.emoji} {folder.name}</span>}
              {locked && <span className="chip chip-active"><Lock size={12} /> Private</span>}
              {entry.is_archived && <span className="chip"><Archive size={12} /> Archived</span>}
              {words > 0 && <span className="text-caption text-ink-tertiary">{words} words · {readMinutes(words)} min read</span>}
            </div>
            {entry.ai_prompt_used && (
              <div className="mb-lg bg-base-elevated border border-base-border rounded-card px-md py-2.5 flex items-start gap-sm">
                <Sparkles size={16} className="text-primary shrink-0 mt-0.5" /><p className="text-body-small text-ink-secondary">{entry.ai_prompt_used}</p>
              </div>
            )}
            <div className="text-body text-ink-primary leading-[1.75] whitespace-pre-wrap break-words">{body}</div>
          </>
        )}

        {(entry.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-xl pt-md border-t border-base-border/60">
            {entry.tags.map((t) => <TagChip key={t} name={t} color={tagColor(t)} onClick={() => navigate('/journal', { state: { tag: t } })} />)}
          </div>
        )}
      </article>

      {/* prev / next */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(76px+env(safe-area-inset-bottom))] lg:bottom-6 z-40 w-[calc(100%-32px)] max-w-md lg:max-w-lg">
        <div className="flex items-center justify-between gap-sm bg-base-surface/95 backdrop-blur border border-base-border rounded-full shadow-card px-1.5 py-1.5">
          <button disabled={!nb.prev_id} onClick={() => navigate(`/journal/${nb.prev_id}`)} className="flex items-center gap-1 pl-2 pr-4 py-2 rounded-full text-body-small text-ink-secondary hover:bg-base-elevated disabled:opacity-30 transition"><ChevronLeft size={18} /> Older</button>
          <button onClick={() => navigate(`/journal/${id}/edit`)} className="btn-primary !normal-case !tracking-normal px-5 py-2 rounded-full flex items-center gap-1.5"><Pencil size={15} /> Edit</button>
          <button disabled={!nb.next_id} onClick={() => navigate(`/journal/${nb.next_id}`)} className="flex items-center gap-1 pl-4 pr-2 py-2 rounded-full text-body-small text-ink-secondary hover:bg-base-elevated disabled:opacity-30 transition">Newer <ChevronRight size={18} /></button>
        </div>
      </div>

      <ActionSheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={locked && !plain ? 'Private entry' : title || 'Entry'} actions={actions} />
      <FolderPicker open={sheet === 'move'} onClose={() => setSheet(null)} value={entry.folder_id} onPick={moveTo} onManage={() => setSheet('folders')} />
      <FolderManager open={sheet === 'folders'} onClose={() => setSheet(null)} notify={show} />
      <ConfirmSheet open={sheet === 'delete'} onClose={() => setSheet(null)} danger title="Delete this entry?" confirmLabel="Delete"
        message="This permanently deletes the entry. You can archive it instead to keep it out of the way."
        onConfirm={async () => { try { await deleteEntries([id]); await touchData(['overview', 'tags', 'folders']); navigate('/journal', { replace: true }) } catch (e) { setSheet(null); show('Could not delete: ' + e.message) } }} />
      {toast}
    </div>
  )
}
