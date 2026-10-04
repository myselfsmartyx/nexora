import { useEffect, useRef, useState } from 'react'
import { X, Mic, Square, Loader2, Sparkles, Link2 } from 'lucide-react'
import { findUrl, normalizeUrl, pickRecorderMime, recordingExt, transcribeBlob, formatClock } from '../../lib/capture.js'

const MAX_NOTE_CHARS = 12000
const MAX_RECORD_SECONDS = 300 // 5 minutes

const TITLES = { note: 'New note', voice: 'Voice note', link: 'Save a link' }

// mode: 'note' | 'voice' | 'link'
export default function CaptureSheet({ mode, userId, initialText = '', onClose, onSave }) {
  const [text, setText] = useState(initialText)
  const [phase, setPhase] = useState(mode === 'voice' ? 'idle' : 'edit') // idle | recording | transcribing | edit
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [fromVoice, setFromVoice] = useState(false)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const cancelledRef = useRef(false)
  const secondsRef = useRef(0)
  const inputRef = useRef(null)

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    clearInterval(timerRef.current)
  }

  // Lock background scroll; always release the microphone when the sheet goes away.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      cancelledRef.current = true
      try { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() } catch { /* ignore */ }
      stopStream()
    }
  }, [])

  useEffect(() => {
    if (phase === 'edit') inputRef.current?.focus()
  }, [phase])

  async function startRecording() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Voice recording isn't supported in this browser. You can type your note instead.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickRecorderMime()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = rec
      chunksRef.current = []
      cancelledRef.current = false
      rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data) }
      rec.onstop = handleStopped
      rec.start(1000)
      secondsRef.current = 0
      setSeconds(0)
      setPhase('recording')
      timerRef.current = setInterval(() => {
        secondsRef.current += 1
        setSeconds(secondsRef.current)
        if (secondsRef.current >= MAX_RECORD_SECONDS) stopRecording()
      }, 1000)
    } catch (err) {
      stopStream()
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setError("Microphone access is blocked. Allow it in your browser's site settings, then try again.")
      } else if (err?.name === 'NotFoundError') {
        setError('No microphone was found on this device.')
      } else {
        setError("Couldn't start the microphone. Please try again.")
      }
      setPhase(mode === 'voice' && !text ? 'idle' : 'edit')
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    try { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() } catch { /* ignore */ }
  }

  function cancelRecording() {
    cancelledRef.current = true
    stopRecording()
    stopStream()
    setPhase(mode === 'voice' && !text ? 'idle' : 'edit')
  }

  async function handleStopped() {
    const rec = recorderRef.current
    const mime = rec?.mimeType || ''
    stopStream()
    if (cancelledRef.current) return
    const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' })
    chunksRef.current = []
    if (blob.size < 1000) {
      setError('That recording was empty. Hold the phone closer and try again.')
      setPhase(mode === 'voice' && !text ? 'idle' : 'edit')
      return
    }
    setPhase('transcribing')
    try {
      const heard = await transcribeBlob(userId, blob, recordingExt(mime))
      if (!heard) {
        setError("We couldn't hear any speech in that recording.")
        setPhase(mode === 'voice' && !text ? 'idle' : 'edit')
        return
      }
      setText((prev) => (prev.trim() ? prev.trim() + '\n\n' : '') + heard)
      setFromVoice(true)
      setPhase('edit')
    } catch (err) {
      setError(err.message || "We couldn't transcribe that. Please try again.")
      setPhase(mode === 'voice' && !text ? 'idle' : 'edit')
    }
  }

  async function handleSave() {
    if (saving) return
    setError('')
    if (mode === 'link') {
      const url = normalizeUrl(findUrl(text, { loose: true }) || '')
      if (!url) {
        setError("That doesn't look like a valid link. It should start with https://")
        return
      }
      setSaving(true)
      try { await onSave({ kind: 'link', url }) } finally { setSaving(false) }
      return
    }
    const body = text.trim()
    if (body.length < 3) {
      setError('Write or record something first.')
      return
    }
    setSaving(true)
    try { await onSave({ kind: fromVoice ? 'voice' : 'note', text: body }) } finally { setSaving(false) }
  }

  function requestClose() {
    if (phase === 'recording') cancelRecording()
    onClose()
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const busy = phase === 'recording' || phase === 'transcribing'

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={TITLES[mode]}>
      <button aria-label="Close" className="absolute inset-0 bg-black/60 cursor-default" onClick={requestClose} />
      <div
        className="relative w-full max-w-md lg:max-w-xl bg-base-surface border-t border-base-border rounded-t-sheet p-md shadow-card"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <div className="flex items-center justify-between mb-md">
          <h2 className="text-h3 text-ink-primary">{TITLES[mode]}</h2>
          <button aria-label="Close" onClick={requestClose} className="text-ink-secondary hover:text-ink-primary">
            <X size={22} />
          </button>
        </div>

        {phase === 'idle' && (
          <div className="flex flex-col items-center py-lg gap-md">
            <button
              onClick={startRecording}
              aria-label="Start recording"
              className="w-24 h-24 rounded-full bg-primary/15 border-2 border-primary text-primary flex items-center justify-center hover:bg-primary/25 transition duration-200 active:scale-95"
            >
              <Mic size={36} />
            </button>
            <p className="text-body-small text-ink-secondary text-center max-w-xs">
              Tap and speak. Nexora turns your voice into a searchable, organized note. The audio itself is deleted right after transcription.
            </p>
          </div>
        )}

        {phase === 'recording' && (
          <div className="flex flex-col items-center py-lg gap-md">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-error/20 animate-ping" />
              <button
                onClick={stopRecording}
                aria-label="Stop recording"
                className="relative w-24 h-24 rounded-full bg-error text-white flex items-center justify-center active:scale-95 transition"
              >
                <Square size={30} fill="currentColor" />
              </button>
            </div>
            <div className="text-h2 text-ink-primary tabular-nums">{formatClock(seconds)}</div>
            <p className="text-caption text-ink-secondary">Recording… tap to finish (max {MAX_RECORD_SECONDS / 60} min)</p>
            <button onClick={cancelRecording} className="text-body-small text-ink-secondary hover:text-error transition">
              Cancel
            </button>
          </div>
        )}

        {phase === 'transcribing' && (
          <div className="flex flex-col items-center py-xl gap-md">
            <Loader2 size={36} className="text-primary animate-spin" />
            <p className="text-body-small text-ink-secondary">Transcribing your voice…</p>
          </div>
        )}

        {phase === 'edit' && (
          <>
            {mode === 'link' ? (
              <div className="input-glow bg-base-elevated border border-base-border rounded-input flex items-center px-md py-3 gap-2 transition">
                <Link2 size={18} className="text-ink-secondary shrink-0" />
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 2048))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Paste a link (reel, article, video…)"
                  className="bg-transparent w-full text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
                />
              </div>
            ) : (
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_NOTE_CHARS))}
                rows={7}
                placeholder={fromVoice ? 'Review your transcript…' : 'Write anything worth remembering — an idea, a tip, a plan…'}
                className="input resize-none leading-relaxed"
              />
            )}

            {error && <p className="text-caption text-error mt-2" role="alert">{error}</p>}

            <div className="flex items-center gap-sm mt-md">
              {mode !== 'link' && (
                <button
                  onClick={startRecording}
                  disabled={busy}
                  aria-label="Dictate with voice"
                  className="shrink-0 w-12 h-12 rounded-button border border-base-border bg-base-elevated text-ink-secondary hover:text-primary hover:border-primary/50 flex items-center justify-center transition"
                >
                  <Mic size={20} />
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !text.trim()}
                className="btn-primary flex-1 h-12 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                Save &amp; analyze
              </button>
            </div>
            {mode !== 'link' && text.length > MAX_NOTE_CHARS - 500 && (
              <p className="text-caption text-ink-tertiary mt-2 text-right">{text.length}/{MAX_NOTE_CHARS}</p>
            )}
          </>
        )}

        {error && phase !== 'edit' && <p className="text-caption text-error text-center mt-2" role="alert">{error}</p>}
      </div>
    </div>
  )
}
