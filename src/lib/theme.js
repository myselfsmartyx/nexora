// Theme engine: mode (system | dark | light) + accent color.
// Colors live in CSS variables (see index.css); this module only sets them.

const CACHE_KEY = 'nexora_theme_v2' // v2: discards the earlier 'system' default
const DEFAULT_ACCENT = '#00D4AA'
const HEX = /^#[0-9a-fA-F]{6}$/

export const ACCENTS = [
  { hex: '#00D4AA', label: 'Teal' },
  { hex: '#6366F1', label: 'Indigo' },
  { hex: '#A855F7', label: 'Violet' },
  { hex: '#F43F5E', label: 'Rose' },
  { hex: '#F59E0B', label: 'Amber' },
  { hex: '#38BDF8', label: 'Sky' },
]

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}
const shade = (rgb, f) => rgb.map((c) => Math.round(c * f))

export function resolveMode(mode) {
  if (mode === 'light' || mode === 'dark') return mode
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

let current = { mode: 'dark', accent: DEFAULT_ACCENT }

export function applyTheme({ mode = 'dark', accent = DEFAULT_ACCENT } = {}) {
  // Nexora is designed dark-first: anything unknown falls back to dark, never to the OS setting.
  const safeMode = ['system', 'dark', 'light'].includes(mode) ? mode : 'dark'
  const safeAccent = HEX.test(accent) ? accent : DEFAULT_ACCENT
  current = { mode: safeMode, accent: safeAccent }

  const resolved = resolveMode(safeMode)
  const root = document.documentElement
  let rgb = hexToRgb(safeAccent)
  // Bright accents are unreadable as text on white, so deepen them in light mode.
  if (resolved === 'light') rgb = shade(rgb, 0.68)

  root.dataset.theme = resolved
  root.classList.toggle('dark', resolved === 'dark')
  root.style.setProperty('--c-primary', rgb.join(' '))
  root.style.setProperty('--c-primary-dark', shade(rgb, 0.87).join(' '))

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#F6F8FA' : '#0A0A0F')

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(current))
  } catch {
    /* storage can be blocked — theme still applies for this session */
  }
}

// Called once at startup, before React renders.
export function initTheme() {
  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
  } catch {
    /* ignore */
  }
  applyTheme(saved || {})
  try {
    // Follow the OS when the user chose "System".
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (current.mode === 'system') applyTheme(current)
    })
  } catch {
    /* older browsers */
  }
}
