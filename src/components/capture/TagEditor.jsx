import { useMemo, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { normalizeTag } from '../../lib/capture.js'

// Chips you can remove, plus an input that adds new tags (Enter or comma) and suggests tags
// you already use elsewhere.
//   onChange(nextTags, { kind: 'add' | 'delete', prev })  -> should throw on failure
export default function TagEditor({ tags, suggestions = [], onChange, max = 20 }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const q = normalizeTag(draft)
  const matches = useMemo(
    () => suggestions.filter((s) => !tags.includes(s) && (!q || s.includes(q))).slice(0, 6),
    [suggestions, tags, q],
  )

  async function run(next, meta) {
    setBusy(true)
    try { await onChange(next, meta); return true } catch { return false } finally { setBusy(false) }
  }

  async function add(raw) {
    const parts = String(raw).split(/[,\n]/).map(normalizeTag).filter(Boolean)
    const next = [...new Set([...tags, ...parts])].slice(0, max)
    if (next.length === tags.length) { setDraft(''); return }
    if (await run(next, { kind: 'add' })) setDraft('')
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="chip !pr-1 inline-flex items-center gap-1">
            #{t}
            <button aria-label={`Remove tag ${t}`} disabled={busy} onClick={() => run(tags.filter((x) => x !== t), { kind: 'delete', prev: t })} className="p-1 text-ink-tertiary hover:text-error disabled:opacity-50">
              <X size={12} />
            </button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-body-small text-ink-tertiary">No tags yet.</span>}
      </div>

      {tags.length < max && (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value.slice(0, 60))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (draft.trim()) add(draft) }
            }}
            placeholder="Add a tag and press Enter"
            autoCapitalize="none"
            spellCheck={false}
            className="input !py-2 text-body-small flex-1"
          />
          {busy && <Loader2 size={16} className="animate-spin text-primary" />}
        </div>
      )}

      {matches.length > 0 && tags.length < max && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-caption text-ink-tertiary mr-1">{q ? 'Matches' : 'Your tags'}:</span>
          {matches.map((s) => (
            <button key={s} disabled={busy} onClick={() => add(s)} className="text-caption text-ink-secondary border border-dashed border-base-border rounded px-2 py-0.5 hover:border-primary hover:text-primary transition disabled:opacity-50">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
