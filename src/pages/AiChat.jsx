import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, Plus, Info, X, ArrowUp, Mic, RotateCcw, PanelLeft, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { invokeFn } from '../lib/api.js'
import {
  CONVO_PAGE_SIZE, makeTitle, sortConversations, fetchConversations, fetchLatestConversationId,
  fetchMessages, renameConversation, setConversationPinned, deleteConversation,
} from '../lib/aiHistory.js'
import MessageBubble, { AiAvatar } from '../components/ai/MessageBubble.jsx'
import ConversationSidebar from '../components/ai/ConversationSidebar.jsx'

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

const SpeechRecognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

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
  const location = useLocation()
  const navigate = useNavigate()

  // history sidebar
  const [conversations, setConversations] = useState([])
  const [convosLoading, setConvosLoading] = useState(true)
  const [hasMoreConvos, setHasMoreConvos] = useState(false)
  const [loadingMoreConvos, setLoadingMoreConvos] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // active chat
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([]) // { id, role, content }
  const [msgsLoading, setMsgsLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [lastFailed, setLastFailed] = useState(null) // text to retry
  const [notSaved, setNotSaved] = useState(false)
  const [remaining, setRemaining] = useState(null) // messages left in today's allowance
  const [showNotice, setShowNotice] = useState(() => !noticeDismissed())
  const [listening, setListening] = useState(false)

  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const recognitionRef = useRef(null)
  const openToken = useRef(0) // guards against out-of-order chat loads

  // ---------- initial load: history list + resume the latest chat ----------
  useEffect(() => {
    let cancelled = false
    // Arriving from "Ask AI" on a saved item → start a fresh chat instead of resuming.
    const hasPrefill = typeof location.state?.prefill === 'string' && location.state.prefill.trim()
    async function init() {
      try {
        const [list, latestId] = await Promise.all([
          fetchConversations(userId, 0),
          hasPrefill ? Promise.resolve(null) : fetchLatestConversationId(userId),
        ])
        if (cancelled) return
        setConversations(list)
        setHasMoreConvos(list.length === CONVO_PAGE_SIZE)
        if (latestId) {
          const msgs = await fetchMessages(latestId)
          if (cancelled) return
          setConversationId(latestId)
          setMessages(msgs)
        }
      } catch (err) {
        console.warn('AI chat: could not load history:', err.message)
      } finally {
        if (!cancelled) {
          setConvosLoading(false)
          setMsgsLoading(false)
        }
      }
    }
    init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // "Ask AI" from a saved item / search hands us a ready-made question: drop it in the box.
  useEffect(() => {
    const prefill = location.state?.prefill
    if (typeof prefill === 'string' && prefill.trim()) {
      setInput(prefill.slice(0, MAX_CHARS))
      navigate(location.pathname, { replace: true, state: null })
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Escape closes the phone drawer; background doesn't scroll while it's open.
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const dismissNotice = () => {
    setShowNotice(false)
    rememberNoticeDismissed()
  }

  // ---------- history helpers ----------
  // Moves a chat to the top (or adds it) after new messages.
  const touchConversation = useCallback((convoId, firstText, addedMessages) => {
    const nowIso = new Date().toISOString()
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === convoId)
      const next = exists
        ? prev.map((c) =>
            c.id === convoId
              ? { ...c, last_message_at: nowIso, message_count: (c.message_count || 0) + addedMessages }
              : c
          )
        : [
            { id: convoId, title: makeTitle(firstText), is_pinned: false, last_message_at: nowIso, created_at: nowIso, message_count: addedMessages },
            ...prev,
          ]
      return sortConversations(next)
    })
  }, [])

  const startNewChat = useCallback(() => {
    if (sending) return
    openToken.current++ // cancel any chat still loading
    setConversationId(null)
    setMessages([])
    setMsgsLoading(false)
    setError('')
    setLastFailed(null)
    setNotSaved(false)
    setInput('')
    setSidebarOpen(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [sending])

  const openConversation = useCallback(async (id) => {
    setSidebarOpen(false)
    if (sending || id === conversationId) return
    const token = ++openToken.current
    setError('')
    setLastFailed(null)
    setNotSaved(false)
    setConversationId(id)
    setMessages([])
    setMsgsLoading(true)
    try {
      const msgs = await fetchMessages(id)
      if (token === openToken.current) setMessages(msgs)
    } catch {
      if (token === openToken.current) setError("Couldn't load that chat. Please try again.")
    } finally {
      if (token === openToken.current) setMsgsLoading(false)
    }
  }, [sending, conversationId])

  async function loadMoreConvos() {
    if (loadingMoreConvos) return
    setLoadingMoreConvos(true)
    try {
      const more = await fetchConversations(userId, conversations.length)
      setConversations((prev) => {
        const seen = new Set(prev.map((c) => c.id))
        return sortConversations([...prev, ...more.filter((c) => !seen.has(c.id))])
      })
      setHasMoreConvos(more.length === CONVO_PAGE_SIZE)
    } catch {
      setError("Couldn't load older chats.")
    } finally {
      setLoadingMoreConvos(false)
    }
  }

  async function renameConvo(id, title) {
    try {
      const clean = await renameConversation(id, title)
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: clean } : c)))
    } catch {
      setError("Couldn't rename that chat.")
    }
  }

  async function togglePin(c) {
    const next = !c.is_pinned
    setConversations((prev) => sortConversations(prev.map((x) => (x.id === c.id ? { ...x, is_pinned: next } : x))))
    try {
      await setConversationPinned(c.id, next)
    } catch {
      setConversations((prev) => sortConversations(prev.map((x) => (x.id === c.id ? { ...x, is_pinned: !next } : x))))
      setError("Couldn't update that chat.")
    }
  }

  async function removeConvo(c) {
    if (sending && c.id === conversationId) return
    if (!window.confirm(`Delete “${c.title || 'this chat'}”? This can't be undone.`)) return
    try {
      await deleteConversation(c.id)
      setConversations((prev) => prev.filter((x) => x.id !== c.id))
      if (c.id === conversationId) startNewChat()
    } catch {
      setError("Couldn't delete that chat.")
    }
  }

  // ---------- sending ----------
  // One round-trip to the Edge Function (it holds the Groq key, builds context, saves both messages).
  async function requestReply(convoId, text) {
    const data = await invokeFn('ai-chat', { conversation_id: convoId, message: text })
    if (!data?.reply) throw new Error('Empty reply')
    if (typeof data.remaining === 'number') setRemaining(data.remaining)
    if (data.saved === false) setNotSaved(true)
    return data.reply
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
      setNotSaved(false)
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
            .insert({ user_id: userId, title: makeTitle(text) })
            .select('id')
            .single()
          if (insErr) throw insErr
          convoId = data.id
          setConversationId(convoId)
        }

        const reply = await requestReply(convoId, text)
        setMessages((m) => [...m, { id: 'ai-' + Date.now(), role: 'assistant', content: reply }])
        touchConversation(convoId, text, 2)
      } catch (err) {
        console.warn('AI chat failed:', err.message)
        setMessages((m) => m.filter((x) => x.id !== tempId))
        if (err.code === 'daily_limit' || err.code === 'rate_limited') {
          // Server-written, user-safe message. Keep the draft so nothing is lost; no Retry button.
          setInput(text)
          setError(err.message)
          if (err.code === 'daily_limit') setRemaining(0)
        } else {
          setLastFailed(text)
          setError(err.message || "Couldn't reach Nexora AI. Check your connection and try again.")
        }
      } finally {
        setSending(false)
      }
    },
    [conversationId, sending, userId, touchConversation]
  )

  // Regenerate = replace the latest answer with a fresh one.
  // The old exchange is removed first (so the model doesn't see the question twice); if anything
  // fails afterwards the old answer is put back, so a failed regenerate never loses data.
  const regenerate = useCallback(async () => {
    if (sending || !conversationId) return
    const n = messages.length
    if (n < 2 || messages[n - 1].role !== 'assistant' || messages[n - 2].role !== 'user') return
    const text = messages[n - 2].content

    setError('')
    setLastFailed(null)
    setNotSaved(false)
    setSending(true)

    const tailQuery = () =>
      supabase
        .from('ai_messages')
        .select('id, role, content, referenced_items, model_used')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .order('role', { ascending: true })
        .limit(2)
    const isPair = (t) => t && t.length === 2 && t[0].role === 'assistant' && t[1].role === 'user'

    let backup = null
    try {
      const { data: tail, error: tErr } = await tailQuery()
      if (tErr) throw tErr
      if (!isPair(tail)) throw new Error("Couldn't find that reply in your history. Reload the chat and try again.")
      backup = [...tail].reverse() // [user, assistant]
      const { data: removed, error: dErr } = await supabase
        .from('ai_messages')
        .delete()
        .in('id', tail.map((t) => t.id))
        .select('id')
      // RLS can "succeed" while deleting nothing — treat that as a failure and touch nothing.
      if (dErr || !removed || removed.length === 0) { backup = null; throw dErr || new Error("Couldn't replace that reply. Please try again.") }

      setMessages((m) => m.slice(0, -1)) // hide the old reply; the question stays
      const reply = await requestReply(conversationId, text)
      setMessages((m) => [...m, { id: 'ai-' + Date.now(), role: 'assistant', content: reply }])
      touchConversation(conversationId, text, 0)
    } catch (err) {
      console.warn('AI regenerate failed:', err.message)
      if (backup) {
        try {
          // Did the server save a new pair before the error reached us? If not, restore the old one.
          const { data: tail2 } = await tailQuery()
          if (!isPair(tail2)) {
            await supabase.from('ai_messages').insert(
              backup.map((b) => ({
                user_id: userId,
                conversation_id: conversationId,
                role: b.role,
                content: b.content,
                referenced_items: b.referenced_items || [],
                model_used: b.model_used || 'groq',
              }))
            )
          }
          setMessages(await fetchMessages(conversationId)) // show what's really stored
        } catch {
          setError("Couldn't regenerate, and couldn't restore the previous reply. Reload the chat.")
          setSending(false)
          return
        }
      }
      if (err.code === 'daily_limit') setRemaining(0)
      setError(err.message || "Couldn't regenerate that reply. Try again.")
    } finally {
      setSending(false)
    }
  }, [sending, conversationId, messages, userId, touchConversation])

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

  const empty = !msgsLoading && messages.length === 0

  return (
    // main already reserves 96px for the bottom nav; this fills the rest exactly
    <div className="flex h-[calc(100dvh-6rem)] lg:h-[100dvh]">
      {sidebarOpen && (
        <button
          aria-label="Close chat history"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-[59] bg-black/60 lg:hidden cursor-default"
        />
      )}

      <ConversationSidebar
        userId={userId}
        conversations={conversations}
        activeId={conversationId}
        loading={convosLoading}
        hasMore={hasMoreConvos}
        loadingMore={loadingMoreConvos}
        open={sidebarOpen}
        disabled={sending}
        onClose={() => setSidebarOpen(false)}
        onSelect={openConversation}
        onNew={startNewChat}
        onRename={renameConvo}
        onTogglePin={togglePin}
        onDelete={removeConvo}
        onLoadMore={loadMoreConvos}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-md py-sm border-b border-base-border bg-base-bg/80 backdrop-blur">
          <div className="flex items-center gap-sm min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open chat history"
              className="lg:hidden text-ink-secondary hover:text-primary transition-colors"
            >
              <PanelLeft size={22} />
            </button>
            <div className="flex items-center gap-xs text-primary">
              <Sparkles size={20} fill="currentColor" />
              <h1 className="text-h3 tracking-tight">Nexora AI</h1>
            </div>
          </div>
          <button
            onClick={startNewChat}
            disabled={sending}
            className="lg:hidden flex items-center gap-xs text-ink-secondary hover:text-ink-primary disabled:opacity-40 transition-colors duration-200"
          >
            <Plus size={16} />
            <span className="text-caption uppercase tracking-wider font-semibold">New Chat</span>
          </button>
        </header>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto">
          <div className="w-full max-w-3xl mx-auto px-md pt-sm pb-md flex flex-col gap-lg">
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

            {msgsLoading && (
              <div className="flex justify-center py-xl">
                <Loader2 size={24} className="text-primary animate-spin" />
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

            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                canRegenerate={i === messages.length - 1 && m.role === 'assistant' && messages[i - 1]?.role === 'user'}
                onRegenerate={regenerate}
                busy={sending}
              />
            ))}
            {sending && <Typing />}

            {notSaved && !sending && (
              <p className="self-center text-caption text-warning text-center" role="status">
                This reply couldn't be saved to your history.
              </p>
            )}

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
        </div>

        {/* Composer */}
        <div className="border-t border-base-border/60 bg-base-bg">
          <div className="w-full max-w-3xl mx-auto px-md pb-sm pt-sm">
            {remaining !== null && remaining <= 5 && (
              <p className={`text-caption mb-xs text-center ${remaining === 0 ? 'text-error' : 'text-ink-tertiary'}`}>
                {remaining === 0
                  ? 'No AI messages left for now'
                  : `${remaining} AI message${remaining === 1 ? '' : 's'} left today`}
              </p>
            )}
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
      </div>
    </div>
  )
}
