import { Sheet, ProBadge } from './ui.jsx'
import { TEMPLATES } from '../../lib/journal/constants.js'
import { useJournal } from '../../lib/journal/context.jsx'

export default function TemplateSheet({ open, onClose, onPick }) {
  const { isPro, openUpgrade } = useJournal()
  return (
    <Sheet open={open} onClose={onClose} title="Start from a template" tall>
      <div className="grid grid-cols-2 gap-sm">
        {TEMPLATES.map((t) => {
          const locked = t.pro && !isPro
          return (
            <button key={t.id} onClick={() => { if (locked) { onClose(); openUpgrade('templates') } else { onPick(t); onClose() } }}
              className="card p-md text-left hover:border-primary/50 active:scale-[0.98] transition relative">
              <span className="text-2xl block mb-1">{t.emoji}</span>
              <span className="block text-body-small font-semibold text-ink-primary">{t.name}</span>
              <span className="block text-caption text-ink-tertiary leading-snug mt-0.5">{t.desc}</span>
              {t.pro && !isPro && <ProBadge className="absolute top-2 right-2" />}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
