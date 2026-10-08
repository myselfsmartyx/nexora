import { Check, Crown, Sparkles } from 'lucide-react'
import { Sheet } from '../journal/ui.jsx'

const REASONS = {
  ai: { emoji: '🪞', title: 'You’ve used this month’s free readings', body: 'Everything else in Physical keeps working — snapshots, your trend, experiments and local suggestions. Pro gives you far more AI readings and suggestions.' },
  reasons: { emoji: '🔎', title: 'Why your patterns look the way they do', body: 'Pro connects your journal, snapshots and experiments to point at possible reasons behind a change — each one tied to what it’s based on, never presented as fact.' },
  experiments: { emoji: '🧪', title: 'Run more than one experiment', body: 'Free keeps things simple with one at a time. Pro lets you run up to three side by side — say, one for sleep and one for movement.' },
  visit: { emoji: '🩺', title: 'A summary you can bring to a doctor', body: 'Trends, snapshots, noted aches and what you’ve tried — on one clean page, ready to copy or download. Nothing is shared with anyone.' },
}
const BENEFITS = [
  ['reasons', 'Possible reasons behind your patterns'],
  ['visit', 'Doctor-visit summary (copy or download)'],
  ['experiments', 'Up to 3 experiments at once'],
  ['ai', 'Many more AI readings and next-move suggestions'],
]

export default function PhysicalUpgrade({ reason, onClose, onUpgrade }) {
  if (!reason) return null
  const r = REASONS[reason] || REASONS.ai
  return (
    <Sheet open onClose={onClose} tall
      footer={<div className="flex flex-col gap-sm">
        <button className="btn-primary w-full py-3.5 flex items-center justify-center gap-2" onClick={onUpgrade}><Crown size={16} /> See Pro plans</button>
        <button className="text-body-small text-ink-secondary py-2 hover:text-ink-primary" onClick={onClose}>Not now</button>
      </div>}>
      <div className="flex flex-col items-center text-center pt-sm pb-md animate-rise">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-md" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,.2), rgba(249,115,22,.2))', border: '1px solid rgba(245,158,11,.4)' }}>{r.emoji}</div>
        <h2 className="text-h2 text-ink-primary">{r.title}</h2>
        <p className="text-body-small text-ink-secondary leading-relaxed mt-sm max-w-sm">{r.body}</p>
      </div>
      <ul className="flex flex-col gap-2.5 mb-lg">
        {[...BENEFITS].sort((a, b) => (a[0] === reason ? -1 : b[0] === reason ? 1 : 0)).map(([id, label]) => (
          <li key={id} className={`flex items-center gap-sm text-body-small ${id === reason ? 'text-ink-primary font-medium' : 'text-ink-secondary'}`}>
            <span className="w-5 h-5 rounded-full bg-warning/15 text-warning flex items-center justify-center shrink-0"><Check size={12} strokeWidth={3} /></span>{label}
          </li>
        ))}
      </ul>
      <div className="rounded-card bg-primary/5 border border-primary/20 p-md">
        <p className="text-caption text-primary font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-1.5"><Sparkles size={12} /> Always free</p>
        <p className="text-caption text-ink-secondary leading-relaxed">Baseline, snapshots, your long-view trend, local suggestions, experiments, “what works for you”, step away, and deleting all your data at any time.</p>
      </div>
    </Sheet>
  )
}
