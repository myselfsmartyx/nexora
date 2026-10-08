// Physical section — vocabulary and curated content. Everything here works with NO AI call:
// the AI refines and personalises, but the section is useful (and safe) without it.

export const GOALS = [
  { id: 'general', label: 'General health', desc: 'Overall wellness and longevity.' },
  { id: 'energy', label: 'Better energy', desc: 'More stamina for ordinary days.' },
  { id: 'posture', label: 'Better posture', desc: 'Feel less stiff and compressed.' },
  { id: 'strength', label: 'Get stronger', desc: 'Lift, carry and push more.' },
  { id: 'muscle', label: 'Build muscle', desc: 'Increase lean mass over time.' },
  { id: 'fat', label: 'Lose fat', desc: 'Gradual, sustainable change.' },
]
export const ACTIVITY = [
  { id: 'sedentary', label: 'Mostly sitting', desc: 'Little movement most days' },
  { id: 'light', label: 'Light activity', desc: 'Occasional walks or movement' },
  { id: 'regular', label: 'Regular exercise', desc: 'Active most weeks' },
  { id: 'athlete', label: 'Athlete-level', desc: 'High output, structured training' },
]
export const BODY = [
  { id: 'very_slim', label: 'Very slim' },
  { id: 'slim', label: 'Slim' },
  { id: 'average', label: 'Average' },
  { id: 'athletic', label: 'Athletic' },
  { id: 'heavier', label: 'Carrying extra weight' },
  { id: 'much_heavier', label: 'Much heavier' },
]
export const LIMITS = [
  { id: 'back', label: 'Back' },
  { id: 'knees', label: 'Knees' },
  { id: 'joints', label: 'Other joints' },
  { id: 'heart', label: 'Heart / blood pressure' },
  { id: 'breathing', label: 'Breathing' },
  { id: 'pregnancy', label: 'Pregnancy / postpartum' },
  { id: 'recovering', label: 'Recent injury or surgery' },
]
export const FEEL = [
  { id: 'energised', label: 'Energised' }, { id: 'light', label: 'Light' }, { id: 'strong', label: 'Strong' },
  { id: 'okay', label: 'Okay' }, { id: 'tired', label: 'Tired' }, { id: 'heavy', label: 'Heavy' },
  { id: 'stiff', label: 'Stiff' }, { id: 'sore', label: 'Sore' }, { id: 'wired', label: 'Wired' }, { id: 'pain', label: 'Pain' },
]
export const ENERGY_LABELS = ['Drained', 'Low', 'Okay', 'Good', 'Great']
export const SLEEP_LABELS = ['Poor', 'Restless', 'Okay', 'Good', 'Deep']
export const ACTIVITY_WEEK = ['Barely moved', 'A little', 'Fairly active', 'Very active']
export const KINDS = {
  move: { label: 'Move', emoji: '🚶' }, rest: { label: 'Rest', emoji: '🌙' }, food: { label: 'Food', emoji: '🍽️' },
  posture: { label: 'Posture', emoji: '🧍' }, connect: { label: 'People', emoji: '🤝' }, offline: { label: 'Offline', emoji: '📵' },
  nature: { label: 'Outside', emoji: '🌳' }, play: { label: 'Play', emoji: '🎈' },
}
export const OUTCOMES = [
  { id: 'clear', label: 'Yes, clearly' }, { id: 'slight', label: 'A little' },
  { id: 'none', label: 'Not really' }, { id: 'unsure', label: "Can't tell" },
]

