import { useState } from 'react'
import { Loader2, Send, MessageCircleQuestion } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from './ui.jsx'
import { aiAsk } from '../../lib/journal/ai.js'
import { dayLabel } from '../../lib/journal/dates.js'

const IDEAS = ['How have I been feeling lately?', 'What keeps coming up in my entries?', 'What decisions have I been putting off?', 'What gave me energy this month?']

export default function AskJournalSheet({ open, onClose }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')

  async function ask(text = q) {
    const question = text.trim()
    if (question.length < 3 || busy) return
    setQ(question); setBusy(true); setErr(''); setRes(null)
    try { setRes(await aiAsk(question)) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} tall title="Ask your journal" subtitle="Answers come only from your own (non-private) entries.">
      <div className="flex flex-col gap-md">
        <div className="flex gap-sm">
          <input className="input" autoFocus placeholder="e.g. What stressed me out in September?" value={q} maxLength={300}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
          <button aria-label="Ask" onClick={() => ask()} disabled={busy || q.trim().length < 3} className="btn-primary !px-4 disabled:opacity-50 shrink-0">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        {!res && !busy && !err && (
          <div className="flex flex-wrap gap-sm">{IDEAS.map((i) => <button key={i} className="chip" onClick={() => ask(i)}>{i}</button>)}</div>
        )}
        {busy && <p className="text-body-small text-ink-secondary flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Reading your entries…</p>}
        {err && <p className="text-body-small text-error" role="alert">{err}</p>}
        {res && (
          <div className="animate-rise flex flex-col gap-md">
            <div className="rounded-card bg-base-elevated border border-base-border p-md">
              <p className="text-caption uppercase tracking-wider text-primary flex items-center gap-1.5 mb-2"><MessageCircleQuestion size={13} /> Answer</p>
              <p className="text-body text-ink-primary leading-relaxed whitespace-pre-line">{res.answer}</p>
            </div>
            {res.sources?.length > 0 && (
              <div>
                <p className="text-caption uppercase tracking-wider text-ink-secondary mb-sm">From these entries</p>
                <div className="flex flex-col gap-1.5">
                  {res.sources.map((s) => (
                    <button key={s.id} onClick={() => { onClose(); navigate(`/journal/${s.id}`) }} className="card px-md py-2 text-left hover:border-primary/50 transition">
                      <span className="block text-body-small text-ink-primary truncate">{s.title}</span>
                      <span className="block text-caption text-ink-tertiary">{dayLabel(s.entry_date)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-caption text-ink-tertiary">Searched {res.searched} entries. AI can miss things or misread tone — check the entries before relying on an answer.</p>
          </div>
        )}
      </div>
    </Sheet>
  )
}
