// =====================================================================
// Nexora Pro — single source of truth for pricing and what each plan includes.
//
// ⚠ PRICES: the numbers below are what the app DISPLAYS. They must exactly match
//   the products you create in Dodo Payments (USD) and Razorpay (INR). The server
//   decides what is actually charged — a mismatch here is a trust problem, not a
//   billing exploit. INR prices are proposals; set them to what you want to charge.
// ⚠ TRIAL: set TRIAL_DAYS to 0 to remove every trial mention from the app.
//   If it is > 0, the trial must also be configured in the provider products.
// =====================================================================
import { FREE, PRO } from '../journal/constants.js'

export const TRIAL_DAYS = 7

// Your headline. Keep it only while you can back it up (survey / in-app time-saved data).
export const PROOF_LINE = 'Join growth-seekers saving 14 hours every week.'

export const CURRENCIES = {
  INR: { code: 'INR', locale: 'en-IN', provider: 'razorpay', note: 'UPI and cards, processed by Razorpay.' },
  USD: { code: 'USD', locale: 'en-US', provider: 'dodo', note: 'Cards and wallets. Dodo Payments is the merchant of record and handles tax.' },
}

export const PRICES = {
  INR: { month: 499, year: 4999 },
  USD: { month: 13.99, year: 139.99 },
}

// Fill these in once your policy pages exist (Razorpay and Dodo both ask for them).
export const LEGAL = { terms: '', privacy: '', refunds: '' }

// Mirrors the limits enforced by the Edge Functions (the server is the boss).
const CHAT = { free: 15, pro: 150 }       // ai-chat
const PHYSICAL = { free: 3, pro: 12 }     // physical-ai: free per month, Pro per day

export const COMPARE = [
  ['AI Companion chat', `${CHAT.free} messages a day`, `${CHAT.pro} messages a day`],
  ['Ask your journal', null, 'Included'],
  ['AI weekly reflection', `${FREE.reflectionsPerMonth} a month`, 'Whenever you want'],
  ['Journal AI prompts', `${FREE.aiPromptsPerDay} a day`, `${PRO.aiPromptsPerDay} a day`],
  ['Folders', `${FREE.folders}`, 'Unlimited'],
  ['Private encrypted entries', `${FREE.privateEntries}`, 'Unlimited'],
  ['Insights: heatmap, mood, rhythm', null, 'Included'],
  ['Physical AI readings', `${PHYSICAL.free} a month`, `${PHYSICAL.pro} a day`],
  ['Experiments at once', '1', '3'],
]

// Outcome-first grouping. `keys` link each benefit to the paywall reason that sent the user here.
export const VALUE_GROUPS = [
  { id: 'clarity', title: 'See your own patterns', icon: 'brain', items: [
    { text: 'Ask your journal and get answers drawn from your own entries', keys: ['ask'] },
    { text: 'An AI reflection on your week, whenever you want one', keys: ['reflection'] },
    { text: 'Year heatmap, mood trend and weekly rhythm', keys: ['insights'] },
  ] },
  { id: 'private', title: 'Keep it private', icon: 'shield', items: [
    { text: 'Unlimited end-to-end encrypted entries', keys: ['private'] },
    { text: 'Private folders, and unlimited folders to organise them', keys: ['private_folders', 'folders'] },
  ] },
  { id: 'speed', title: 'Move faster', icon: 'zap', items: [
    { text: `${CHAT.pro} AI Companion messages a day, 10 times the free amount`, keys: [] },
    { text: `${PRO.aiPromptsPerDay} personalised journal prompts a day`, keys: ['prompts'] },
    { text: 'AI smart tags and mood detection', keys: ['smart_tags'] },
    { text: 'Premium writing templates', keys: ['templates'] },
  ] },
  { id: 'body', title: 'Understand your body', icon: 'heart', items: [
    { text: 'Possible reasons behind your patterns, tied to what they are based on', keys: ['reasons'] },
    { text: 'A doctor-visit summary you can copy or download', keys: ['visit'] },
    { text: 'Up to 3 experiments at once, and many more AI readings', keys: ['experiments', 'ai'] },
  ] },
]

// What the person was trying to do when they hit the paywall (shown back to them).
export const REASON_LABEL = {
  ask: 'Ask your journal', reflection: 'Weekly AI reflections', insights: 'Insights', private: 'More private entries',
  private_folders: 'Private folders', folders: 'More folders', prompts: 'More AI prompts', smart_tags: 'AI smart tags',
  templates: 'Premium templates', reasons: 'Reasons behind your patterns', visit: 'Doctor-visit summary',
  experiments: 'More experiments', ai: 'More AI readings',
}

export const PROVIDER_FOR = { INR: 'razorpay', USD: 'dodo' }

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

export function shortDate(d) {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
export function fullDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
