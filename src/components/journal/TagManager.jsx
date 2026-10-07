import { useMemo, useState } from 'react'
import { Pencil, Trash2, Plus, Check, Search } from 'lucide-react'
import { Sheet, ColorPicker, TagChip } from './ui.jsx'
import { PALETTE, hashColor, normalizeTag } from '../../lib/journal/constants.js'
import { saveTagColor, renameTag, deleteTag, explain } from '../../lib/journal/data.js'
import { useJournal } from '../../lib/journal/context.jsx'

export default function TagManager({ open, onClose, onPick, notify }) {
  const { userId, tags, tagColor, touchData } = useJournal()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // tag name being edited
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PALETTE[0])
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tags.filter((t) => !q || t.tag.includes(q))
  }, [tags, query])

  const startEdit = (t) => { setEditing(t.tag); setName(t.tag); setColor(tagColor(t.tag)); setConfirmDel(false); setErr('') }
  const stop = () => { setEditing(null); setConfirmDel(false); setErr('') }

  async function run(fn, okMsg) {
    setBusy(true); setErr('')
    try { await fn(); notify?.(okMsg) } catch (e) { setErr(explain(e).message) } finally { setBusy(false) }
  }

  const create = () => run(async () => {
    const n = normalizeTag(newName)
    if (!n) throw new Error('Give the tag a name.')
    if (tags.some((t) => t.tag === n)) throw new Error('That tag already exists.')
    await saveTagColor(userId, n, newColor)
    await touchData(['tags'])
    setNewName(''); setCreating(false)
  }, 'Tag created')

  const save = () => run(async () => {
    const n = normalizeTag(name)
    if (!n) throw new Error('Tag name can’t be empty.')
    if (n !== editing) await renameTag(editing, n)
    await saveTagColor(userId, n, color)
    await touchData(['tags'])
    stop()
  }, 'Tag updated')

  const remove = () => run(async () => {
    await deleteTag(editing)
    await touchData(['tags'])
    stop()
  }, 'Tag deleted')

  const editingTag = tags.find((t) => t.tag === editing)

  return (
    <Sheet open={open} onClose={onClose} title="Tags" subtitle={`${tags.length} tag${tags.length === 1 ? '' : 's'} · tap a color dot to edit`} tall>
      <div className="flex flex-col gap-md">
        {creating ? (
          <div className="rounded-card border border-primary/40 bg-base-elevated p-md flex flex-col gap-md animate-pop-in">
            <input className="input" autoFocus placeholder="Tag name (e.g. gratitude)" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} maxLength={30} />
            <ColorPicker value={newColor} onChange={setNewColor} />
            {err && <p className="text-caption text-error">{err}</p>}
            <div className="flex gap-sm">
              <button className="btn-secondary flex-1 py-2.5" onClick={() => { setCreating(false); setErr('') }}>Cancel</button>
              <button className="btn-primary flex-1 py-2.5 disabled:opacity-50" disabled={busy || !newName.trim()} onClick={create}>Create</button>
            </div>
          </div>
        ) : (
          <button className="btn-secondary w-full py-3 flex items-center justify-center gap-2" onClick={() => { setCreating(true); setNewColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]); setErr('') }}>
            <Plus size={16} /> New tag
          </button>
        )}

        {tags.length > 8 && (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
            <input className="input !py-2 pl-9" placeholder="Search tags" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        )}

        {list.length === 0 && <p className="text-body-small text-ink-secondary text-center py-lg">{tags.length ? 'No tags match.' : 'No tags yet. Create one, or add tags while you write.'}</p>}

        <ul className="flex flex-col gap-1.5">
          {list.map((t) => (
            <li key={t.tag} className="rounded-card border border-base-border bg-base-surface overflow-hidden">
              {editing === t.tag ? (
                <div className="p-md flex flex-col gap-md animate-pop-in">
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus />
                  <ColorPicker value={color} onChange={setColor} />
                  {normalizeTag(name) !== editing && tags.some((x) => x.tag === normalizeTag(name)) && (
                    <p className="text-caption text-warning">“{normalizeTag(name)}” already exists — saving will merge the two tags.</p>
                  )}
                  {err && <p className="text-caption text-error">{err}</p>}
                  {confirmDel ? (
                    <div className="flex flex-col gap-sm">
                      <p className="text-body-small text-ink-secondary">Remove “{editing}” from {editingTag?.uses || 0} entr{editingTag?.uses === 1 ? 'y' : 'ies'}? The entries themselves stay.</p>
                      <div className="flex gap-sm"><button className="btn-secondary flex-1 py-2.5" onClick={() => setConfirmDel(false)}>Keep</button>
                        <button className="flex-1 py-2.5 rounded-button bg-error text-white text-sm font-semibold uppercase tracking-wider disabled:opacity-60" disabled={busy} onClick={remove}>Delete tag</button></div>
                    </div>
                  ) : (
                    <div className="flex gap-sm">
                      <button aria-label="Delete tag" className="btn-secondary !px-3 text-error" onClick={() => setConfirmDel(true)}><Trash2 size={16} /></button>
                      <button className="btn-secondary flex-1 py-2.5" onClick={stop}>Cancel</button>
                      <button className="btn-primary flex-1 py-2.5 disabled:opacity-50 flex items-center justify-center gap-1.5" disabled={busy} onClick={save}><Check size={16} /> Save</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-sm px-md py-2.5">
                  <button aria-label={`Edit ${t.tag}`} onClick={() => startEdit(t)} className="w-6 h-6 rounded-full shrink-0 active:scale-90 transition" style={{ background: t.color || hashColor(t.tag) }} />
                  <button className="flex-1 min-w-0 text-left" onClick={() => (onPick ? (onPick(t.tag), onClose()) : startEdit(t))}>
                    <TagChip name={t.tag} color={tagColor(t.tag)} />
                  </button>
                  <span className="text-caption text-ink-tertiary tabular-nums">{t.uses}</span>
                  <button aria-label={`Edit ${t.tag}`} onClick={() => startEdit(t)} className="w-8 h-8 flex items-center justify-center rounded-full text-ink-tertiary hover:text-ink-primary hover:bg-base-elevated transition"><Pencil size={15} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
