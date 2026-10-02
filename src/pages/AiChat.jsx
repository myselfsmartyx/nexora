import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, Plus, Info, X, ArrowUp, Mic, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const MAX_CHARS = 2000
const NOTICE_KEY = 'nexora_ai_notice_dismissed'

// Starter prompts come straight from the product doc's example queries.
const STARTERS = [
  'What SEO tools have I saved?',
  'Show me all productivity systems I collected.',
  'Help me build a tight morning routine.',
  'Which finance resources did I save?',
]

// Browser storage can throw (private mode, blocked cookies) — never let it break the screen.
function noticeDismissed() {
  try {
    return localStorage.getItem(NOTICE_KEY) === '1'
  } catch {
    return false
  }
}
function rememberNoticeDismissed() {
  try {
    localStorage.setItem(NOTICE_KEY, '1')
  } catch {
    /* ignore */
  }
}

// supabase.functions.invoke hides the real error body inside error.context.
async function readInvokeError(error) {
  try {
    const body = await error.context.json()
    return body?.error || error.message
  } catch {
    return error.message
  }
}

const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

function AiAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-base-elevated border border-base-border flex items-center justify-center shrink-0">
      <Sparkles size={16} className="text-primary" />
    </div>
  )
}

function Message({ role, content }) {
  if (role === 'user') {
    return (
      <div className="flex items-end self-end max-w-[85%]">
        {/* Plain-text rendering only (no HTML injection), whitespace preserved */}
        <div className="bg-base-elevated border border-base-border rounded-l-2xl rounded-tr-2xl px-md py-3 text-body text-ink-primary whitespace-pre-wrap break-words leading-relaxed">
          {content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-sm self-start max-w-[88%]">
      <AiAvatar />
      <div className="bg-base-surface border border-base-border border-l-2 border-l-primary rounded-r-2xl rounded-bl-2xl px-md py-3 text-body text-ink-primary whitespace-pre-wrap break-words leading-relaxed shadow-card">
        {content}
      </div>
    </div>
  )
}

function Typing() {
  return (
    <div className="flex items-start gap-sm self-start">
      <AiAvatar />
      <div className="bg-base-surface border border-base-border border-l-2 border-l-primary rounded-r-2xl rounded-bl-2xl px-md h-[42px] flex items-center gap-1.5">
        {[0, 0.18, 0.36].map((d) => (
          <span
            key={d}
            className="w-2 h-2 rounded-full bg-secondary animate-thinking-dot"
            style={{ animationDelay: `${d}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export default function AiChat({ session }) {
  const userId = session.user.id

  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([]) // { id, role, content }
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastFailed, setLastFailed] = useState(null) // text to retry
  const [showNotice, setShowNotice] = useState(() => !noticeDismissed())
  const [listening, setListening] = useState(false)

  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const recognitionRef = useRef(null)

  // Resume the most recent conversation (if any) so chats survive reloads.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: convo, error: cErr } = await supabase
          .from('ai_conversations')
          .select('id')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (cErr) throw cErr
        if (!convo) return
        const { data: msgs, error: mErr } = await supabase
          .from('ai_messages')
          .select('id, role, content')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: true })
          .limit(100)
        if (mErr) throw mErr
        if (cancelled) return
        setConversationId(convo.id)
        setMessages(msgs || [])
      } catch (err) {
        console.warn('AI chat: could not load history:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Keep newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending])

  // Auto-grow the textarea up to 120px.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '44px'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [input])

  // Stop the mic if the user leaves the screen.
  useEffect(() => () => recognitionRef.current?.abort?.(), [])

  const dismissNotice = () => {
    setShowNotice(false)
    rememberNoticeDismissed()
  }

  const startNewChat = () => {
    if (sending) return
    setConversationId(null)
    setMessages([])
    setError('')
    setLastFailed(null)
    setInput('')
  }

  const send = useCallback(
    async (rawText) => {
      const text = (rawText ?? '').trim()
      if (!text || sending) return
      if (text.length > MAX_CHARS) {
        setError(`Please keep messages under ${MAX_CHARS} characters.`)
        return
      }

      setError('')
      setLastFailed(null)
      setSending(true)
      setInput('')
      const tempId = 'tmp-' + Date.now()
      setMessages((m) => [...m, { id: tempId, role: 'user', content: text }])

      try {
        // Lazily create the conversation on the first message (no empty chats).
        let convoId = conversationId
        if (!convoId) {
          const { data, error: insErr } = await supabase
            .from('ai_conversations')
            .insert({ user_id: userId, title: text.slice(0, 50) })
            .select('id')
            .single()
          if (insErr) throw insErr
          convoId = data.id
          setConversationId(convoId)
        }

        // The Edge Function holds the Groq key, builds context, saves both messages.
        const { data, error: fnErr } = await supabase.functions.invoke('ai-chat', {
          body: { conversation_id: convoId, message: text },
        })
        if (fnErr) throw new Error(await readInvokeError(fnErr))
        if (!data?.reply) throw new Error('Empty reply')

        setMessages((m) => [...m, { id: 'ai-' + Date.now(), role: 'assistant', content: data.reply }])
      } catch (err) {
        console.warn('AI chat failed:', err.message)
        setMessages((m) => m.filter((x) => x.id !== tempId))
        setLastFailed(text)
        setError("Couldn't reach Nexora AI. Check your connection and try again.")
      } finally {
        setSending(false)
      }
    },
    [conversationId, sending, userId]
  )

  const toggleMic = () => {
    if (!SpeechRecognition) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = navigator.language || 'en-US'
    rec.interimResults = false
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(' ')
      setInput((prev) => (prev ? prev + ' ' : '') + transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send(input)
    }
  }

  const empty = !loading && messages.length === 0

  return (
    // main already reserves 96px for the bottom nav; this fills the rest exactly
    <div className="flex flex-col h-[calc(100dvh-6rem)]">
      {/* Top bar */}
      <header className="flex items-center justify-between px-md py-sm border-b border-base-border bg-base-bg/80 backdrop-blur">
        <div className="flex items-center gap-xs text-primary">
          <Sparkles size={20} fill="currentColor" />
          <h1 className="text-h3 tracking-tight">Nexora AI</h1>
        </div>
        <button
          onClick={startNewChat}
          disabled={sending}
          className="flex items-center gap-xs text-ink-secondary hover:text-ink-primary disabled:opacity-40 transition-colors duration-200"
        >
          <Plus size={16} />
          <span className="text-caption uppercase tracking-wider font-semibold">New Chat</span>
        </button>
      </header>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-md pt-sm pb-md flex flex-col gap-lg">
        {showNotice && (
          <div className="card p-sm flex items-start justify-between">
            <div className="flex items-start gap-sm">
              <Info size={18} className="text-primary mt-0.5 shrink-0" />
              <p className="text-body-small text-ink-secondary pr-sm">
                I provide realistic, practical, execution-oriented guidance — not just motivation. No fluff.
              </p>
            </div>
            <button
              onClick={dismissNotice}
              aria-label="Dismiss notice"
              className="text-ink-tertiary hover:text-ink-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {empty && (
          <div className="flex flex-col items-center text-center gap-md pt-lg">
            <div className="w-14 h-14 rounded-full bg-base-elevated border border-primary/40 flex items-center justify-center shadow-glow">
              <Sparkles size={26} className="text-primary" />
            </div>
            <div>
              <p className="text-h3 text-ink-primary">What are we working on?</p>
              <p className="text-body-small text-ink-secondary mt-xs">
                Ask about your saved knowledge, goals, or a challenge.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-sm">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="chip hover:border-primary hover:text-primary transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <Message key={m.id} role={m.role} content={m.content} />
        ))}
        {sending && <Typing />}

        {error && (
          <div className="self-center flex items-center gap-sm text-body-small text-error bg-error/10 border border-error/30 rounded-button px-md py-sm">
            <span>{error}</span>
            {lastFailed && (
              <button
                onClick={() => send(lastFailed)}
                className="flex items-center gap-1 font-semibold underline underline-offset-2"
              >
                <RotateCcw size={14} /> Retry
              </button>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-md pb-sm pt-sm border-t border-base-border/60 bg-base-bg">
        <div className="card input-glow flex items-end p-xs rounded-2xl">
          {SpeechRecognition && (
            <button
              onClick={toggleMic}
              aria-label={listening ? 'Stop dictation' : 'Start dictation'}
              className={`p-sm shrink-0 mb-0.5 transition-colors ${
                listening ? 'text-error animate-pulse' : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Mic size={20} />
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask about your knowledge, goals, or challenges..."
            className="w-full bg-transparent border-none outline-none resize-none py-sm px-xs text-body text-ink-primary placeholder:text-ink-tertiary"
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            aria-label="Send message"
            className="w-10 h-10 rounded-full bg-primary text-base-bg flex items-center justify-center shrink-0 mb-0.5 ml-xs shadow-glow transition-all duration-200 active:scale-90 disabled:opacity-40 disabled:shadow-none"
          >
            <ArrowUp size={20} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </div>
  )
}
