import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

// The 15 personalization questions (from product spec).
// type: 'multi' = pick several chips | 'single' = pick one chip | 'text' = free input
const QUESTIONS = [
  {
    id: 'goals',
    title: 'What are your top 3 goals?',
    type: 'multi',
    max: 3,
    options: ['Productivity', 'Financial Freedom', 'Health', 'Learning', 'Career Growth', 'Mindfulness', 'Creativity'],
  },
  {
    id: 'improve_areas',
    title: 'What areas do you want to improve?',
    type: 'multi',
    options: ['Focus', 'Discipline', 'Time management', 'Memory', 'Communication', 'Emotional balance', 'Energy & sleep', 'Confidence'],
  },
  {
    id: 'content_consumption',
    title: 'How do you currently consume content?',
    type: 'single',
    options: ['Short videos (Reels/TikTok/Shorts)', 'Articles & blogs', 'YouTube long-form', 'Podcasts', 'Books', 'Social media feeds'],
  },
  {
    id: 'productivity_challenge',
    title: "What's your biggest productivity challenge?",
    type: 'single',
    options: ['Procrastination', 'Too many distractions', 'No clear system', 'Low energy', 'Overwhelm / too much input', 'Starting tasks'],
  },
  {
    id: 'free_time',
    title: 'How much free time do you have daily?',
    type: 'single',
    options: ['Less than 1 hour', '1–2 hours', '2–4 hours', '4+ hours'],
  },
  {
    id: 'peak_hours',
    title: 'When do you do your best deep work?',
    type: 'single',
    options: ['Early morning', 'Late morning', 'Afternoon', 'Evening', 'Late night'],
  },
  {
    id: 'learning_focus',
    title: "What's your current learning focus?",
    type: 'text',
    placeholder: 'e.g. AI tools, marketing, public speaking…',
  },
  {
    id: 'stress_handling',
    title: 'How do you currently handle stress?',
    type: 'single',
    options: ['Exercise', 'Meditation / breathing', 'Talking to someone', 'Distraction (scroll, games)', 'I push through it', 'I shut down'],
  },
  {
    id: 'habit_to_build',
    title: "What's one habit you want to build?",
    type: 'text',
    placeholder: 'e.g. Read 20 min daily, wake at 6am…',
  },
  {
    id: 'professional_role',
    title: "What's your professional role?",
    type: 'text',
    placeholder: 'e.g. Student, marketer, founder, developer…',
  },
  {
    id: 'information_overload',
    title: 'Do you struggle with information overload?',
    type: 'single',
    options: ['Yes, constantly', 'Sometimes', 'Rarely', 'No'],
  },
  {
    id: 'organization_style',
    title: 'How do you prefer to organize information?',
    type: 'single',
    options: ['Categories & folders', 'Tags', 'Visual boards', 'Search-first', 'Chronological timeline', 'I dump everything'],
  },
  {
    id: 'decision_style',
    title: "What's your decision-making style?",
    type: 'single',
    options: ['Fast and intuitive', 'Analytical — data first', 'List pros and cons', 'Ask others for advice', 'Avoid decisions until forced'],
  },
  {
    id: 'motivators',
    title: 'What motivates you most?',
    type: 'multi',
    options: ['Progress I can see', 'Competition & scores', 'Streaks & consistency', 'Learning new skills', 'Financial rewards', 'Recognition', 'Inner peace & clarity'],
  },
  {
    id: 'confirm',
    title: 'Ready to transform your mind?',
    type: 'confirm',
  },
]

function isAnswered(q, answers) {
  const a = answers[q.id]
  if (q.type === 'multi') return Array.isArray(a) && a.length > 0
  if (q.type === 'single') return typeof a === 'string' && a.length > 0
  if (q.type === 'text') return typeof a === 'string' && a.trim().length > 0
  return true // confirm screen
}

