import { useEffect, useRef, useState } from 'react'
import { X, Share2, ClipboardPaste, Video, Loader2, Download, CheckCircle2, Smartphone } from 'lucide-react'
import { findUrl, normalizeUrl, transcribeMediaFile } from '../../lib/capture.js'
import { canPromptInstall, isIOS, isStandalone, onInstallStateChange, promptInstall } from '../../lib/pwa.js'

// The "send a reel to Nexora" hub. Three routes, from easiest to most complete.
export default function ReelSheet({ userId, onClose, onPasteClipboard, onSaveRecording }) {
  const [, force] = useState(0)
  const [reelLink, setReelLink] = useState('')
  const [working, setWorking] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => onInstallStateChange(() => force((n) => n + 1)), [])

  // Lock background scroll once (empty deps — re-running would capture "hidden" as the previous value).
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !working) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, working])

  const installed = isStandalone()
  const ios = isIOS()

  async function handleRecording(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    let url = null
    if (reelLink.trim()) {
      url = normalizeUrl(findUrl(reelLink, { loose: true }) || '')
      if (!url) {
        setError("The reel link doesn't look valid — fix it or clear it to continue.")
        return
      }
    }
    setWorking(true)
    try {
      setStatus('Extracting the audio…')
      const text = await transcribeMediaFile(userId, file)
      if (!text) throw new Error("We couldn't hear any speech in that recording. Reels with only music can't be transcribed.")
      setStatus('Saving…')
      await onSaveRecording({ text, url })
    } catch (err) {
      setError(err.message || "We couldn't process that recording.")
      setWorking(false)
      setStatus('')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Send a reel to Nexora">
      <button aria-label="Close" className="absolute inset-0 bg-black/60 cursor-default" onClick={() => !working && onClose()} />
      <div
        className="relative w-full max-w-md lg:max-w-xl max-h-[88vh] overflow-y-auto bg-base-surface border-t border-base-border rounded-t-sheet p-md shadow-card"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <div className="flex items-center justify-between mb-sm">
          <h2 className="text-h3 text-ink-primary">Send a reel to Nexora</h2>
          <button aria-label="Close" onClick={() => !working && onClose()} className="text-ink-secondary hover:text-ink-primary">
            <X size={22} />
          </button>
        </div>
        <p className="text-body-small text-ink-secondary mb-md">
          Nexora pulls out the tips, tools and links, files them, and remembers them for your AI.
        </p>

        <div className="flex flex-col gap-sm">
          {/* 1 — Share directly */}
          <section className="bg-base-elevated border border-base-border rounded-card p-md">
            <div className="flex items-start gap-3">
              <Share2 size={20} className="text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="text-body font-semibold text-ink-primary">Share straight from Instagram</h3>
                {installed ? (
                  <p className="text-body-small text-ink-secondary mt-1 flex items-start gap-1.5">
                    <CheckCircle2 size={16} className="text-success mt-0.5 shrink-0" />
                    Installed. In any reel tap <b>Share</b> and choose <b>Nexora</b>. It's saved and analyzed automatically.
                  </p>
                ) : ios ? (
                  <p className="text-body-small text-ink-secondary mt-1">
                    iPhone doesn't let websites appear in the Share menu. Use <b>Copy link → Paste</b> below. It takes two taps.
                  </p>
                ) : (
                  <>
                    <p className="text-body-small text-ink-secondary mt-1">
                      Install Nexora once. Then <b>Share → Nexora</b> appears in Instagram, TikTok, YouTube and every app.
                    </p>
                    {canPromptInstall() ? (
                      <button onClick={promptInstall} className="btn-primary mt-sm h-10 flex items-center gap-2">
                        <Download size={16} /> Install Nexora
                      </button>
                    ) : (
                      <p className="text-caption text-ink-tertiary mt-1.5 flex items-start gap-1.5">
                        <Smartphone size={14} className="mt-0.5 shrink-0" />
                        Open your browser menu and choose “Install app” or “Add to Home screen”.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* 2 — Copy link, paste */}
          <section className="bg-base-elevated border border-base-border rounded-card p-md">
            <div className="flex items-start gap-3">
              <ClipboardPaste size={20} className="text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="text-body font-semibold text-ink-primary">Copy the link, then paste</h3>
                <p className="text-body-small text-ink-secondary mt-1">
                  In the reel tap <b>Share → Copy link</b>, come back here and tap the button.
                </p>
                <button
                  onClick={onPasteClipboard}
                  disabled={working}
                  className="btn-secondary mt-sm h-10 flex items-center gap-2 !py-0"
                >
                  <ClipboardPaste size={16} /> Paste copied link
                </button>
              </div>
            </div>
          </section>

          {/* 3 — Screen recording */}
          <section className="bg-base-elevated border border-base-border rounded-card p-md">
            <div className="flex items-start gap-3">
              <Video size={20} className="text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="text-body font-semibold text-ink-primary">Capture what's said in the reel</h3>
                <p className="text-body-small text-ink-secondary mt-1">
                  Instagram hides most reel text from apps. For the full tips and tools, screen-record the reel and upload it. Nexora transcribes the audio.
                </p>
                <input
                  value={reelLink}
                  onChange={(e) => setReelLink(e.target.value.slice(0, 2048))}
                  disabled={working}
                  placeholder="Reel link (optional)"
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="input mt-sm !py-2.5 text-body-small"
                />
                <input ref={fileRef} type="file" accept="video/*,audio/*" className="hidden" onChange={handleRecording} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={working}
                  className="btn-secondary mt-sm h-10 flex items-center gap-2 !py-0 disabled:opacity-60"
                >
                  {working ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
                  {working ? status || 'Working…' : 'Upload screen recording'}
                </button>
              </div>
            </div>
          </section>
        </div>

        {error && <p className="text-caption text-error mt-md" role="alert">{error}</p>}
      </div>
    </div>
  )
}
