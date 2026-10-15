import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Folder, FolderOpen, Inbox, Loader2, Trash2, ChevronRight, Pencil, Check, X, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import ItemCard from './ItemCard.jsx'
import { createCollection, renameCollection } from '../../lib/capture.js'

// Smart Collections: the AI files every capture into a collection automatically.
// This view lets the user browse them.
export default function CollectionsView({ userId, refreshKey, onOpenItem, onToast }) {
  const [loading, setLoading] = useState(true)
  const [collections, setCollections] = useState([]) // { id, name, count }
  const [openCol, setOpenCol] = useState(null)
  const [colItems, setColItems] = useState([])
  const [colLoading, setColLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  // Keep the latest toast callback in a ref so `load` stays stable (no reload loops).
  const toastRef = useRef(onToast)
  toastRef.current = onToast
  const toast = (m) => toastRef.current?.(m)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: cols, error: cErr }, { data: links, error: lErr }] = await Promise.all([
        supabase.from('collections').select('id, name, description, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
        supabase.from('collection_items').select('collection_id').eq('user_id', userId).limit(2000),
      ])
      if (cErr) throw cErr
      if (lErr) throw lErr
      const counts = {}
      for (const l of links || []) counts[l.collection_id] = (counts[l.collection_id] || 0) + 1
      const list = (cols || [])
        .map((c) => ({ ...c, count: counts[c.id] || 0 }))
        .sort((a, b) => b.count - a.count)
      setCollections(list)
    } catch (err) {
      toast('Could not load collections: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load, refreshKey])

  async function open(col) {
    setOpenCol(col)
    setColLoading(true)
    setColItems([])
    try {
      const { data: links, error: lErr } = await supabase.from('collection_items').select('item_id').eq('collection_id', col.id).limit(200)
      if (lErr) throw lErr
      const ids = (links || []).map((l) => l.item_id)
      if (ids.length) {
        const { data, error } = await supabase.from('knowledge_items').select('*').in('id', ids).order('captured_at', { ascending: false })
        if (error) throw error
        setColItems(data || [])
      }
    } catch (err) {
      toast('Could not open collection: ' + err.message)
    } finally {
      setColLoading(false)
    }
  }

  async function createFolder() {
    if (busy || !newName.trim()) return
    setBusy(true)
    try {
      const { collection, created } = await createCollection(userId, newName)
      if (created) setCollections((prev) => [collection, ...prev])
      toast(created ? 'Folder created.' : 'You already have a folder with that name.')
      setNewName('')
      setCreating(false)
    } catch (err) {
      toast('Could not create the folder: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  async function renameFolder() {
    if (busy || !openCol) return
    const name = renameDraft.trim()
    if (!name || name === openCol.name) { setRenaming(false); return }
    setBusy(true)
    try {
      const updated = await renameCollection(userId, openCol.id, name)
      setOpenCol((c) => (c ? { ...c, name: updated.name } : c))
      setCollections((prev) => prev.map((c) => (c.id === updated.id ? { ...c, name: updated.name } : c)))
      setRenaming(false)
      toast('Folder renamed.')
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeCollection(col) {
    if (!window.confirm(`Delete the collection “${col.name}”? Your saved items are NOT deleted.`)) return
    const { error } = await supabase.from('collections').delete().eq('id', col.id)
    if (error) { toast('Could not delete: ' + error.message); return }
    setOpenCol(null)
    setCollections((prev) => prev.filter((c) => c.id !== col.id))
    toast('Collection deleted. Your items are safe.')
  }

  if (loading) {
    return <div className="flex justify-center py-2xl"><Loader2 size={24} className="text-primary animate-spin" /></div>
  }

  if (openCol) {
    return (
      <div className="flex flex-col gap-md">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => { setOpenCol(null); setRenaming(false) }} className="flex items-center gap-1.5 text-body-small font-semibold text-primary shrink-0" aria-label="Back to folders">
            <ArrowLeft size={18} className="shrink-0" />
          </button>
          {renaming ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                autoFocus
                value={renameDraft}
                disabled={busy}
                onChange={(e) => setRenameDraft(e.target.value.slice(0, 60))}
                onKeyDown={(e) => { if (e.key === 'Enter') renameFolder(); if (e.key === 'Escape') setRenaming(false) }}
                aria-label="Folder name"
                className="input !py-1.5 text-body-small flex-1 min-w-0"
              />
              <button aria-label="Save name" onClick={renameFolder} disabled={busy} className="text-primary shrink-0">
                {busy ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              </button>
              <button aria-label="Cancel" onClick={() => setRenaming(false)} disabled={busy} className="text-ink-secondary shrink-0"><X size={20} /></button>
            </div>
          ) : (
            <>
              <h2 className="flex-1 min-w-0 text-body font-semibold text-ink-primary truncate">{openCol.name}</h2>
              <button aria-label="Rename folder" onClick={() => { setRenameDraft(openCol.name); setRenaming(true) }} className="text-ink-tertiary hover:text-primary transition shrink-0">
                <Pencil size={17} />
              </button>
              <button aria-label="Delete collection" onClick={() => removeCollection(openCol)} className="text-ink-tertiary hover:text-error transition shrink-0">
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
        {colLoading ? (
          <div className="flex justify-center py-xl"><Loader2 size={22} className="text-primary animate-spin" /></div>
        ) : colItems.length === 0 ? (
          <p className="text-body-small text-ink-secondary text-center py-lg">This collection is empty.</p>
        ) : (
          colItems.map((it) => <ItemCard key={it.id} item={it} onOpen={onOpenItem} />)
        )}
      </div>
    )
  }

  const newFolderBar = creating ? (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={newName}
        disabled={busy}
        onChange={(e) => setNewName(e.target.value.slice(0, 60))}
        onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
        placeholder="Folder name"
        aria-label="New folder name"
        className="input !py-2 text-body-small flex-1"
      />
      <button onClick={createFolder} disabled={busy || !newName.trim()} className="btn-primary h-10 !py-0 flex items-center gap-1.5 disabled:opacity-50">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Create
      </button>
      <button aria-label="Cancel" onClick={() => { setCreating(false); setNewName('') }} disabled={busy} className="text-ink-secondary"><X size={20} /></button>
    </div>
  ) : (
    <button onClick={() => setCreating(true)} className="self-start flex items-center gap-1.5 text-body-small font-semibold text-primary">
      <Plus size={16} /> New folder
    </button>
  )

  if (collections.length === 0) {
    return (
      <div className="flex flex-col gap-md">
      {newFolderBar}
      <div className="card p-lg text-center">
        <Inbox size={28} className="mx-auto text-ink-tertiary mb-sm" />
        <h3 className="text-h3 text-ink-primary mb-sm">No collections yet</h3>
        <p className="text-body-small text-ink-secondary leading-relaxed">
          Save a link, note or voice memo. Nexora analyzes it and files it into a collection like “AI Tools for SEO” automatically. You can also create your own folders.
        </p>
      </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-md">
    {newFolderBar}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
      {collections.map((c) => (
        <button
          key={c.id}
          onClick={() => open(c)}
          className="text-left bg-base-surface border border-base-border/60 rounded-card p-md hover:border-primary/50 transition active:scale-[0.99] flex items-center gap-3"
        >
          <div className="w-11 h-11 rounded-button bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {c.count > 0 ? <FolderOpen size={22} /> : <Folder size={22} />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-body font-semibold text-ink-primary truncate">{c.name}</h3>
            <p className="text-caption text-ink-secondary">{c.count} item{c.count === 1 ? '' : 's'}</p>
          </div>
          <ChevronRight size={18} className="text-ink-tertiary shrink-0" />
        </button>
      ))}
    </div>
    </div>
  )
}
