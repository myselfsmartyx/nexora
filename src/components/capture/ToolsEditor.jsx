import { Fragment, useState } from 'react'
import { Pencil, Trash2, Plus, Check, X, Loader2, ExternalLink } from 'lucide-react'
import { findUrl, normalizeUrl, safeHref, hostOf } from '../../lib/capture.js'

const EMPTY = { name: '', use: '', url: '' }

// Tools / resources mentioned in the content. Add, fix or remove any of them.
//   onCommit(nextTools, { kind: 'edit' | 'delete' | 'add', index, prev })  -> should throw on failure
export default function ToolsEditor({ tools, editing, onCommit, max = 12 }) {
  const [editIndex, setEditIndex] = useState(null) // number | 'new' | null
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const view = (t, i) => {
    const href = safeHref(t.url)
    const inner = (
      <>
        <div className="min-w-0">
          <p className="text-body-small font-semibold text-ink-primary">{t.name}</p>
          {t.use && <p className="text-caption text-ink-secondary">{t.use}</p>}
        </div>
        {href && <ExternalLink size={16} className="text-primary shrink-0" />}
      </>
    )
    return href ? (
      <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="bg-base-surface border border-base-border rounded-card p-md flex items-center justify-between gap-3 hover:border-primary/50 transition">{inner}</a>
    ) : (
      <div key={i} className="bg-base-surface border border-base-border rounded-card p-md flex items-center justify-between gap-3">{inner}</div>
    )
  }

  if (!editing) return <>{tools.map((t, i) => <Fragment key={i}>{view(t, i)}</Fragment>)}</>

  function start(i, t) {
    setEditIndex(i)
    setForm(t ? { name: t.name || '', use: t.use || '', url: t.url || '' } : EMPTY)
    setError('')
  }
  function cancel() { setEditIndex(null); setForm(EMPTY); setError('') }

  async function run(next, meta) {
    setBusy(true)
    try { await onCommit(next, meta); return true } catch { return false } finally { setBusy(false) }
  }

  async function save() {
    const name = form.name.trim().slice(0, 60)
    if (!name) { setError('Give the tool a name.'); return }
    let url = null
    if (form.url.trim()) {
      url = normalizeUrl(findUrl(form.url, { loose: true }) || '')
      if (!url) { setError('That link does not look valid. Use something like https://example.com'); return }
    }
    const tool = { name, use: form.use.trim().slice(0, 100), url }
    if (editIndex === 'new') {
      if (await run([...tools, tool], { kind: 'add' })) cancel()
    } else {
      const index = editIndex
      if (await run(tools.map((t, i) => (i === index ? tool : t)), { kind: 'edit', index, prev: tools[index] })) cancel()
    }
  }

  const editor = () => (
    <div className="bg-base-elevated border border-primary/40 rounded-card p-sm flex flex-col gap-sm">
      <input autoFocus value={form.name} disabled={busy} onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 60) })} placeholder="Name (e.g. Surfer SEO)" className="input !py-2 text-body-small" />
      <input value={form.use} disabled={busy} onChange={(e) => setForm({ ...form, use: e.target.value.slice(0, 100) })} placeholder="What it is used for" className="input !py-2 text-body-small" />
      <input value={form.url} disabled={busy} onChange={(e) => setForm({ ...form, url: e.target.value.slice(0, 2048) })} placeholder="Link (optional)" inputMode="url" autoCapitalize="none" spellCheck={false} className="input !py-2 text-body-small" />
      {error && <p className="text-caption text-error" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={cancel} disabled={busy} className="btn-secondary !py-1.5 !px-3 text-body-small flex items-center gap-1"><X size={14} /> Cancel</button>
        <button onClick={save} disabled={busy} className="btn-primary !py-1.5 !px-3 text-body-small flex items-center gap-1 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-sm">
      {tools.map((t, i) => (
        editIndex === i ? (
          <Fragment key={i}>{editor()}</Fragment>
        ) : (
          <div key={i} className="flex items-start gap-1 bg-base-surface border border-base-border rounded-card p-md">
            <div className="flex-1 min-w-0">
              <p className="text-body-small font-semibold text-ink-primary break-words">{t.name}</p>
              {t.use && <p className="text-caption text-ink-secondary break-words">{t.use}</p>}
              {t.url && <p className="text-caption text-primary truncate">{hostOf(t.url)}</p>}
            </div>
            <button aria-label="Edit tool" onClick={() => start(i, t)} disabled={busy} className="text-ink-tertiary hover:text-primary p-1.5 shrink-0 disabled:opacity-50"><Pencil size={15} /></button>
            <button aria-label="Delete tool" onClick={() => run(tools.filter((_, idx) => idx !== i), { kind: 'delete', index: i, prev: t })} disabled={busy} className="text-ink-tertiary hover:text-error p-1.5 shrink-0 disabled:opacity-50"><Trash2 size={15} /></button>
          </div>
        )
      ))}
      {editIndex === 'new' ? editor() : tools.length < max && (
        <button onClick={() => start('new', null)} disabled={busy} className="self-start text-body-small font-semibold text-primary flex items-center gap-1.5 py-1">
          <Plus size={15} /> Add a tool
        </button>
      )}
    </div>
  )
}
