import { supabase } from './supabase.js'
import { invokeFn } from './api.js'

// =====================================================================================
// URL helpers
// =====================================================================================

// Tracking params that identify *who shared* a link (igsh) or add noise. Stripping them
// protects the sender's privacy and lets us detect the same reel saved twice.
const TRACKING_PARAM = /^(utm_.+|igsh|igshid|fbclid|gclid|mc_eid|si|ref_src|ref_url|feature)$/i

const TRAILING_PUNCT = /[.,;:!?)\]}>'"]+$/

// Finds the first link in a piece of text. `loose` also accepts a bare "domain.com/path".
export function findUrl(text, { loose = false } = {}) {
  if (typeof text !== 'string') return null
  const strict = text.match(/https?:\/\/[^\s<>"']+/i)
  if (strict) return strict[0].replace(TRAILING_PUNCT, '')
  if (loose) {
    const t = text.trim()
    if (t && !/\s/.test(t) && /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]\S*)?$/i.test(t)) {
      return 'https://' + t.replace(TRAILING_PUNCT, '')
    }
  }
  return null
}

// Returns a clean, safe http(s) URL — or null if it isn't one.
export function normalizeUrl(raw) {
  if (typeof raw !== 'string') return null
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.username = ''
    u.password = ''
    u.hash = ''
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) u.searchParams.delete(key)
    }
    const out = u.toString()
    return out.length <= 2048 ? out : null
  } catch {
    return null
  }
}

// Only allow http(s) links to be rendered as clickable anchors (blocks javascript: URLs).
export function safeHref(u) {
  return normalizeUrl(typeof u === 'string' ? u : '') ? u : null
}

export function detectPlatform(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\.|^m\./, '').toLowerCase()
    if (h.endsWith('instagram.com')) return 'instagram'
    if (h === 'youtu.be' || h.endsWith('youtube.com')) return 'youtube'
    if (h.endsWith('tiktok.com')) return 'tiktok'
    if (h.endsWith('facebook.com') || h === 'fb.watch') return 'facebook'
    if (h === 'x.com' || h.endsWith('twitter.com')) return 'x'
    if (h.endsWith('linkedin.com')) return 'linkedin'
    if (h.endsWith('reddit.com')) return 'reddit'
    if (h.endsWith('pinterest.com')) return 'pinterest'
    return 'web'
  } catch {
    return 'web'
  }
}

export const PLATFORM_LABEL = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  x: 'X',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  pinterest: 'Pinterest',
  web: 'Web',
  'screen-recording': 'Screen recording',
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// =====================================================================================
// Saving
// =====================================================================================

// Creates a knowledge item (status "processing" until the AI has analysed it).
// Links are de-duplicated: saving the same reel twice returns the existing item.
export async function saveCapture(userId, f) {
  if (f.url) {
    const { data: dup } = await supabase
      .from('knowledge_items')
      .select('*')
      .eq('user_id', userId)
      .eq('source_url', f.url)
      .limit(1)
      .maybeSingle()
    if (dup) return { item: dup, duplicate: true }
  }
  const row = {
    user_id: userId,
    source_type: f.sourceType,
    source_url: f.url || null,
    source_platform: f.url ? detectPlatform(f.url) : f.platform || null,
    title: (f.title || 'Untitled').slice(0, 120),
    content: f.content || f.url || '',
    category: 'Uncategorized',
    importance: 1,
    tags: [],
    status: 'processing',
    file_path: f.filePath || null,
    file_type: f.fileType || null,
  }
  const { data, error } = await supabase.from('knowledge_items').insert(row).select('*').single()
  if (error) throw error
  return { item: data, duplicate: false }
}

// Runs the AI analysis for one item. Returns { item, collection, needs_details }.
export function analyzeItem(itemId) {
  return invokeFn('extract-content', { item_id: itemId })
}

// =====================================================================================
// Audio: voice notes & screen-recorded reels
// =====================================================================================

export const MAX_UPLOAD_BYTES = 24 * 1024 * 1024 // transcribe function's limit
const ALLOWED_AUDIO_EXT = ['webm', 'm4a', 'mp4', 'mp3', 'mpeg', 'mpga', 'wav', 'ogg', 'flac', 'mov']

export function recordingExt(mime = '') {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

export function pickRecorderMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  if (typeof window === 'undefined' || !window.MediaRecorder) return ''
  return candidates.find((t) => window.MediaRecorder.isTypeSupported?.(t)) || ''
}

function writeStr(view, offset, s) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
}

// 16-bit mono PCM WAV
function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(view, 8, 'WAVE')
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let o = 44
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

// Pulls the audio track out of a (possibly large) screen recording and shrinks it to
// 16 kHz mono WAV — a 60 s reel becomes ~2 MB instead of 30+ MB of video.
async function mediaToWav(file, { maxSeconds = 480, sampleRate = 16000 } = {}) {
  const AC = window.AudioContext || window.webkitAudioContext
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!AC || !OAC) throw new Error('unsupported')
  if (file.size > 400 * 1024 * 1024) throw new Error('too-large')
  const bytes = await file.arrayBuffer()
  const ctx = new AC()
  let decoded
  try {
    decoded = await ctx.decodeAudioData(bytes)
  } finally {
    try { await ctx.close() } catch { /* ignore */ }
  }
  const seconds = Math.min(decoded.duration, maxSeconds)
  const offline = new OAC(1, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start(0)
  const rendered = await offline.startRendering()
  return encodeWav(rendered.getChannelData(0), sampleRate)
}

// Uploads audio to the user's private folder, transcribes it, then deletes the audio.
// Only the text is kept — nothing sensitive lingers in storage.
export async function transcribeBlob(userId, blob, ext) {
  const path = `${userId}/tmp/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('knowledge-files')
    .upload(path, blob, { contentType: blob.type || undefined, upsert: false })
  if (upErr) throw new Error('Could not upload the recording: ' + upErr.message)
  try {
    const out = await invokeFn('transcribe', { path })
    return (out?.text || '').trim()
  } finally {
    try { await supabase.storage.from('knowledge-files').remove([path]) } catch { /* best effort */ }
  }
}

// Transcribes a user-picked video/audio file (e.g. a screen-recorded reel).
export async function transcribeMediaFile(userId, file) {
  let wav = null
  try {
    wav = await mediaToWav(file)
  } catch (err) {
    if (err.message === 'too-large') throw new Error('That recording is too large. Trim it to under a few minutes and try again.')
    // Browser couldn't decode it — fall back to sending the original if it's small enough.
  }
  if (wav) return transcribeBlob(userId, wav, 'wav')

  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_AUDIO_EXT.includes(ext)) throw new Error('Unsupported format. Use mp4, mov, m4a, mp3, wav or webm.')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Your browser couldn't compress that recording and it's over 24 MB. Try a shorter clip.")
  return transcribeBlob(userId, file, ext)
}

export function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Short, safe file name for storage paths.
export function safeFileName(name) {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'file'
  const ext = (dot > 0 ? name.slice(dot + 1) : '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase()
  return ext ? `${base}.${ext}` : base
}
