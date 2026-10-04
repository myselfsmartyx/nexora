import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Folder, FolderOpen, Inbox, Loader2, Trash2, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import ItemCard from './ItemCard.jsx'

// Smart Collections: the AI files every capture into a collection automatically.
// This view lets the user browse them.
export default function CollectionsView({ userId, refreshKey, onOpenItem, onToast }) {
  const [loading, setLoading] = useState(true)
  const [collections, setCollections] = useState([]) // { id, name, count }
  const [openCol, setOpenCol] = useState(null)
  const [colItems, setColItems] = useState([])
  const [colLoading, setColLoading] = useState(false)
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
          <button onClick={() => setOpenCol(null)} className="flex items-center gap-1.5 text-body-small font-semibold text-primary min-w-0">
            <ArrowLeft size={18} className="shrink-0" /> <span className="truncate">{openCol.name}</span>
          </button>
          <button aria-label="Delete collection" onClick={() => removeCollection(openCol)} className="text-ink-tertiary hover:text-error transition shrink-0">
            <Trash2 size={18} />
          </button>
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

  if (collections.length === 0) {
    return (
      <div className="card p-lg text-center">
        <Inbox size={28} className="mx-auto text-ink-tertiary mb-sm" />
        <h3 className="text-h3 text-ink-primary mb-sm">No collections yet</h3>
        <p className="text-body-small text-ink-secondary leading-relaxed">
          Save a link, note or voice memo. Nexora analyzes it and files it into a collection like “AI Tools for SEO” automatically.
        </p>
      </div>
    )
  }

  return (
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
  )
}
