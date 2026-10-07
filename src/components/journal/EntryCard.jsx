import { memo, useRef } from 'react'
import { Star, Lock, MoreVertical, Check, Archive } from 'lucide-react'
import { moodInfo } from '../../lib/journal/constants.js'
import { fromISO, readMinutes, timeLabel } from '../../lib/journal/dates.js'
import { Highlight, TagChip } from './ui.jsx'

export function displayTitle(e) {
  if (e.is_locked) return e._failed ? 'Private entry' : e._title || (e._title === undefined ? 'Private entry' : 'Untitled')
  if (e.title) return e.title
  const first = (e.preview || '').split('\n').find((l) => l.trim())
  return first ? first.slice(0, 60) : 'Untitled entry'
}

function EntryCardBase({ entry, query, index = 0, showDate, selecting, selected, folder, tagColor, onOpen, onSelect, onMenu, onFavorite }) {
  const mood = moodInfo(entry.mood)
  const pressTimer = useRef(null)
  const longPressed = useRef(false)
  const locked = entry.is_locked
  const text = locked ? entry._preview : entry.preview
  const words = locked ? 0 : entry.word_count

  const startPress = () => {
    longPressed.current = false
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => { longPressed.current = true; onSelect(entry) }, 520)
  }
  const cancelPress = () => clearTimeout(pressTimer.current)
  const click = () => {
    if (longPressed.current) { longPressed.current = false; return }
    selecting ? onSelect(entry) : onOpen(entry)
  }
  const tags = entry.tags || []

  return (
    <article
      onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress}
      onContextMenu={(e) => { e.preventDefault(); onSelect(entry) }}
      className={`group relative overflow-hidden rounded-card border bg-base-surface transition duration-200 animate-rise cursor-pointer select-none
        ${selected ? 'border-primary shadow-glow' : 'border-base-border hover:border-primary/40 hover:-translate-y-px'}`}
      style={{ animationDelay: `${Math.min(index, 8) * 30}ms`, contentVisibility: 'auto', containIntrinsicSize: '0 124px' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: mood?.color || 'rgb(var(--c-border))' }} />
      <div role="button" tabIndex={0} onClick={click} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), click())}
        aria-label={`${selecting ? 'Select' : 'Open'} ${displayTitle(entry)}`}
        className="pl-md pr-2 py-3 flex gap-sm outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-card">
        {selecting && (
          <span className={`mt-1 shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition ${selected ? 'bg-primary border-primary text-base-bg' : 'border-base-border'}`}>
            {selected && <Check size={14} strokeWidth={3} />}
          </span>
        )}
        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          <div className="flex items-start gap-1">
            <h3 className="text-body font-semibold text-ink-primary leading-snug line-clamp-1 flex-1">
              {locked && <Lock size={14} className="inline -mt-0.5 mr-1.5 text-primary" />}
              <Highlight text={displayTitle(entry)} query={locked ? '' : query} />
            </h3>
            {!selecting && (
              <>
                <button aria-label={entry.is_favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={(e) => { e.stopPropagation(); onFavorite(entry) }} onPointerDown={(e) => e.stopPropagation()}
                  className="w-8 h-8 -my-1 flex items-center justify-center rounded-full hover:bg-base-elevated transition shrink-0">
                  <Star size={18} className={`transition ${entry.is_favorite ? 'fill-warning text-warning scale-110' : 'text-ink-tertiary group-hover:text-ink-secondary'}`} />
                </button>
                <button aria-label="More actions" onClick={(e) => { e.stopPropagation(); onMenu(entry) }} onPointerDown={(e) => e.stopPropagation()}
                  className="w-8 h-8 -my-1 -mr-1 flex items-center justify-center rounded-full text-ink-tertiary hover:text-ink-primary hover:bg-base-elevated transition shrink-0">
                  <MoreVertical size={18} />
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-ink-tertiary">
            <span>{showDate ? fromISO(entry.entry_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : timeLabel(entry.created_at)}</span>
            {words > 0 && <span>· {words} words · {readMinutes(words)} min</span>}
            {mood && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ color: mood.color, background: `${mood.color}1F` }}>{mood.emoji} {mood.label}</span>}
            {folder && <span className="inline-flex items-center gap-1" style={{ color: folder.color }}><span>{folder.emoji}</span>{folder.name}</span>}
            {entry.is_archived && <span className="inline-flex items-center gap-1"><Archive size={12} /> Archived</span>}
          </div>

          {locked && !text ? (
            <div className="flex flex-col gap-1.5 py-0.5" aria-hidden>
              <div className="h-2.5 rounded bg-base-elevated w-11/12" /><div className="h-2.5 rounded bg-base-elevated w-7/12" />
              <p className="text-caption text-ink-tertiary mt-0.5">Private · unlock to read</p>
            </div>
          ) : (
            text && <p className="text-body-small text-ink-secondary leading-relaxed line-clamp-2 whitespace-pre-line"><Highlight text={text.slice(0, 200)} query={locked ? '' : query} /></p>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {tags.slice(0, 4).map((t) => <TagChip key={t} name={t} color={tagColor(t)} size="xs" />)}
              {tags.length > 4 && <span className="text-[11px] text-ink-tertiary self-center">+{tags.length - 4}</span>}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default memo(EntryCardBase)
