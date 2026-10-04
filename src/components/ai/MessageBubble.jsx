import { useEffect, useRef, useState } from 'react'
import { Sparkles, Copy, Check, RefreshCw, Share2 } from 'lucide-react'
import { copyText, shareText } from '../../lib/share.js'

export function AiAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-base-elevated border border-base-border flex items-center justify-center shrink-0">
      <Sparkles size={16} className="text-primary" />
    </div>
  )
}

const actionClass =
  'flex items-center gap-1.5 px-2 py-1.5 rounded-md text-caption font-medium text-ink-tertiary hover:text-primary hover:bg-base-elevated transition-colors duration-200 disabled:opacity-40 disabled:hover:text-ink-tertiary disabled:hover:bg-transparent'

// role: 'user' | 'assistant'. Plain-text rendering only (no HTML injection), whitespace preserved.
// `canRegenerate` is true only for the latest AI reply.
export default function MessageBubble({ role, content, canRegenerate = false, onRegenerate, busy = false }) {
  const [copied, setCopied] = useState(false)
  const [shareNote, setShareNote] = useState('')
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  async function handleCopy() {
    const ok = await copyText(content)
    setCopied(ok)
    setShareNote(ok ? '' : "Couldn't copy")
    later(() => { setCopied(false); setShareNote('') }, 1800)
  }

  async function handleShare() {
    const result = await shareText(content)
    if (result === 'copied') setShareNote('Copied. Paste it anywhere')
    else if (result === 'failed') setShareNote("Couldn't share")
    else return
    later(() => setShareNote(''), 2200)
  }

  if (role === 'user') {
    return (
      <div className="flex items-end self-end max-w-[85%]">
        <div className="bg-base-elevated border border-base-border rounded-l-2xl rounded-tr-2xl px-md py-3 text-body text-ink-primary whitespace-pre-wrap break-words leading-relaxed">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-sm self-start max-w-[92%] lg:max-w-[88%]">
      <AiAvatar />
      <div className="min-w-0">
        <div className="bg-base-surface border border-base-border border-l-2 border-l-primary rounded-r-2xl rounded-bl-2xl px-md py-3 text-body text-ink-primary whitespace-pre-wrap break-words leading-relaxed shadow-card">
          {content}
        </div>
        <div className="flex items-center gap-0.5 mt-1 -ml-1 flex-wrap" role="group" aria-label="Message actions">
          <button onClick={handleCopy} className={actionClass} aria-label="Copy reply">
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {canRegenerate && (
            <button onClick={onRegenerate} disabled={busy} className={actionClass} aria-label="Regenerate reply">
              <RefreshCw size={14} /> Regenerate
            </button>
          )}
          <button onClick={handleShare} className={actionClass} aria-label="Share reply">
            <Share2 size={14} /> Share
          </button>
          {shareNote && <span className="text-caption text-ink-tertiary ml-1" role="status">{shareNote}</span>}
        </div>
      </div>
    </div>
  )
}
