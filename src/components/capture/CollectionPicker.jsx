import { useEffect, useState } from 'react'
import { X, Check, Folder, Loader2, Plus } from 'lucide-react'
import { createCollection, fetchCollections, setItemInCollection } from '../../lib/capture.js'

// Bottom sheet: choose which folders an item lives in, or create a new folder.
//   onChanged(memberIds, allCollections) is called after every successful change.
export default function CollectionPicker({ userId, itemId, memberIds, onChanged, onClose, onToast }) {
  const [cols, setCols] = useState(null)
  const [members, setMembers] = useState(() => new Set(memberIds))
  const [busyId, setBusyId] = useState(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let alive = true
    fetchCollections(userId)
      .then((list) => { if (alive) setCols(list) })
      .catch((err) => { if (alive) { setCols([]); onToast?.('Could not load folders: ' + err.message) } })
    return () => { alive = false }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  async function toggle(col) {
    if (busyId) return
    const on = !members.has(col.id)
    setBusyId(col.id)
    try {
      await setItemInCollection(userId, itemId, col.id, on)
      const next = new Set(members)
      if (on) next.add(col.id); else next.delete(col.id)
      setMembers(next)
      onChanged([...next], cols)
    } catch (err) {
      onToast?.('Could not update the folder: ' + err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function create() {
    if (creating || !name.trim()) return
    setCreating(true)
    try {
      const { collection, created } = await createCollection(userId, name)
      await setItemInCollection(userId, itemId, collection.id, true)
      const list = created ? [collection, ...(cols || [])] : cols || []
      const next = new Set(members).add(collection.id)
      setCols(list)
      setMembers(next)
      setName('')
      onChanged([...next], list)
    } catch (err) {
      onToast?.(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Choose folders">
      <button aria-label="Close" className="absolute inset-0 bg-black/60 cursor-default" onClick={onClose} />
      <div
        className="relative w-full max-w-md lg:max-w-xl max-h-[85vh] overflow-y-auto bg-base-surface border-t border-base-border rounded-t-sheet p-md shadow-card"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <div className="flex items-center justify-between mb-sm">
          <h2 className="text-h3 text-ink-primary">Folders</h2>
          <button aria-label="Close" onClick={onClose} className="text-ink-secondary hover:text-ink-primary"><X size={22} /></button>
        </div>
        <p className="text-body-small text-ink-secondary mb-md">An item can live in several folders. Changes save instantly.</p>

        <div className="flex items-center gap-2 mb-md">
          <input
            value={name}
            disabled={creating}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            onKeyDown={(e) => { if (e.key === 'Enter') create() }}
            placeholder="New folder name"
            className="input !py-2.5 text-body-small flex-1"
          />
          <button onClick={create} disabled={creating || !name.trim()} className="btn-primary h-10 !py-0 flex items-center gap-1.5 disabled:opacity-50">
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create
          </button>
        </div>

        {cols === null ? (
          <div className="flex justify-center py-lg"><Loader2 size={22} className="text-primary animate-spin" /></div>
        ) : cols.length === 0 ? (
          <p className="text-body-small text-ink-secondary text-center py-md">No folders yet. Create your first one above.</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {cols.map((c) => {
              const on = members.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c)}
                  disabled={!!busyId}
                  aria-pressed={on}
                  className={`flex items-center gap-3 p-md rounded-card border text-left transition disabled:opacity-60 ${on ? 'border-primary/60 bg-primary/10' : 'border-base-border bg-base-elevated'}`}
                >
                  <Folder size={18} className={on ? 'text-primary' : 'text-ink-tertiary'} />
                  <span className="flex-1 min-w-0 text-body-small font-semibold text-ink-primary truncate">{c.name}</span>
                  <span className="text-caption text-ink-tertiary">{c.count}</span>
                  {busyId === c.id ? <Loader2 size={16} className="animate-spin text-primary" /> : on ? <Check size={18} className="text-primary" /> : <span className="w-[18px]" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
