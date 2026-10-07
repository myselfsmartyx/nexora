import { Check, Crown, Sparkles } from 'lucide-react'
import { Sheet } from './ui.jsx'
import { FREE, PRO } from '../../lib/journal/constants.js'

// What the person ran into → a calm, specific explanation (never a wall, never a guilt trip).
const REASONS = {
  folders: { emoji: '🗂️', title: 'Room to organise everything', body: `Your free plan includes ${FREE.folders} folders and you're using all of them. Pro removes the limit — and adds private folders.` },
  private_folders: { emoji: '🔐', title: 'Private folders', body: 'Pro lets you make a whole folder private: everything you write inside is encrypted automatically.' },
  private: { emoji: '🔒', title: 'Protect more of your writing', body: `Free includes ${FREE.privateEntries} private entries. Pro makes it unlimited, so anything sensitive stays end-to-end encrypted.` },
  prompts: { emoji: '✨', title: 'More AI prompts', body: `You've used today's ${FREE.aiPromptsPerDay} free AI prompts. Pro gives you ${PRO.aiPromptsPerDay} a day. The built-in prompt library is always free.` },
  reflection: { emoji: '🪞', title: 'Weekly reflections, every week', body: 'You get one free AI reflection a month. Pro generates one whenever you want — your own patterns, wins and next focus.' },
  ask: { emoji: '💬', title: 'Ask your journal anything', body: 'Get answers drawn from your own entries — patterns, past decisions, what was working.' },
  insights: { emoji: '📈', title: 'See the bigger picture', body: 'Year heatmap, mood trends and your weekly rhythm — built from your real entries.' },
  templates: { emoji: '🧩', title: 'Premium templates', body: 'Weekly review, decision log, thought reframe and more — structured prompts that make writing faster.' },
  smart_tags: { emoji: '🏷️', title: 'AI smart tags', body: 'Auto-suggest tags and mood from what you wrote — organise in one tap. Free users still get tag suggestions from their existing tags.' },
  general: { emoji: '👑', title: 'Nexora Pro', body: 'More organisation, more privacy and deeper self-insight.' },
}

const BENEFITS = [
  ['folders', 'Unlimited folders + private folders'],
  ['private', 'Unlimited end-to-end encrypted entries'],
  ['ask', 'Ask Your Journal — AI answers from your entries'],
  ['reflection', 'Unlimited AI weekly reflections'],
  ['insights', 'Year heatmap, mood trends & weekly rhythm'],
  ['smart_tags', 'AI smart tags and mood detection'],
  ['prompts', `${PRO.aiPromptsPerDay} personalised AI prompts a day`],
  ['templates', '8 premium writing templates'],
]

const ALWAYS_FREE = ['Unlimited entries', 'Edit, archive, duplicate & delete', 'Search, filters & sorting', 'Tags with colors', 'Favorites', 'Export everything, anytime']

function AskExample() {
  return (
    <div className="rounded-card bg-base-elevated border border-base-border p-md mb-md text-body-small">
      <p className="text-ink-secondary mb-1">Example</p>
      <p className="text-ink-primary font-medium mb-2">“What was I stressed about in September?”</p>
      <p className="text-ink-secondary leading-relaxed">“Mostly the project deadline (Sep 3, Sep 11) and sleep — and your entries show it eased on days you walked first…”</p>
    </div>
  )
}

export default function UpgradeSheet({ reason, onClose, onUpgrade }) {
  if (!reason) return null
  const r = REASONS[reason] || REASONS.general
  const ordered = [...BENEFITS].sort((a, b) => (a[0] === reason ? -1 : b[0] === reason ? 1 : 0))
  return (
    <Sheet open onClose={onClose} tall
      footer={
        <div className="flex flex-col gap-sm">
          <button className="btn-primary w-full py-3.5 flex items-center justify-center gap-2" onClick={onUpgrade}><Crown size={16} /> See Pro plans</button>
          <button className="text-body-small text-ink-secondary py-2 hover:text-ink-primary" onClick={onClose}>Not now</button>
        </div>
      }>
      <div className="flex flex-col items-center text-center pt-sm pb-md animate-rise">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-md" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,.2), rgba(249,115,22,.2))', border: '1px solid rgba(245,158,11,.4)' }}>{r.emoji}</div>
        <h2 className="text-h2 text-ink-primary">{r.title}</h2>
        <p className="text-body-small text-ink-secondary leading-relaxed mt-sm max-w-sm">{r.body}</p>
      </div>
      {reason === 'ask' && <AskExample />}
      <ul className="flex flex-col gap-2.5 mb-lg">
        {ordered.map(([id, label]) => (
          <li key={id} className={`flex items-center gap-sm text-body-small ${id === reason ? 'text-ink-primary font-medium' : 'text-ink-secondary'}`}>
            <span className="w-5 h-5 rounded-full bg-warning/15 text-warning flex items-center justify-center shrink-0"><Check size={12} strokeWidth={3} /></span>{label}
          </li>
        ))}
      </ul>
      <div className="rounded-card bg-primary/5 border border-primary/20 p-md">
        <p className="text-caption text-primary font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-1.5"><Sparkles size={12} /> Always free</p>
        <p className="text-caption text-ink-secondary leading-relaxed">{ALWAYS_FREE.join(' · ')}. Your journal is always yours — if you ever downgrade you keep every entry and can export it.</p>
      </div>
    </Sheet>
  )
}
