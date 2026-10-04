import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Search, Sparkles, Loader2, Lightbulb, MessageSquare, X, ChevronRight, Info } from 'lucide-react'
import { invokeFn } from '../../lib/api.js'
import { catStyle, timeAgo } from './ItemCard.jsx'

const EXAMPLES = [
  'Best AI tools for SEO',
  'What finance resources did I save?',
  'Productivity systems I collected',
  'Ideas for growing a business',
]

function haystack(i) {
  const ins = i.insights && typeof i.insights === 'object' ? i.insights : {}
  const tools = Array.isArray(ins.tools_mentioned) ? ins.tools_mentioned.map((t) => t?.name || '').join(' ') : ''
  return `${i.title || ''} ${i.summary || ''} ${(i.tags || []).join(' ')} ${i.category || ''} ${tools}`.toLowerCase()
}

// Full-screen search. Typing shows instant local matches; pressing Enter (or tapping
// "Ask Nexora") asks the AI, which answers from the user's own saves and adds clearly
// labelled suggestions that are NOT from their saves.
export default function SearchOverlay({ items, onClose, onOpenItem, onAskChat }) {
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState('idle') // idle | loading | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const reqRef = useRef(0)

  useEffect(() => {
    inputRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const q = query.trim().toLowerCase()
  const local = useMemo(() => {
    if (!q) return []
    const words = q.split(/\s+/).filter((w) => w.length >= 2)
    if (!words.length) return []
    return items
      .map((i) => {
        const h = haystack(i)
        const score = words.reduce((n, w) => n + (h.includes(w) ? 1 : 0), 0)
        return { i, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.i)
  }, [q, items])

  async function ask(text) {
    const question = (text ?? query).trim()
    if (question.length < 2 || phase === 'loading') return
    if (text) setQuery(text)
    const id = ++reqRef.current
    setPhase('loading')
    setError('')
    try {
      const data = await invokeFn('knowledge-search', { query: question })
      if (id !== reqRef.current) return // a newer search superseded this one
      setResult(data)
      setPhase('done')
    } catch (err) {
      if (id !== reqRef.current) return
      setError(err.message)
      setPhase('error')
    }
  }

  function onChange(v) {
    setQuery(v.slice(0, 300))
    // Editing the question invalidates the previous AI answer.
    if (phase === 'done' || phase === 'error') {
      reqRef.current++
      setPhase('idle')
      setResult(null)
    }
  }

  const showAi = phase === 'done' && result
  const aiResults = showAi ? result.results || [] : []

  return (
    <div className="fixed inset-0 z-[60] bg-base-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Search your knowledge">
      <div className="w-full max-w-md lg:max-w-3xl mx-auto flex flex-col h-full">
        {/* Search bar */}
        <div className="flex items-center gap-sm px-md h-16 border-b border-base-border/50 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <button aria-label="Close search" onClick={onClose} className="text-ink-secondary hover:text-primary transition">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 input-glow bg-base-surface border border-base-border rounded-input flex items-center px-3 py-2 gap-2 transition">
            <Search size={18} className="text-ink-secondary shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
              placeholder="Ask your knowledge… e.g. best AI tools for SEO"
              enterKeyHint="search"
              className="bg-transparent w-full text-body-small text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
            />
            {query && (
              <button aria-label="Clear" onClick={() => { onChange(''); inputRef.current?.focus() }} className="text-ink-tertiary hover:text-ink-primary">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-md py-md flex flex-col gap-md">
          {/* Ask-AI action */}
          {q.length >= 2 && phase !== 'loading' && !showAi && (
            <button
              onClick={() => ask()}
              className="w-full flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-card p-md text-left hover:bg-primary/15 transition active:scale-[0.99]"
            >
              <Sparkles size={22} className="text-primary shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-body font-semibold text-ink-primary truncate">Ask Nexora: “{query.trim()}”</span>
                <span className="block text-caption text-ink-secondary">Answers from your saved knowledge, plus fresh ideas</span>
              </span>
              <ChevronRight size={18} className="text-primary shrink-0" />
            </button>
          )}

          {phase === 'loading' && (
            <div className="card p-md flex items-center gap-3">
              <Loader2 size={20} className="text-primary animate-spin shrink-0" />
              <p className="text-body-small text-ink-secondary">Searching everything you've saved…</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="bg-error/10 border border-error/20 rounded-card p-md" role="alert">
              <p className="text-body-small text-error">{error}</p>
              <p className="text-caption text-ink-secondary mt-1">Keyword matches are still shown below.</p>
            </div>
          )}

          {/* AI answer */}
          {showAi && (
            <>
              <section className="card p-md border-primary/30">
                <h3 className="text-caption font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Sparkles size={14} /> Nexora AI
                </h3>
                <p className="text-body text-ink-primary leading-relaxed">
                  {result.answer || "I couldn't write an answer this time, but the closest matches from your saves are below."}
                </p>
                <button
                  onClick={() => onAskChat(query.trim())}
                  className="mt-3 text-body-small font-semibold text-primary flex items-center gap-1.5 hover:underline"
                >
                  <MessageSquare size={15} /> Continue in AI chat
                </button>
              </section>

              {aiResults.length > 0 && (
                <section>
                  <h3 className="text-caption font-semibold text-ink-secondary uppercase tracking-wider mb-2">From your saves</h3>
                  <div className="flex flex-col gap-sm">
                    {aiResults.map((r) => <ResultRow key={r.id} item={r} onOpen={onOpenItem} />)}
                  </div>
                </section>
              )}

              {(result.suggestions || []).length > 0 && (
                <section>
                  <h3 className="text-caption font-semibold text-ink-secondary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Lightbulb size={14} /> Ideas beyond your saves
                  </h3>
                  <p className="text-caption text-ink-tertiary mb-2 flex items-center gap-1">
                    <Info size={12} /> AI suggestions. Not from your saved knowledge, so double-check before relying on them.
                  </p>
                  <div className="flex flex-col gap-sm">
                    {result.suggestions.map((s, idx) => (
                      <div key={idx} className="bg-base-surface border border-dashed border-base-border rounded-card p-md">
                        <p className="text-body-small font-semibold text-ink-primary">{s.title}</p>
                        {s.detail && <p className="text-body-small text-ink-secondary mt-0.5">{s.detail}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* Instant local matches (before / without the AI answer) */}
          {!showAi && local.length > 0 && (
            <section>
              <h3 className="text-caption font-semibold text-ink-secondary uppercase tracking-wider mb-2">Matches in your saves</h3>
              <div className="flex flex-col gap-sm">
                {local.map((i) => <ResultRow key={i.id} item={i} onOpen={onOpenItem} />)}
              </div>
            </section>
          )}

          {/* Empty state with examples */}
          {!q && (
            <section className="pt-md">
              <p className="text-body-small text-ink-secondary mb-3">
                Ask a question, not just a keyword. Nexora searches everything you've saved and answers from it.
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => ask(ex)} className="chip hover:text-primary hover:border-primary/50 transition">
                    {ex}
                  </button>
                ))}
              </div>
            </section>
          )}

          {q.length >= 2 && local.length === 0 && phase === 'idle' && (
            <p className="text-body-small text-ink-secondary">
              No keyword matches yet. Ask Nexora and it will look for related ideas too.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultRow({ item, onOpen }) {
  return (
    <button
      onClick={() => onOpen(item)}
      className="w-full text-left bg-base-surface border border-base-border/60 rounded-card p-md hover:border-primary/50 transition active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${catStyle(item.category)}`}>
          {item.category || 'Uncategorized'}
        </span>
        <span className="text-[11px] text-ink-tertiary">{timeAgo(item.captured_at)}</span>
      </div>
      <h4 className="text-body font-semibold text-ink-primary break-words">{item.title}</h4>
      {item.summary && <p className="text-body-small text-ink-secondary mt-1 line-clamp-2">{item.summary}</p>}
    </button>
  )
}
