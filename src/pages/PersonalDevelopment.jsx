import { useEffect, useMemo, useState } from 'react'
import {
  Compass, Wrench, BookOpen, RefreshCw, Sparkles, Plus, Check, Brain, Dumbbell,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'

// ---- Curated content banks -------------------------------------------------
// Everything below is hand-written, rule-based personalization (filtered by
// the user's own onboarding goals), not AI-generated. No Groq/LLM dependency,
// so this works today regardless of the API-key issue elsewhere in the app.

const GOAL_CATEGORIES = [
  'Productivity', 'Financial Freedom', 'Health', 'Learning', 'Career Growth', 'Mindfulness', 'Creativity',
]

const PRINCIPLES = [
  { category: 'Productivity', principle: 'Start each day with the hardest task.', explanation: 'Eat the frog. Momentum builds early, and the rest of the day feels lighter.' },
  { category: 'Productivity', principle: 'Batch similar tasks together.', explanation: 'Context-switching has a real cost — group emails, calls, and admin into single blocks.' },
  { category: 'Productivity', principle: 'Protect your first 90 minutes.', explanation: 'Willpower is highest early on. Spend it on what matters, not your inbox.' },
  { category: 'Productivity', principle: "Define 'done' before you start.", explanation: 'Vague tasks expand to fill any amount of time. Know what finished looks like.' },
  { category: 'Productivity', principle: 'One list, not five.', explanation: 'Scattered task lists create scattered attention. Keep a single source of truth.' },
  { category: 'Financial Freedom', principle: 'Pay yourself first.', explanation: "Automate savings before you see the money — willpower is unreliable, automation isn't." },
  { category: 'Financial Freedom', principle: 'Track where it actually goes.', explanation: "You can't fix what you don't measure. A week of honest tracking beats any budget app." },
  { category: 'Financial Freedom', principle: 'Avoid lifestyle inflation.', explanation: 'When income rises, let savings rise faster than spending.' },
  { category: 'Financial Freedom', principle: 'Know your number.', explanation: "A vague goal like 'save more' rarely works. A specific target does." },
  { category: 'Financial Freedom', principle: 'Small leaks sink big ships.', explanation: 'Recurring subscriptions often cost more over a year than the big one-off decisions.' },
  { category: 'Health', principle: "Move before you decide not to.", explanation: 'Motivation follows action more often than it precedes it.' },
  { category: 'Health', principle: "Protect your sleep like a meeting you can't miss.", explanation: 'Nothing else compounds daily performance like consistent sleep.' },
  { category: 'Health', principle: 'Hydrate before you caffeinate.', explanation: 'Mild dehydration mimics fatigue. Water first, coffee second.' },
  { category: 'Health', principle: 'Make the healthy choice the easy choice.', explanation: 'Design your environment so good decisions need less willpower.' },
  { category: 'Health', principle: 'Progress, not perfection.', explanation: 'One skipped workout is a data point, not a failure.' },
  { category: 'Learning', principle: 'Teach it to understand it.', explanation: "If you can't explain it simply, you don't understand it yet." },
  { category: 'Learning', principle: 'Spaced repetition beats cramming.', explanation: 'Reviewing at increasing intervals builds durable memory.' },
  { category: 'Learning', principle: 'Read actively, not passively.', explanation: "Pause and ask 'what would I do with this?' — passive reading fades fast." },
  { category: 'Learning', principle: 'Follow curiosity, not just curricula.', explanation: 'Questions you generate yourself stick better than ones assigned to you.' },
  { category: 'Learning', principle: 'Struggle a little before you look it up.', explanation: 'Productive struggle strengthens the memory pathway you\u2019re building.' },
  { category: 'Career Growth', principle: "Make your manager's job easier.", explanation: 'Visible reliability compounds faster than occasional brilliance.' },
  { category: 'Career Growth', principle: 'Document your wins as they happen.', explanation: 'Memory fades. A running list makes performance reviews effortless.' },
  { category: 'Career Growth', principle: 'Ask for feedback before you need it.', explanation: 'Waiting for annual reviews means waiting a year to course-correct.' },
  { category: 'Career Growth', principle: 'Build in public, quietly.', explanation: 'Share progress, not just results — it builds trust over time.' },
  { category: 'Career Growth', principle: 'Your network is built before you need it.', explanation: 'Relationships formed under pressure feel transactional. Build early.' },
  { category: 'Mindfulness', principle: "Name the emotion, don't just feel it.", explanation: 'Labeling an emotion measurably reduces its intensity.' },
  { category: 'Mindfulness', principle: 'Breathe out longer than you breathe in.', explanation: 'A longer exhale directly activates your parasympathetic nervous system.' },
  { category: 'Mindfulness', principle: 'Notice without judging.', explanation: "Observing a thought as 'just a thought' creates distance from it." },
  { category: 'Mindfulness', principle: 'Single-task on purpose.', explanation: 'Multitasking is mostly rapid switching — pick one thing fully.' },
  { category: 'Mindfulness', principle: 'The present moment is the only one you can act in.', explanation: 'Rumination lives in the past, anxiety in the future.' },
  { category: 'Creativity', principle: 'Quantity breeds quality.', explanation: 'More reps means more chances to stumble into something great.' },
  { category: 'Creativity', principle: 'Steal like an artist.', explanation: 'Original work is usually a remix of influences, arranged in a new way.' },
  { category: 'Creativity', principle: 'Constraints fuel creativity.', explanation: 'A blank page is harder than a page with rules — give yourself boundaries.' },
  { category: 'Creativity', principle: 'Separate creation from editing.', explanation: 'Judging while generating kills ideas early. Create first, criticize later.' },
  { category: 'Creativity', principle: 'Boredom is a creative prerequisite.', explanation: 'Understimulation is often when your best unscheduled ideas surface.' },
]

const COMPASS_LINES = [
  { category: 'Productivity', line: 'Master the art of saying no to low-leverage tasks.' },
  { category: 'Productivity', line: 'Do the one thing that makes everything else easier.' },
  { category: 'Financial Freedom', line: 'Spend on what you value, cut everything else without guilt.' },
  { category: 'Financial Freedom', line: 'Automate today what future-you would forget to do.' },
  { category: 'Health', line: 'Treat your body like the only place you have to live.' },
  { category: 'Health', line: 'Small daily movement beats occasional heroics.' },
  { category: 'Learning', line: 'Ask one more question than feels comfortable today.' },
  { category: 'Learning', line: "Turn today's confusion into tomorrow's clarity." },
  { category: 'Career Growth', line: 'Make one relationship stronger today.' },
  { category: 'Career Growth', line: "Do the work that's easy to point to later." },
  { category: 'Mindfulness', line: 'Notice one thing fully before reacting to it.' },
  { category: 'Mindfulness', line: 'Let this moment be enough, just for now.' },
  { category: 'Creativity', line: 'Make something imperfect today — that\u2019s the whole point.' },
  { category: 'Creativity', line: 'Follow the idea that scares you a little.' },
]

const VOCAB_BANK = [
  { word: 'Ephemeral', ipa: 'ɪˈfɛm(ə)r(ə)l', meaning: 'Lasting a very short time.' },
  { word: 'Sycophant', ipa: 'ˈsɪkəfænt', meaning: 'A person who flatters to gain advantage.' },
  { word: 'Altruistic', ipa: 'ˌæltruˈɪstɪk', meaning: 'Showing selfless concern for others.' },
  { word: 'Ubiquitous', ipa: 'juːˈbɪkwɪtəs', meaning: 'Present or found everywhere.' },
  { word: 'Pragmatic', ipa: 'præɡˈmætɪk', meaning: 'Dealing with things sensibly and realistically.' },
  { word: 'Resilient', ipa: 'rɪˈzɪliənt', meaning: 'Able to recover quickly from difficulties.' },
  { word: 'Meticulous', ipa: 'mɪˈtɪkjʊləs', meaning: 'Showing great attention to detail.' },
  { word: 'Ambiguous', ipa: 'æmˈbɪɡjuəs', meaning: 'Open to more than one interpretation.' },
  { word: 'Candid', ipa: 'ˈkændɪd', meaning: 'Truthful and straightforward.' },
  { word: 'Diligent', ipa: 'ˈdɪlɪdʒənt', meaning: 'Showing careful and persistent effort.' },
  { word: 'Eloquent', ipa: 'ˈɛləkwənt', meaning: 'Fluent and persuasive in speaking or writing.' },
  { word: 'Frugal', ipa: 'ˈfruːɡəl', meaning: 'Economical, avoiding waste.' },
  { word: 'Gregarious', ipa: 'ɡrɪˈɡɛəriəs', meaning: 'Fond of company; sociable.' },
  { word: 'Harbinger', ipa: 'ˈhɑːrbɪndʒər', meaning: 'A sign of an approaching event.' },
  { word: 'Idiosyncratic', ipa: 'ˌɪdiəsɪŋˈkrætɪk', meaning: 'Peculiar to an individual.' },
  { word: 'Judicious', ipa: 'dʒuːˈdɪʃəs', meaning: 'Having good judgment; sensible.' },
  { word: 'Lucid', ipa: 'ˈluːsɪd', meaning: 'Clear and easy to understand.' },
  { word: 'Meander', ipa: 'miˈændər', meaning: 'To wander without a fixed direction.' },
  { word: 'Nostalgic', ipa: 'nɒˈstældʒɪk', meaning: 'Sentimental longing for the past.' },
  { word: 'Ostensible', ipa: 'ɒˈstɛnsəbəl', meaning: 'Appearing true, but not necessarily so.' },
  { word: 'Paradox', ipa: 'ˈpærədɒks', meaning: 'A statement that contradicts itself yet may be true.' },
  { word: 'Quintessential', ipa: 'ˌkwɪntɪˈsɛnʃəl', meaning: 'The most perfect example of a quality.' },
  { word: 'Reticent', ipa: 'ˈrɛtɪsənt', meaning: 'Not revealing thoughts or feelings readily.' },
  { word: 'Serendipity', ipa: 'ˌsɛrənˈdɪpɪti', meaning: 'Finding something good without looking for it.' },
  { word: 'Tenacious', ipa: 'tɪˈneɪʃəs', meaning: 'Holding firmly to a course of action.' },
  { word: 'Umbrage', ipa: 'ˈʌmbrɪdʒ', meaning: 'Offense or annoyance.' },
  { word: 'Vindicate', ipa: 'ˈvɪndɪkeɪt', meaning: 'To clear from blame with proof.' },
  { word: 'Wistful', ipa: 'ˈwɪstfʊl', meaning: 'Having vague or regretful longing.' },
  { word: 'Zeal', ipa: 'ziːl', meaning: 'Great energy or enthusiasm for a cause.' },
  { word: 'Cogent', ipa: 'ˈkoʊdʒənt', meaning: 'Clear, logical, and convincing.' },
  { word: 'Deference', ipa: 'ˈdɛfərəns', meaning: "Humble submission to another's opinion." },
  { word: 'Empirical', ipa: 'ɪmˈpɪrɪkəl', meaning: 'Based on observation rather than theory.' },
  { word: 'Fastidious', ipa: 'fæˈstɪdiəs', meaning: 'Very attentive to detail; hard to please.' },
  { word: 'Garrulous', ipa: 'ˈɡærələs', meaning: 'Excessively talkative.' },
  { word: 'Hackneyed', ipa: 'ˈhæknid', meaning: 'Overused and unoriginal.' },
  { word: 'Insidious', ipa: 'ɪnˈsɪdiəs', meaning: 'Proceeding harmfully in a gradual, subtle way.' },
  { word: 'Juxtapose', ipa: 'ˈdʒʌkstəpoʊz', meaning: 'To place side by side for contrasting effect.' },
  { word: 'Laconic', ipa: 'ləˈkɒnɪk', meaning: 'Using very few words.' },
  { word: 'Myriad', ipa: 'ˈmɪriəd', meaning: 'A very great number of things.' },
]

const MOOD_INSIGHTS = {
  stressed: [
    "Your recent entries lean stressed. One small, concrete task finished today can do more than a long to-do list.",
    "A few stressed entries in a row — worth naming the single biggest source before it blends into everything else.",
  ],
  reflective: [
    "You've been writing reflectively lately. That's a good sign — it usually means you're actually processing, not just venting.",
  ],
  happy: [
    "Recent entries skew happy. Worth noting what specifically contributed — it's easier to repeat what you can name.",
  ],
  neutral: [
    "Your entries have been fairly neutral. That's not a problem — steady is underrated.",
  ],
  excited: [
    "You've had a run of excited entries. Good momentum — just make sure at least one commitment behind it is written down.",
  ],
  default: [
    "Write a few journal entries and this card will start reflecting real patterns instead of a placeholder.",
  ],
}

function dayNumber() {
  return Math.floor(Date.now() / 86400000)
}

function pickPrincipleForGoals(goals, excludeKeys) {
  const pool = goals && goals.length ? PRINCIPLES.filter((p) => goals.includes(p.category)) : PRINCIPLES
  const usable = pool.filter((p) => !excludeKeys.has(p.principle))
  const source = usable.length ? usable : PRINCIPLES.filter((p) => !excludeKeys.has(p.principle))
  if (source.length === 0) return PRINCIPLES[Math.floor(Math.random() * PRINCIPLES.length)]
  return source[Math.floor(Math.random() * source.length)]
}

function todaysCompass(goals) {
  const pool = goals && goals.length ? COMPASS_LINES.filter((c) => goals.includes(c.category)) : COMPASS_LINES
  const source = pool.length ? pool : COMPASS_LINES
  return source[dayNumber() % source.length]
}

function todaysWords() {
  const d = dayNumber()
  const n = VOCAB_BANK.length
  const start = ((d * 5) % n + n) % n
  const picks = []
  for (let i = 0; i < 5 && i < n; i++) {
    picks.push(VOCAB_BANK[(start + i) % n])
  }
  return picks
}

function randomWords() {
  const shuffled = [...VOCAB_BANK].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 5)
}