export default function Onboarding({ session, onComplete }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const q = QUESTIONS[step]
  const total = QUESTIONS.length
  const progress = useMemo(() => Math.round(((step + 1) / total) * 100), [step, total])

  function toggleMulti(option) {
    const current = answers[q.id] || []
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : q.max && current.length >= q.max
        ? current
        : [...current, option]
    setAnswers({ ...answers, [q.id]: next })
  }

  function pickSingle(option) {
    setAnswers({ ...answers, [q.id]: option })
  }

  async function saveAndFinish(finalAnswers) {
    setSaving(true)
    setSaveError(null)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_answers: finalAnswers,
          goals: finalAnswers.goals || [],
        })
        .eq('id', session.user.id)
      if (error) throw error
      onComplete()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function goNext() {
    if (step < total - 1) {
      setStep(step + 1)
    } else {
      saveAndFinish(answers)
    }
  }

  function skip() {
    saveAndFinish({ ...answers, skipped: step < total - 1 })
  }

  const answered = isAnswered(q, answers)

  return (
    <div className="min-h-screen flex justify-center bg-base-bg">
      <div className="w-full max-w-md flex flex-col min-h-screen relative">
        {/* Top bar: back button + progress */}
        <header
          className="w-full px-md pt-md flex items-center gap-md shrink-0"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}
        >
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              aria-label="Back"
              className="w-9 h-9 rounded-button bg-base-surface border border-base-border flex items-center justify-center text-ink-secondary hover:text-ink-primary transition duration-200 active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div className="w-9 h-9" />
          )}
          <div className="flex-1">
            <div className="h-1.5 w-full bg-base-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, boxShadow: '0 0 8px rgba(0,212,170,0.6)' }}
              />
            </div>
          </div>
          <span className="text-caption text-ink-tertiary whitespace-nowrap">
            {step + 1} of {total}
          </span>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 px-lg pt-xl pb-[140px] flex flex-col items-center overflow-y-auto">
          {/* Hero mark */}
          <div className="w-full max-w-[160px] aspect-square mb-lg relative flex items-center justify-center">
            <div className="absolute inset-0 bg-primary opacity-20 rounded-[40px] blur-[60px] pointer-events-none" />
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-base-bg text-h1 font-extrabold shadow-glow relative z-10">
              N
            </div>
          </div>

          <div className="text-center mb-xl w-full">
            <h1 className="text-h1 text-ink-primary mb-sm tracking-wide">
              {q.type === 'confirm' ? "You're all set" : 'Welcome to Nexora'}
            </h1>
            {q.type !== 'confirm' && (
              <p className="text-body text-ink-secondary max-w-[280px] mx-auto leading-relaxed">
                Your personal operating system for knowledge, growth, and clarity.
              </p>
            )}
          </div>

          {/* Question card */}
          {q.type === 'confirm' ? (
            <div className="w-full card p-lg mb-xl text-center">
              <Sparkles className="mx-auto text-primary mb-md" size={32} />
              <h3 className="text-h3 text-ink-primary mb-sm">{q.title}</h3>
              <p className="text-body-small text-ink-secondary leading-relaxed">
                Nexora is now personalized to your goals, challenges, and style.
                Your AI assistant, principles, and growth engine will use these
                answers — you can change them anytime in Settings.
              </p>
            </div>
          ) : (
            <div className="w-full card p-lg mb-xl">
              <h3 className="text-h3 text-ink-primary mb-md tracking-wide">{q.title}</h3>
              {q.type === 'text' ? (
                <input
                  type="text"
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder={q.placeholder}
                  className="input"
                />
              ) : (
                <div className="flex flex-wrap gap-sm">
                  {(q.options || []).map((option) => {
                    const selected =
                      q.type === 'multi'
                        ? (answers[q.id] || []).includes(option)
                        : answers[q.id] === option
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => (q.type === 'multi' ? toggleMulti(option) : pickSingle(option))}
                        className={`px-md py-2 rounded-full text-body-small font-semibold transition duration-200 active:scale-95 border ${
                          selected
                            ? 'bg-primary text-base-bg border-primary shadow-glow'
                            : 'bg-base-surface text-ink-secondary border-base-border hover:bg-base-elevated'
                        }`}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              )}
              {q.type === 'multi' && q.max && (
                <p className="text-caption text-ink-tertiary mt-md">
                  Pick up to {q.max} · {(answers[q.id] || []).length} selected
                </p>
              )}
            </div>
          )}
        </main>

        {/* Fixed bottom actions */}
        <footer
          className="absolute bottom-0 left-0 w-full px-lg pt-md bg-gradient-to-t from-base-bg via-base-bg/95 to-transparent"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
        >
          {saveError && (
            <p className="text-body-small text-error text-center mb-sm">{saveError}</p>
          )}
          <button
            type="button"
            onClick={goNext}
            disabled={!answered || saving}
            className="w-full btn-primary h-[56px] rounded-button flex items-center justify-center gap-2 shadow-glow mb-md disabled:opacity-40 disabled:pointer-events-none"
          >
            {saving ? (
              'Setting up…'
            ) : (
              <>
                {q.type === 'confirm' ? (
                  <>
                    <Check size={18} /> Start My Journey
                  </>
                ) : (
                  <>
                    Continue <ArrowRight size={18} />
                  </>
                )}
              </>
            )}
          </button>
          <div className="text-center">
            <button
              type="button"
              onClick={skip}
              disabled={saving}
              className="text-body-small text-ink-secondary hover:text-ink-primary transition duration-200 active:scale-[0.98]"
            >
              Skip for now
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