// Curated one-week experiments. `signals` = journal themes that make it more relevant;
// `avoid` = limits that rule it out. The AI may propose others; this is the offline fallback.
export const LIBRARY = [
  { id: 'walk-after-meal', title: 'A 10-minute walk after your biggest meal', why: 'Easy to repeat, and a gentle way to steady energy through the afternoon.', minutes: 10, kind: 'move', goals: ['general', 'energy', 'fat'], signals: ['tired', 'screen'], avoid: ['recovering'] },
  { id: 'phone-call-walk', title: 'Walk while you take one phone call a day', why: 'Movement that costs no extra time.', minutes: 10, kind: 'move', goals: ['general', 'energy', 'fat'], signals: ['screen', 'work'], avoid: ['recovering'] },
  { id: 'stand-hourly', title: 'Stand and move for 2 minutes after each hour of sitting', why: 'Breaks up long sitting, which stiffens hips and back.', minutes: 2, kind: 'posture', goals: ['posture', 'general', 'energy'], signals: ['pain', 'work', 'screen'], avoid: [] },
  { id: 'wake-stretch', title: 'Two slow minutes of stretching when you get up', why: 'A small, repeatable anchor for a stiff body.', minutes: 2, kind: 'posture', goals: ['posture', 'general'], signals: ['pain'], avoid: [] },
  { id: 'neck-reset', title: 'Shoulder rolls and chin tucks, twice a day', why: 'Counteracts the forward-head posture that comes with screens.', minutes: 2, kind: 'posture', goals: ['posture'], signals: ['pain', 'screen'], avoid: [] },
  { id: 'pushups-2x', title: 'Two short strength sessions this week (push, pull or squat variations you can do well)', why: 'Two honest sessions a week is enough to start building strength.', minutes: 20, kind: 'move', goals: ['strength', 'muscle'], signals: [], avoid: ['heart', 'recovering', 'pregnancy'] },
  { id: 'protein-breakfast', title: 'Add a protein source to breakfast', why: 'Helps fullness and supports muscle — one change, not a diet.', minutes: 5, kind: 'food', goals: ['muscle', 'fat', 'strength', 'energy'], signals: [], avoid: [] },
  { id: 'water-first', title: 'A glass of water before your first coffee or tea', why: 'A tiny cue that often lifts the morning fog.', minutes: 1, kind: 'food', goals: ['energy', 'general'], signals: ['tired'], avoid: [] },
  { id: 'slow-meal', title: 'Eat one meal a day slowly, without a screen', why: 'Notice fullness and enjoy the food — no rules about what to eat.', minutes: 20, kind: 'food', goals: ['fat', 'general'], signals: ['screen', 'work'], avoid: [] },
  { id: 'same-wake', title: 'Wake up at about the same time all week (within 30 minutes)', why: 'A steady body clock is one of the cheapest energy upgrades.', minutes: 1, kind: 'rest', goals: ['energy', 'general'], signals: ['tired'], avoid: [] },
  { id: 'screens-off', title: 'Screens away 30 minutes before bed', why: 'Gives your mind a runway to sleep.', minutes: 30, kind: 'rest', goals: ['energy', 'general'], signals: ['tired', 'screen'], avoid: [] },
  { id: 'caffeine-cutoff', title: 'No caffeine after 2 pm', why: 'Caffeine lingers for hours; this often improves sleep within days.', minutes: 1, kind: 'rest', goals: ['energy', 'general'], signals: ['tired'], avoid: [] },
  { id: 'morning-light', title: 'Ten minutes of daylight within an hour of waking', why: 'Morning light anchors your sleep and your mood.', minutes: 10, kind: 'nature', goals: ['energy', 'general'], signals: ['tired'], avoid: [] },
  { id: 'green-20', title: 'Twenty minutes somewhere green, once this week', why: 'Time outside lowers stress in ways a gym session does not.', minutes: 20, kind: 'nature', goals: ['general', 'energy'], signals: ['work', 'screen'], avoid: [] },
  { id: 'phone-free-walk', title: 'One walk with your phone left at home', why: 'Presence, not performance.', minutes: 20, kind: 'offline', goals: ['general', 'energy'], signals: ['screen', 'work'], avoid: [] },
  { id: 'phone-out-bedroom', title: 'Charge your phone outside the bedroom', why: 'Easier sleep, calmer mornings.', minutes: 1, kind: 'offline', goals: ['energy', 'general'], signals: ['tired', 'screen'], avoid: [] },
  { id: 'call-no-agenda', title: 'Call someone you like, with no agenda', why: 'Closeness is part of health; it needs time more than effort.', minutes: 15, kind: 'connect', goals: ['general'], signals: ['work', 'isolated'], avoid: [] },
  { id: 'shared-meal', title: 'Share one meal this week with another person', why: 'Food tastes better — and lasts longer — with company.', minutes: 40, kind: 'connect', goals: ['general'], signals: ['isolated'], avoid: [] },
  { id: 'dance-song', title: 'Dance to one song a day, badly', why: 'Movement without a goal. Counts.', minutes: 4, kind: 'play', goals: ['general', 'energy'], signals: ['work'], avoid: ['recovering'] },
  { id: 'fun-hour', title: 'One hour this week that is purely for fun and produces nothing', why: 'Rest of the kind that actually refills you.', minutes: 60, kind: 'play', goals: ['general', 'energy'], signals: ['work'], avoid: [] },
]