export default function PersonalDevelopment({ session }) {
  const [tab, setTab] = useState('mental')
  const [goals, setGoals] = useState([])
  const [principles, setPrinciples] = useState([])
  const [words, setWords] = useState(() => todaysWords())
  const [learnedWords, setLearnedWords] = useState(new Set())
  const [habits, setHabits] = useState([])
  const [todayLogs, setTodayLogs] = useState({})
  const [newHabitName, setNewHabitName] = useState('')
  const [addingHabit, setAddingHabit] = useState(false)
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(true)

  const compass = useMemo(() => todaysCompass(goals), [goals])

  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      try {
        const [{ data: profile }, { data: activePrinciples }, { data: activeHabits }, { data: recentJournal }] =
          await Promise.all([
            supabase.from('profiles').select('goals').eq('id', session.user.id).single(),
            supabase
              .from('user_principles')
              .select('*')
              .eq('user_id', session.user.id)
              .eq('is_active', true)
              .order('created_at', { ascending: true }),
            supabase
              .from('habits')
              .select('*')
              .eq('user_id', session.user.id)
              .eq('is_active', true)
              .order('created_at', { ascending: true }),
            supabase
              .from('journal_entries')
              .select('mood')
              .eq('user_id', session.user.id)
              .order('entry_date', { ascending: false })
              .limit(15),
          ])

        const userGoals = profile?.goals || []
        setGoals(userGoals)

        let currentPrinciples = activePrinciples || []
        if (currentPrinciples.length < 3) {
          const need = 3 - currentPrinciples.length
          const excludeKeys = new Set(currentPrinciples.map((p) => p.principle))
          const toInsert = []
          for (let i = 0; i < need; i++) {
            const pick = pickPrincipleForGoals(userGoals, excludeKeys)
            excludeKeys.add(pick.principle)
            toInsert.push({
              user_id: session.user.id,
              principle: pick.principle,
              explanation: pick.explanation,
              category: pick.category,
              is_active: true,
              ai_generated: false,
            })
          }
          if (toInsert.length) {
            const { data: inserted } = await supabase.from('user_principles').insert(toInsert).select()
            currentPrinciples = [...currentPrinciples, ...(inserted || [])]
          }
        }
        setPrinciples(currentPrinciples)

        setHabits(activeHabits || [])
        if ((activeHabits || []).length) {
          const today = new Date().toISOString().slice(0, 10)
          const { data: logs } = await supabase
            .from('habit_logs')
            .select('habit_id, completed')
            .eq('user_id', session.user.id)
            .eq('log_date', today)
          const map = {}
          for (const l of logs || []) map[l.habit_id] = l.completed
          setTodayLogs(map)
        }

        const moods = (recentJournal || []).map((j) => j.mood).filter(Boolean)
        if (moods.length === 0) {
          setInsight(MOOD_INSIGHTS.default[0])
        } else {
          const counts = {}
          for (const m of moods) counts[m] = (counts[m] || 0) + 1
          const topMood = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
          const bank = MOOD_INSIGHTS[topMood] || MOOD_INSIGHTS.default
          setInsight(bank[dayNumber() % bank.length])
        }
      } catch (err) {
        console.warn('Personal Development load failed:', err.message)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id])

  async function getNewPrinciple(oldId) {
    const excludeKeys = new Set(principles.map((p) => p.principle))
    const pick = pickPrincipleForGoals(goals, excludeKeys)
    try {
      await supabase.from('user_principles').update({ is_active: false }).eq('id', oldId)
      const { data: inserted } = await supabase
        .from('user_principles')
        .insert({
          user_id: session.user.id,
          principle: pick.principle,
          explanation: pick.explanation,
          category: pick.category,
          is_active: true,
          ai_generated: false,
        })
        .select()
        .single()
      if (inserted) setPrinciples((prev) => prev.map((p) => (p.id === oldId ? inserted : p)))
    } catch (err) {
      console.warn('Could not swap principle:', err.message)
    }
  }

  async function toggleLearned(w) {
    const key = w.word
    const today = new Date().toISOString().slice(0, 10)
    const nowLearned = !learnedWords.has(key)
    setLearnedWords((prev) => {
      const next = new Set(prev)
      if (nowLearned) next.add(key)
      else next.delete(key)
      return next
    })
    try {
      const { data: existing } = await supabase
        .from('vocabulary_words')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('word', w.word)
        .eq('assigned_date', today)
        .maybeSingle()
      if (existing) {
        await supabase.from('vocabulary_words').update({ learned: nowLearned }).eq('id', existing.id)
      } else {
        await supabase.from('vocabulary_words').insert({
          user_id: session.user.id,
          word: w.word,
          meaning: w.meaning,
          assigned_date: today,
          learned: nowLearned,
        })
      }
    } catch (err) {
      console.warn('Could not save word progress:', err.message)
    }
  }

  async function addHabit() {
    const name = newHabitName.trim()
    if (!name || addingHabit) return
    setAddingHabit(true)
    try {
      const { data, error } = await supabase
        .from('habits')
        .insert({ user_id: session.user.id, name, category: 'general' })
        .select()
        .single()
      if (error) throw error
      setHabits((prev) => [...prev, data])
      setNewHabitName('')
    } catch (err) {
      console.warn('Could not add intention:', err.message)
    } finally {
      setAddingHabit(false)
    }
  }

  async function toggleHabit(habit) {
    const today = new Date().toISOString().slice(0, 10)
    const current = Boolean(todayLogs[habit.id])
    const next = !current
    setTodayLogs((prev) => ({ ...prev, [habit.id]: next }))
    try {
      await supabase
        .from('habit_logs')
        .upsert(
          { user_id: session.user.id, habit_id: habit.id, log_date: today, completed: next },
          { onConflict: 'user_id,habit_id,log_date' }
        )
      // Streak/completion_rate are recalculated server-side by a trigger — refetch to reflect it.
      const { data } = await supabase.from('habits').select('*').eq('id', habit.id).single()
      if (data) setHabits((prev) => prev.map((h) => (h.id === habit.id ? data : h)))
    } catch (err) {
      console.warn('Could not update intention:', err.message)
      setTodayLogs((prev) => ({ ...prev, [habit.id]: current }))
    }
  }

  return (
    <div>
      <header
        className="sticky top-0 z-40 bg-base-bg/80 backdrop-blur-xl px-md h-16 border-b border-base-border/50 flex items-center"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <h1 className="text-h2 text-ink-primary tracking-tight">Personal Growth</h1>
      </header>

      <main className="px-md pt-md pb-2xl flex flex-col gap-lg">
        {/* Mental / Physical toggle */}
        <div className="flex bg-base-surface p-1 rounded-full border border-base-border h-[46px] items-center">
          <button
            onClick={() => setTab('mental')}
            className={`flex-1 flex items-center justify-center gap-2 h-full rounded-full text-body-small font-semibold transition ${
              tab === 'mental' ? 'bg-primary text-base-bg shadow-sm' : 'text-ink-secondary'
            }`}
          >
            <Brain size={16} /> Mental
          </button>
          <button
            onClick={() => setTab('physical')}
            className={`flex-1 flex items-center justify-center gap-2 h-full rounded-full text-body-small font-semibold transition ${
              tab === 'physical' ? 'bg-primary text-base-bg shadow-sm' : 'text-ink-secondary'
            }`}
          >
            <Dumbbell size={16} /> Physical
          </button>
        </div>

        {tab === 'physical' ? (
          <div className="card p-lg text-center flex flex-col items-center gap-sm">
            <Dumbbell size={28} className="text-ink-tertiary" />
            <h3 className="text-h3 text-ink-primary">Physical is coming later</h3>
            <p className="text-body-small text-ink-secondary leading-relaxed max-w-xs">
              This needs its own onboarding (age, weight, activity level) that we haven't built yet — it's a
              separate, honest chunk of work rather than a quick add-on to this screen.
            </p>
          </div>
        ) : (
          <>
            {/* Today's Compass */}
            <section className="bg-base-surface rounded-card border border-base-border border-l-4 border-l-primary p-md flex flex-col gap-sm">
              <div className="flex items-center gap-2">
                <Compass size={18} className="text-primary" />
                <h3 className="text-h3 text-ink-primary">Today's Compass</h3>
              </div>
              <p className="text-body text-ink-primary leading-relaxed">{compass.line}</p>
              <p className="text-caption text-ink-secondary italic text-right">Based on your goals</p>
            </section>

            {/* Mental Toolkit */}
            <section className="flex flex-col gap-sm">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-secondary" />
                <h2 className="text-h3 text-ink-primary">Your Mental Toolkit</h2>
              </div>
              {loading ? (
                <div className="flex justify-center py-lg">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col gap-sm">
                  {principles.map((p) => (
                    <div key={p.id} className="card p-md flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-caption rounded-full border border-primary/20 w-max">
                          {p.category}
                        </span>
                        <button
                          onClick={() => getNewPrinciple(p.id)}
                          aria-label="Get a different principle"
                          className="text-ink-tertiary hover:text-primary transition"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                      <h4 className="text-body font-semibold text-ink-primary">{p.principle}</h4>
                      <p className="text-body-small text-ink-secondary">{p.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Daily Vocabulary */}
            <section className="bg-base-elevated rounded-card border border-base-border/50 p-md flex flex-col gap-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-ink-secondary" />
                  <h3 className="text-body font-semibold text-ink-primary">5 New Words</h3>
                </div>
                <button
                  onClick={() => setWords(randomWords())}
                  aria-label="Refresh words"
                  className="text-ink-secondary hover:text-primary transition"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {words.map((w) => {
                  const isLearned = learnedWords.has(w.word)
                  return (
                    <button
                      key={w.word}
                      onClick={() => toggleLearned(w)}
                      className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-2 text-left transition ${
                        isLearned ? 'bg-success/10 border-success/30' : 'bg-base-surface border-base-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-body-small font-medium text-ink-primary">{w.word}</span>
                          <span className="text-caption text-ink-secondary">/{w.ipa}/</span>
                        </div>
                        <span className="text-caption text-ink-secondary">{w.meaning}</span>
                      </div>
                      {isLearned && <Check size={16} className="text-success shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Today's Intentions (habits) */}
            <section className="flex flex-col gap-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-warning" />
                  <h2 className="text-h3 text-ink-primary">Today's Intentions</h2>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {habits.map((h) => {
                  const on = Boolean(todayLogs[h.id])
                  return (
                    <button
                      key={h.id}
                      onClick={() => toggleHabit(h)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition ${
                        on ? 'bg-base-surface border-primary/30' : 'bg-base-surface border-base-border opacity-70'
                      }`}
                    >
                      <span className={`text-body ${on ? 'text-ink-primary' : 'text-ink-secondary'}`}>{h.name}</span>
                      <div className="flex items-center gap-sm">
                        {h.streak > 0 && <span className="text-caption text-ink-tertiary">{h.streak}d streak</span>}
                        <div
                          className={`w-10 h-5 rounded-full relative transition ${on ? 'bg-primary shadow-glow' : 'bg-base-elevated'}`}
                        >
                          <div
                            className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                              on ? 'right-1 bg-base-bg' : 'left-1 bg-ink-secondary'
                            }`}
                          />
                        </div>
                      </div>
                    </button>
                  )
                })}
                <div className="flex gap-2 mt-1">
                  <input
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addHabit()}
                    placeholder="Add an intention…"
                    className="input flex-1 py-2.5"
                  />
                  <button
                    onClick={addHabit}
                    disabled={!newHabitName.trim() || addingHabit}
                    className="w-11 h-11 shrink-0 rounded-input bg-primary text-base-bg flex items-center justify-center disabled:opacity-40"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
              <p className="text-center text-caption text-ink-secondary mt-1 opacity-80">
                Set intentions, not obligations. Progress over perfection.
              </p>
            </section>

            {/* Insight */}
            {insight && (
              <section className="card p-md border-t-2 border-t-primary">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles size={16} className="text-primary" />
                  </div>
                  <h3 className="text-body font-semibold text-ink-primary">Insight</h3>
                </div>
                <p className="text-body-small text-ink-primary leading-relaxed opacity-90">{insight}</p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
