import { useState } from 'react'
import { Pencil, Trash2, Plus, Lock, Check } from 'lucide-react'
import { Sheet, ColorPicker, Switch, ProBadge } from './ui.jsx'
import { FOLDER_EMOJIS, FREE, PALETTE } from '../../lib/journal/constants.js'
import { createFolder, updateFolder, deleteFolder, explain } from '../../lib/journal/data.js'
import { useJournal } from '../../lib/journal/context.jsx'

export default function FolderManager({ open, onClose, notify, onDeleted }) {
  const { userId, folders, overview, isPro, openUpgrade, touchData } = useJournal()
  const [form, setForm] = useState(null) // {id?, name, emoji, color, is_private}
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const counts = overview?.folders || {}
  const atLimit = !isPro && folders.length >= FREE.folders

  const startNew = () => {
    if (atLimit) return openUpgrade('folders')
    setErr(''); setConfirmDel(false)
    setForm({ name: '', emoji: FOLDER_EMOJIS[0], color: PALETTE[Math.floor(Math.random() * PALETTE.length)], is_private: false })
  }
  const startEdit = (f) => { setErr(''); setConfirmDel(false); setForm({ id: f.id, name: f.name, emoji: f.emoji, color: f.color, is_private: f.is_private }) }

  async function save() {
    const name = form.name.trim()
    if (!name) return setErr('Give the folder a name.')
    setBusy(true); setErr('')
    try {
      const body = { name, emoji: form.emoji, color: form.color, is_private: form.is_private }
      if (form.id) await updateFolder(form.id, body)
      else await createFolder(userId, { ...body, sort_order: folders.length })
      await touchData(['folders', 'overview'])
      notify?.(form.id ? 'Folder updated' : 'Folder created')
      setForm(null)
    } catch (e) {
      const x = explain(e)
      if (x.code === 'limit_folders') { setForm(null); openUpgrade('folders') }
      else if (x.code === 'limit_private_folders') { setForm({ ...form, is_private: false }); openUpgrade('private_folders') }
      else setErr(x.message)
    } finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteFolder(form.id)
      await touchData(['folders', 'overview'])
      onDeleted?.(form.id)
      notify?.('Folder deleted — its entries moved to Unfiled')
      setForm(null)
    } catch (e) { setErr(explain(e).message) } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} tall title="Folders"
      subtitle={isPro ? `${folders.length} folder${folders.length === 1 ? '' : 's'}` : `${folders.length} of ${FREE.folders} free folders used`}>
      {form ? (
        <div className="flex flex-col gap-md animate-pop-in">
          <div className="flex items-center gap-sm">
            <span className="w-12 h-12 rounded-card flex items-center justify-center text-2xl shrink-0" style={{ background: `${form.color}26`, border: `1px solid ${form.color}66` }}>{form.emoji}</span>
            <input className="input" autoFocus placeholder="Folder name" maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <div>
            <p className="text-caption text-ink-secondary mb-sm">Icon</p>
            <div className="flex flex-wrap gap-1.5">
              {FOLDER_EMOJIS.map((e) => (
                <button key={e} onClick={() => setForm({ ...form, emoji: e })} className={`w-10 h-10 rounded-button text-xl flex items-center justify-center border transition active:scale-90 ${form.emoji === e ? 'border-primary bg-primary/10' : 'border-base-border bg-base-elevated'}`}>{e}</button>
              ))}
            </div>
          </div>
          <div><p className="text-caption text-ink-secondary mb-sm">Color</p><ColorPicker value={form.color} onChange={(c) => setForm({ ...form, color: c })} /></div>
          <div className="flex items-center gap-md rounded-card border border-base-border bg-base-elevated p-md">
            <Lock size={18} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-body text-ink-primary flex items-center gap-2">Private folder {!isPro && <ProBadge />}</p>
              <p className="text-caption text-ink-secondary">New entries in it are encrypted automatically.</p>
            </div>
            <Switch checked={form.is_private} label="Private folder" onChange={(v) => (isPro || !v ? setForm({ ...form, is_private: v }) : openUpgrade('private_folders'))} />
          </div>
          {err && <p className="text-caption text-error" role="alert">{err}</p>}
          {confirmDel ? (
            <div className="flex flex-col gap-sm">
              <p className="text-body-small text-ink-secondary">Delete “{form.name}”? Entries inside are kept and moved to Unfiled.</p>
              <div className="flex gap-sm"><button className="btn-secondary flex-1 py-2.5" onClick={() => setConfirmDel(false)}>Keep</button>
                <button className="flex-1 py-2.5 rounded-button bg-error text-white text-sm font-semibold uppercase tracking-wider disabled:opacity-60" disabled={busy} onClick={remove}>Delete folder</button></div>
            </div>
          ) : (
            <div className="flex gap-sm">
              {form.id && <button aria-label="Delete folder" className="btn-secondary !px-3 text-error" onClick={() => setConfirmDel(true)}><Trash2 size={16} /></button>}
              <button className="btn-secondary flex-1 py-3" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn-primary flex-1 py-3 disabled:opacity-50 flex items-center justify-center gap-1.5" disabled={busy || !form.name.trim()} onClick={save}><Check size={16} /> Save</button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          <button className="btn-secondary w-full py-3 flex items-center justify-center gap-2" onClick={startNew}>
            <Plus size={16} /> New folder {atLimit && <ProBadge />}
          </button>
          {folders.length === 0 && <p className="text-body-small text-ink-secondary text-center py-lg">Folders group entries by theme — Work, Health, Ideas…</p>}
          <ul className="flex flex-col gap-1.5">
            {folders.map((f) => (
              <li key={f.id} className="flex items-center gap-md rounded-card border border-base-border bg-base-surface px-md py-2.5">
                <span className="w-10 h-10 rounded-button flex items-center justify-center text-xl shrink-0" style={{ background: `${f.color}26` }}>{f.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-body text-ink-primary truncate flex items-center gap-1.5">{f.name}{f.is_private && <Lock size={13} className="text-primary shrink-0" />}</p>
                  <p className="text-caption text-ink-tertiary">{counts[f.id] || 0} entr{(counts[f.id] || 0) === 1 ? 'y' : 'ies'}</p>
                </div>
                <button aria-label={`Edit ${f.name}`} onClick={() => startEdit(f)} className="w-8 h-8 flex items-center justify-center rounded-full text-ink-tertiary hover:text-ink-primary hover:bg-base-elevated transition"><Pencil size={15} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  )
}
