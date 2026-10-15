import { Fragment, useState } from 'react'
import { Pencil, Trash2, Plus, Check, X, Loader2 } from 'lucide-react'

// A list of short texts (insights, steps, actions). Read-only normally; in edit mode every
// row can be edited or deleted and new rows can be added.
//   onCommit(nextItems, { kind: 'edit' | 'delete' | 'add', index, prev })  -> should throw on failure
export default function EditableList({
  items, editing, onCommit, renderView, placeholder = 'Write here…', addLabel = 'Add', max = 12, maxLen = 400, rows = 2,
}) {
  const [editIndex, setEditIndex] = useState(null) // number | 'new' | null
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  if (!editing) {
    return <>{items.map((t, i) => <Fragment key={i}>{renderView(t, i)}</Fragment>)}</>
  }

  function start(i, text) { setEditIndex(i); setDraft(text) }
  function cancel() { setEditIndex(null); setDraft('') }

  async function run(next, meta) {
    setBusy(true)
    try {
      await onCommit(next, meta)
      return true
    } catch {
      return false // the parent shows the error; keep what the user typed
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    const text = draft.trim().slice(0, maxLen)
    if (!text) return
    if (editIndex === 'new') {
      if (await run([...items, text], { kind: 'add' })) cancel()
      return
    }
    if (text === items[editIndex]) { cancel(); return }
    const index = editIndex
    if (await run(items.map((t, i) => (i === index ? text : t)), { kind: 'edit', index, prev: items[index] })) cancel()
  }

  const editor = () => (
    <div className="bg-base-elevated border border-primary/40 rounded-card p-sm flex flex-col gap-sm">
      <textarea
        autoFocus
        value={draft}
        rows={rows}
        disabled={busy}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value.slice(0, maxLen))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel()
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
        }}
        className="input resize-none text-body-small"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-ink-tertiary">{draft.length}/{maxLen}</span>
        <div className="flex items-center gap-2">
          <button onClick={cancel} disabled={busy} className="btn-secondary !py-1.5 !px-3 text-body-small flex items-center gap-1"><X size={14} /> Cancel</button>
          <button onClick={save} disabled={busy || !draft.trim()} className="btn-primary !py-1.5 !px-3 text-body-small flex items-center gap-1 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-sm">
      {items.map((t, i) => (
        editIndex === i ? (
          <Fragment key={i}>{editor()}</Fragment>
        ) : (
          <div key={i} className="flex items-start gap-1 bg-base-surface border border-base-border rounded-card p-md">
            <p className="flex-1 text-body-small text-ink-primary leading-relaxed break-words">{t}</p>
            <button aria-label="Edit" onClick={() => start(i, t)} disabled={busy} className="text-ink-tertiary hover:text-primary p-1.5 shrink-0 disabled:opacity-50"><Pencil size={15} /></button>
            <button aria-label="Delete" onClick={() => run(items.filter((_, idx) => idx !== i), { kind: 'delete', index: i, prev: t })} disabled={busy} className="text-ink-tertiary hover:text-error p-1.5 shrink-0 disabled:opacity-50"><Trash2 size={15} /></button>
          </div>
        )
      ))}
      {editIndex === 'new' ? editor() : items.length < max && (
        <button onClick={() => start('new', '')} disabled={busy} className="self-start text-body-small font-semibold text-primary flex items-center gap-1.5 py-1">
          <Plus size={15} /> {addLabel}
        </button>
      )}
    </div>
  )
}
