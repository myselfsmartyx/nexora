// =====================================================================
// Nexora Pro: single source of truth for pricing, limits and the sales copy.
//
// ONE provider (Dodo Payments, merchant of record) handles UPI, Indian cards and
// every other country, so there is one price list. The page picks a display
// currency automatically (no India/Worldwide switch).
//
// ⚠ PRICES here are what the app DISPLAYS. Create four products in Dodo with exactly
//   these amounts (INR amounts as tax-inclusive). The server decides what is charged.
// ⚠ TRIAL: set TRIAL_DAYS to 0 to remove every trial mention. If > 0, the trial
//   must also be configured on the Dodo products.
// =====================================================================
import { FREE, PRO } from '../journal/constants.js'

export const TRIAL_DAYS = 7

// Hero copy. PROOF_LINE is a factual claim: keep it only while you can back it up.
export const HEADLINE_LEAD = 'Turn everything you save into'
export const HEADLINE_ACCENT = 'who you become.'
export const PROOF_LINE = 'Join growth-seekers saving 14 hours every week.'

export const CURRENCIES = {
  INR: { code: 'INR', locale: 'en-IN' },
  USD: { code: 'USD', locale: 'en-US' },
}

// Near-parity: Rs1,299 is about 3% under $13.99 at today's rate, so nobody is
// "the expensive region" and there is no reason to switch currency to save money.
export const PRICES = {
  INR: { month: 1299, year: 12999 },
  USD: { month: 13.99, year: 139.99 },
}

// Fill these in once your policy pages exist (Dodo asks for them).
export const LEGAL = { terms: '', privacy: '', refunds: '' }

// Mirrors the limits enforced by the Edge Functions (the server is the boss).
export const CAPTURE = { free: 20, pro: 200 }   // extract-content, per day
const CHAT = { free: 15, pro: 150 }              // ai-chat, per day
const PHYSICAL = { free: 3, pro: 12 }            // physical-ai: free per month, Pro per day

export const COMPARE = [
  ['Smart Capture analysis', `${CAPTURE.free} a day`, `${CAPTURE.pro} a day`],
  ['AI Companion chat', `${CHAT.free} messages a day`, `${CHAT.pro} messages a day`],
  ['Ask your journal', null, 'Included'],
  ['AI weekly reflection', `${FREE.reflectionsPerMonth} a month`, 'Whenever you want'],
  ['Journal AI prompts', `${FREE.aiPromptsPerDay} a day`, `${PRO.aiPromptsPerDay} a day`],
  ['Neuro+ Brain Progress', 'Best scores', 'Trends and weekly report'],
  ['Insights: heatmap, mood, rhythm', null, 'Included'],
  ['Folders', `${FREE.folders}`, 'Unlimited'],
  ['Private encrypted entries', `${FREE.privateEntries}`, 'Unlimited'],
  ['Physical AI readings', `${PHYSICAL.free} a month`, `${PHYSICAL.pro} a day`],
]

// Pain -> transformation. Every promise maps to something the app really does.
// `keys` link a story to the paywall reason that sent the person here.
export const STORIES = [
  { id: 'capture', icon: 'inbox', proOnly: false,
    pain: 'The reels and links you saved and never opened again.',
    gain: 'Send Nexora a reel, link, article or voice note. It pulls out the tools, links and next steps, then files it for you.',
    proof: `${CAPTURE.pro} AI captures a day, 10 times the free amount`, keys: ['capture'] },
  { id: 'ask', icon: 'brain', proOnly: true,
    pain: 'Notes you wrote once and could never find again.',
    gain: 'Ask your journal anything and get answers in your own words, from your own life.',
    proof: `Ask your journal, plus ${CHAT.pro} AI Companion messages a day`, keys: ['ask', 'prompts'] },
  { id: 'neuro', icon: 'zap', proOnly: true,
    pain: 'Free time that quietly disappears into the scroll.',
    gain: 'Neuro+ shows your memory, focus and speed getting sharper, week after week.',
    proof: 'Brain Progress: trends, records and a weekly brain report', keys: ['neuro'] },
  { id: 'patterns', icon: 'chart', proOnly: true,
    pain: 'Good weeks and bad weeks, and no idea why.',
    gain: 'See your rhythm, your moods and what moves them, then get an AI reflection on your week.',
    proof: 'Year heatmap, mood trend, weekly rhythm and AI reflections', keys: ['insights', 'reflection'] },
  { id: 'private', icon: 'shield', proOnly: false,
    pain: 'Holding back because it is too personal to write down.',
    gain: 'Write the real thing. Private entries are end-to-end encrypted, so only you can read them.',
    proof: 'Unlimited private entries and folders, smart tags and premium templates', keys: ['private', 'private_folders', 'folders', 'smart_tags', 'templates'] },
  { id: 'body', icon: 'heart', proOnly: false,
    pain: 'Symptoms you cannot explain when you finally see a doctor.',
    gain: 'Physical turns your patterns into possible reasons and a visit summary, each tied to the data behind it.',
    proof: 'Reasons, doctor-visit summary, 3 experiments and many more AI readings', keys: ['reasons', 'visit', 'experiments', 'ai'] },
]

// What the person was trying to do when they hit the paywall (shown back to them).
export const REASON_LABEL = {
  capture: 'More Smart Capture', neuro: 'Brain Progress', ask: 'Ask your journal', reflection: 'Weekly AI reflections',
  insights: 'Insights', private: 'More private entries', private_folders: 'Private folders', folders: 'More folders',
  prompts: 'More AI prompts', smart_tags: 'AI smart tags', templates: 'Premium templates',
  reasons: 'Reasons behind your patterns', visit: 'Doctor-visit summary', experiments: 'More experiments', ai: 'More AI readings',
}

export function detectCurrency() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'INR'
  } catch { /* fall through */ }
  return 'USD'
}

export function money(amount, currency) {
  const { locale, code } = CURRENCIES[currency]
  const whole = currency === 'INR'
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: code,
    minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2,
  }).format(amount)
}

// Everything below is computed from PRICES so the savings shown can never drift from the real numbers.
export const yearlyPerMonth = (c) => PRICES[c].year / 12
export const yearlyPerDay = (c) => PRICES[c].year / 365
export const savingsPercent = (c) => Math.round((1 - PRICES[c].year / (PRICES[c].month * 12)) * 100)

// Dates are always computed from "now", never typed in. Calendar-day arithmetic
// (not 24h blocks) so a daylight-saving change can never shift a date by one.
export function addDays(fromMs, n) {
  const d = new Date(fromMs)
  d.setDate(d.getDate() + n)
  return d
}
export function shortDate(d) {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
export function fullDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
