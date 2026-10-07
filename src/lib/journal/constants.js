// Single source of truth for the Journal: moods, colors, plan limits, prompts, templates.

export const MOODS = [
  { id: 'happy', emoji: '🙂', label: 'Happy', color: '#10B981' },
  { id: 'excited', emoji: '🤩', label: 'Excited', color: '#F59E0B' },
  { id: 'reflective', emoji: '🤔', label: 'Reflective', color: '#6366F1' },
  { id: 'neutral', emoji: '😐', label: 'Neutral', color: '#8B949E' },
  { id: 'stressed', emoji: '😣', label: 'Stressed', color: '#EF4444' },
]
export const moodInfo = (id) => MOODS.find((m) => m.id === id) || null

// Tag + folder palette (readable on dark AND light themes when used as text on a 15% tint)
export const PALETTE = [
  '#00D4AA', '#10B981', '#84CC16', '#F59E0B', '#F97316', '#EF4444',
  '#EC4899', '#A855F7', '#6366F1', '#3B82F6', '#06B6D4', '#94A3B8',
]
export const FOLDER_EMOJIS = ['📓', '💼', '🌱', '🧠', '❤️', '🎯', '✈️', '💡', '📚', '🏃', '🎨', '🙏', '💰', '🏠', '🌙', '⭐']

export function hashColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// ---- Plan limits. These mirror the database triggers / Edge Function (the server is the boss). ----
export const FREE = {
  folders: 3,
  privateEntries: 5,
  aiPromptsPerDay: 5,
  reflectionsPerMonth: 1,
}
export const PRO = { aiPromptsPerDay: 60 }

export const SORTS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'edited', label: 'Recently edited' },
  { id: 'longest', label: 'Longest first' },
  { id: 'title', label: 'Title A–Z' },
]

export const MAX_TAGS_PER_ENTRY = 20
export const MAX_PRIVATE_CHARS = 30000 // ciphertext is ~4/3 larger and must stay under the 50k column limit
export const MAX_CHARS = 50000

export function normalizeTag(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[,;()'"`<>{}\\]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 30)
}

// ---- Prompt library (offline fallback; also the "daily prompt") ----
export const PROMPT_BANK = [
  'What went better than expected today?',
  'What are you avoiding right now, and why?',
  'Describe a moment today when you felt fully focused.',
  'What is one thing you learned this week that changed your mind?',
  'Who did you help today, or who helped you?',
  'What would make tomorrow 10% better than today?',
  'What decision are you putting off, and what is the smallest step forward?',
  "What's a small win you haven't given yourself credit for?",
  'If today had a headline, what would it say?',
  'What drained your energy today, and what gave you energy?',
  "What's a belief you hold that you rarely question?",
  'What would you do this week if you knew you could not fail?',
  'Which relationship deserves more of your attention right now?',
  'What are you tolerating that you could change?',
  'What did you spend time on today that you would not repeat?',
  'What does your ideal ordinary day look like in a year?',
  'What worry is taking up space that will not matter in a month?',
  'What did you do today that your future self will thank you for?',
  'What are you most curious about lately?',
  'When did you feel most like yourself this week?',
  'What advice would you give a friend in your exact situation?',
  'What is one thing you can let go of?',
  'What skill would change the next year of your life if you built it?',
  'What are three things that went right today, and why?',
  'What did you notice today that you usually overlook?',
  'What is the hardest part of what you are working on, honestly?',
  'Where did you say yes when you meant no?',
  'What would you tell yourself one year ago?',
]

export function dailyPrompt(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const n = Math.floor(Date.UTC(y, m - 1, d) / 86400000)
  return PROMPT_BANK[n % PROMPT_BANK.length]
}
export function randomPrompt(exclude) {
  const pool = PROMPT_BANK.filter((p) => p !== exclude)
  return pool[Math.floor(Math.random() * pool.length)]
}

// ---- Templates. pro:true ones are Pro-only (applying one is gated in the UI). ----
export const TEMPLATES = [
  { id: 'blank', emoji: '📝', name: 'Blank page', desc: 'Just you and the page', title: '', body: '', tags: [] },
  { id: 'daily', emoji: '🌅', name: 'Daily review', desc: 'Wins, challenges, tomorrow', title: 'Daily review', tags: ['daily'],
    body: 'Wins today\n- \n\nChallenges\n- \n\nWhat I learned\n- \n\nTomorrow\'s top priority\n- ' },
  { id: 'gratitude', emoji: '🙏', name: 'Gratitude', desc: 'Three good things', title: 'Gratitude', tags: ['gratitude'],
    body: 'Three things I\'m grateful for today:\n1. \n2. \n3. \n\nWhy the best one mattered:\n' },
  { id: 'braindump', emoji: '🌪️', name: 'Brain dump', desc: 'Clear your head, no rules', title: 'Brain dump', tags: ['brain-dump'],
    body: 'Everything on my mind right now (no editing):\n\n\nThe one thing that matters most from the above:\n' },
  { id: 'weekly', emoji: '📅', name: 'Weekly review', desc: 'Reset and plan the week', pro: true, title: 'Weekly review', tags: ['weekly'],
    body: 'Highlights of the week\n- \n\nWhat didn\'t go well\n- \n\nWhat I\'ll change\n- \n\nNext week\'s 3 priorities\n1. \n2. \n3. ' },
  { id: 'goal', emoji: '🎯', name: 'Goal check-in', desc: 'Progress, blockers, next move', pro: true, title: 'Goal check-in', tags: ['goals'],
    body: 'The goal:\n\nProgress since last check-in:\n\nWhat\'s blocking me:\n\nThe next smallest action (and when):\n' },
  { id: 'decision', emoji: '⚖️', name: 'Decision log', desc: 'Think it through, record why', pro: true, title: 'Decision log', tags: ['decisions'],
    body: 'The decision:\n\nOptions:\n1. \n2. \n\nWhat matters most here:\n\nMy choice and why:\n\nWhat would change my mind:\n\nReview this on: ' },
  { id: 'reframe', emoji: '🔄', name: 'Thought reframe', desc: 'Challenge a stuck thought', pro: true, title: 'Thought reframe', tags: ['mindset'],
    body: 'The situation:\n\nThe thought I keep having:\n\nEvidence for it:\n\nEvidence against it:\n\nA fairer, more balanced thought:\n' },
  { id: 'learning', emoji: '📚', name: 'Learning log', desc: 'Capture and apply a lesson', pro: true, title: 'Learning log', tags: ['learning'],
    body: 'What I learned:\n\nIn my own words:\n\nHow I\'ll apply it this week:\n' },
  { id: 'idea', emoji: '💡', name: 'Idea lab', desc: 'Develop an idea fast', pro: true, title: 'Idea lab', tags: ['ideas'],
    body: 'The idea:\n\nWho it helps / why it matters:\n\nFirst experiment (small, cheap):\n\nBiggest risk:\n' },
  { id: 'dream', emoji: '🌙', name: 'Dream log', desc: 'Capture it before it fades', pro: true, title: 'Dream log', tags: ['dreams'],
    body: 'What I remember:\n\nHow it felt:\n\nPeople / places / symbols:\n' },
  { id: 'relationship', emoji: '🤝', name: 'Relationship reflection', desc: 'Understand an interaction', pro: true, title: 'Relationship reflection', tags: ['relationships'],
    body: 'Who and what happened:\n\nHow I felt:\n\nWhat I needed:\n\nWhat I could say or do next:\n' },
]
