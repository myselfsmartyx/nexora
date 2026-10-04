import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, X, MoreHorizontal, Pin, PinOff, Pencil, Trash2, Loader2, MessageSquare } from 'lucide-react'
import { fetchConversationsByIds, groupConversations, searchMessages } from '../../lib/aiHistory.js'

function Row({ c, active, snippet, menuOpen, renaming, disabled, onSelect, onMenu, onStartRename, onCommitRename, onCancelRename, onTogglePin, onDelete }) {
  const [draft, setDraft] = useState(c.title || '')
  const committed = useRef(false)
  useEffect(() => { if (renaming) { setDraft(c.title || ''); committed.current = false } }, [renaming, c.title])
  // Enter and the blur caused by closing the input must not both save.
  const commit = () => {
    if (committed.current) return
    committed.current = true
    onCommitRename(c.id, draft)
  }

  if (renaming) {
    return (
      <div className="px-2 py-1">
        <input
          autoFocus
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { committed.current = true; onCancelRename() }
          }}
          onBlur={commit}
          aria-label="Rename chat"
          className="input !py-2 text-body-small"
        />
      </div>
    )
  }

  return (
    <div className="group relative" data-convo-menu>
      <button
        onClick={() => onSelect(c.id)}
        disabled={disabled}
        aria-current={active ? 'true' : undefined}
        className={`w-full text-left rounded-button pl-3 pr-9 py-2.5 transition-colors duration-200 disabled:opacity-60 ${
          active ? 'bg-primary/10 text-primary' : 'text-ink-primary hover:bg-base-elevated'
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {c.is_pinned && <Pin size={12} className="shrink-0 text-primary" />}
          <span className="truncate text-body-small font-medium">{c.title || 'New chat'}</span>
        </span>
        {snippet && <span className="block text-caption text-ink-tertiary mt-0.5 line-clamp-2 break-words">{snippet}</span>}
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onMenu(menuOpen ? null : c.id) }}
        aria-label={`Options for ${c.title || 'chat'}`}
        aria-expanded={menuOpen}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-base-border/40 transition ${
          menuOpen ? 'opacity-100' : 'lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100'
        }`}
      >
        <MoreHorizontal size={16} />
      </button>

      {menuOpen && (
        <div role="menu" className="absolute right-1 top-full mt-0.5 z-20 w-40 bg-base-elevated border border-base-border rounded-button shadow-card py-1">
          <button role="menuitem" onClick={() => onStartRename(c.id)} className="w-full flex items-center gap-2 px-3 py-2 text-body-small text-ink-primary hover:bg-base-surface">
            <Pencil size={14} /> Rename
          </button>
          <button role="menuitem" onClick={() => onTogglePin(c)} className="w-full flex items-center gap-2 px-3 py-2 text-body-small text-ink-primary hover:bg-base-surface">
            {c.is_pinned ? <><PinOff size={14} /> Unpin</> : <><Pin size={14} /> Pin to top</>}
          </button>
          <button role="menuitem" onClick={() => onDelete(c)} className="w-full flex items-center gap-2 px-3 py-2 text-body-small text-error hover:bg-base-surface">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

// Docked on desktop, slide-over drawer on phones.
export default function ConversationSidebar({
  userId, conversations, activeId, loading, hasMore, loadingMore, open, collapsed = false, disabled,
  onClose, onSelect, onNew, onRename, onTogglePin, onDelete, onLoadMore,
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState(null) // null = not searching; [] = no results
  const [searching, setSearching] = useState(false)
  const [menuId, setMenuId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const reqRef = useRef(0)

  // Close the ⋯ menu when tapping anywhere else.
  useEffect(() => {
    if (!menuId) return
    const close = (e) => { if (!e.target.closest?.('[data-convo-menu]')) setMenuId(null) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menuId])

  // Search: chat titles instantly, plus message contents (debounced) so old chats are findable.
  const q = query.trim()
  useEffect(() => {
    if (q.length < 2) { setHits(null); setSearching(false); return }
    const id = ++reqRef.current
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const msgHits = await searchMessages(userId, q)
        const known = new Map(conversations.map((c) => [c.id, c]))
        const missing = msgHits.map((h) => h.conversation_id).filter((cid) => !known.has(cid))
        const fetched = await fetchConversationsByIds(userId, missing)
        for (const c of fetched) known.set(c.id, c)
        const results = []
        const used = new Set()
        const needle = q.toLowerCase()
        for (const c of conversations) {
          if ((c.title || '').toLowerCase().includes(needle)) { results.push({ ...c, snippet: null }); used.add(c.id) }
        }
        for (const h of msgHits) {
          const c = known.get(h.conversation_id)
          if (c && !used.has(c.id)) { results.push({ ...c, snippet: h.snippet }); used.add(c.id) }
        }
        if (id === reqRef.current) setHits(results)
      } catch {
        if (id === reqRef.current) setHits([])
      } finally {
        if (id === reqRef.current) setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, userId])

  const groups = useMemo(() => groupConversations(conversations), [conversations])

  const rowProps = (c) => ({
    c,
    active: c.id === activeId,
    menuOpen: menuId === c.id,
    renaming: renamingId === c.id,
    disabled,
    onSelect: (id) => { setMenuId(null); onSelect(id) },
    onMenu: setMenuId,
    onStartRename: (id) => { setMenuId(null); setRenamingId(id) },
    onCommitRename: (id, title) => { setRenamingId(null); if (title.trim() && title.trim() !== c.title) onRename(id, title) },
    onCancelRename: () => setRenamingId(null),
    onTogglePin: (conv) => { setMenuId(null); onTogglePin(conv) },
    onDelete: (conv) => { setMenuId(null); onDelete(conv) },
  })

  return (
    <aside
      className={`${open ? 'fixed inset-y-0 left-0 z-[60] flex' : 'hidden'} ${collapsed ? 'lg:hidden' : 'lg:static lg:flex lg:z-auto'} w-80 max-w-[85vw] lg:w-72 lg:max-w-none shrink-0 flex-col bg-base-surface border-r border-base-border`}
      style={open ? { paddingTop: 'env(safe-area-inset-top)' } : undefined}
      aria-label="Chat history"
    >
      <div className="flex items-center justify-between px-md pt-md pb-sm">
        <h2 className="text-h3 text-ink-primary">Chats</h2>
        <button onClick={onClose} aria-label="Close chat history" className="lg:hidden text-ink-secondary hover:text-ink-primary">
          <X size={22} />
        </button>
      </div>

      <div className="px-md flex flex-col gap-sm">
        <button
          onClick={onNew}
          disabled={disabled}
          className="btn-primary h-11 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Plus size={16} /> New chat
        </button>
        <div className="input-glow bg-base-elevated border border-base-border rounded-input flex items-center px-3 gap-2 transition">
          <Search size={16} className="text-ink-tertiary shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 80))}
            placeholder="Search all chats…"
            aria-label="Search chats"
            className="bg-transparent w-full py-2.5 text-body-small text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
          />
          {searching ? (
            <Loader2 size={14} className="animate-spin text-ink-tertiary shrink-0" />
          ) : query ? (
            <button aria-label="Clear search" onClick={() => setQuery('')} className="text-ink-tertiary hover:text-ink-primary shrink-0"><X size={14} /></button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-md">
        {hits !== null ? (
          hits.length === 0 ? (
            <p className="text-body-small text-ink-tertiary text-center px-md py-lg">
              {searching ? 'Searching…' : `No chats mention “${q}”.`}
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">Results</p>
              {hits.map((c) => <Row key={c.id} {...rowProps(c)} snippet={c.snippet} />)}
            </div>
          )
        ) : loading ? (
          <div className="flex justify-center py-xl"><Loader2 size={22} className="animate-spin text-primary" /></div>
        ) : conversations.length === 0 ? (
          <div className="text-center px-md py-xl">
            <MessageSquare size={26} className="mx-auto text-ink-tertiary mb-sm" />
            <p className="text-body-small text-ink-secondary">Your conversations will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            {groups.map(([label, items]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">{label}</p>
                {items.map((c) => <Row key={c.id} {...rowProps(c)} />)}
              </div>
            ))}
            {hasMore && (
              <button onClick={onLoadMore} disabled={loadingMore} className="mx-auto text-body-small font-semibold text-primary hover:underline flex items-center gap-2 disabled:opacity-60">
                {loadingMore && <Loader2 size={14} className="animate-spin" />} Show older chats
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
