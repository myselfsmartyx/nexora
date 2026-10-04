// Copy text to the clipboard. Uses the modern API and falls back to a hidden textarea for
// older browsers / non-secure contexts. Returns true on success.
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

// Opens the phone's native share sheet (WhatsApp, Notes, Mail…). On browsers without it
// (most desktops) it copies the text instead.
// Returns 'shared' | 'copied' | 'cancelled' | 'failed'.
export async function shareText(text) {
  const payload = `${text}\n\n— Shared from Nexora`
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: 'Nexora AI', text: payload })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled' // user closed the share sheet
      // any other error: fall back to copying
    }
  }
  return (await copyText(payload)) ? 'copied' : 'failed'
}