// Journal themes (keyword families) → used locally for signals and for the human-side nudges.
export const THEMES = {
  tired: /\b(insomnia|sleepless|can'?t sleep|couldn'?t sleep|didn'?t sleep|slept (badly|poorly)|tired|exhausted|drained|fatigue|sleepy|burn(ed|t)?[- ]?out|no energy)\b/i,
  pain: /\b(pain|ache|aching|aches|sore|stiff|stiffness|backache|back pain|neck|knee|shoulder|headache|migraine|cramp|cramps|sciatica)\b/i,
  moved: /\b(walk|walked|walking|run|ran|running|gym|workout|exercise|exercised|yoga|stretch|stretched|swim|swam|cycling|cycled|lifted|training|hike|hiked|cricket|football|badminton|sport)\b/i,
  people: /\b(friend|friends|family|mom|mum|dad|mother|father|sister|brother|wife|husband|partner|girlfriend|boyfriend|cousin|parents|grandma|grandpa|called|caught up|hung out|dinner with|met up)\b/i,
  outdoors: /\b(park|garden|beach|river|forest|hill|hills|mountain|trek|outdoor|outdoors|sunrise|sunset|nature|fresh air|rain|lake)\b/i,
  work: /\b(deadline|meeting|meetings|client|boss|overtime|workload|launch|sprint|busy|overwhelmed|backlog|burnout|productive|productivity|hustle|grind)\b/i,
  screen: /\b(scroll|scrolling|reels|youtube|doomscroll|screen time|netflix|phone addiction|on my phone)\b/i,
  fun: /\b(fun|laughed|laugh|played|game night|movie|music|danced|party|trip|holiday|vacation|joke)\b/i,
}

// Human-side nudges. Plain, specific, never motivational. {id, needs(signals) → bool}
export const NUDGES = [
  { id: 'busy-list', text: 'The last few weeks read like a to-do list. Nothing wrong with that, but not much in there was just for you.', action: 'Take 30 minutes with no goal', kind: 'play', when: (s) => s.work.recent >= 3 && s.fun.recent === 0 },
  { id: 'no-people', text: 'You haven’t mentioned anyone close to you in a while. A message with no agenda counts.', action: 'Send one message to someone', kind: 'connect', when: (s) => s.n >= 6 && s.people.recent === 0 },
  { id: 'indoors', text: 'It sounds like mostly indoors lately. Twenty minutes under open sky tends to reset more than it should.', action: 'Go outside for 20 minutes', kind: 'nature', when: (s) => s.n >= 6 && s.outdoors.recent === 0 },
  { id: 'screens', text: 'Screens come up a lot. Your eyes and neck would probably vote for a walk with neither.', action: 'Walk without your phone', kind: 'offline', when: (s) => s.screen.recent >= 2 },
  { id: 'tired-often', text: 'You’ve written “tired” more than once. Tonight, maybe nothing productive.', action: 'Do one thing slowly tonight', kind: 'rest', when: (s) => s.tired.recent >= 2 },
  { id: 'nothing-good', text: 'It’s been a while since you wrote about something that just felt good. Notice one thing today and leave it unimproved.', action: 'Notice one good thing', kind: 'play', when: (s) => s.n >= 8 && s.fun.recent === 0 && s.people.recent === 0 },
  { id: 'moved-lately', text: 'You’ve been moving lately — and writing about it. Worth noticing what that’s doing for your mood.', action: null, kind: 'move', when: (s) => s.moved.recent >= 3 },
  { id: 'unscheduled', text: 'A day with no plan and no optimising is worth putting in the calendar precisely because it’s empty.', action: 'Pick one unplanned afternoon', kind: 'play', when: (s) => s.work.recent >= 2 },
]

// Shown when there is almost no data. Calm, true, short.
export const QUIET_LINES = [
  'No streaks here. Gaps are normal, and nothing resets.',
  'You can ignore this section for a month and come back to exactly where you were.',
  'A body changes slowly. A few honest snapshots a year beat a daily number.',
  'Enough is a real amount.',
]
