import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Sheet, TagChip } from './ui.jsx'
import { MOODS, SORTS } from '../../lib/journal/constants.js'
import { addDaysISO, todayLocal, toISO } from '../../lib/journal/dates.js'
import { useJournal } from '../../lib/journal/context.jsx'

const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

export default function FilterSheet({ open, onClose, filters, sort, onApply }) {
  const { tags, tagColor } = useJournal()
  const [d, setD] = useState(filters)
  const [s, setS] = useState(sort)
  const [tagQuery, setTagQuery] = useState('')

  useEffect(() => { if (open) { setD(filters); setS(sort); setTagQuery('') } }, [open, filters, sort])

  const shownTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase()
    return tags.filter((t) => !q || t.tag.includes(q)).slice(0, 60)
  }, [tags, tagQuery])

  const preset = (kind) => {
    const today = todayLocal()
    const now = new Date()
    if (kind === 'week') setD({ ...d, date: '', from: addDaysISO(today, -6), to: today })
    if (kind === 'month') setD({ ...d, date: '', from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: today })
    if (kind === '30') setD({ ...d, date: '', from: addDaysISO(today, -29), to: today })
    if (kind === 'year') setD({ ...d, date: '', from: `${now.getFullYear()}-01-01`, to: today })
    if (kind === 'clear') setD({ ...d, from: '', to: '', date: '' })
  }

  const reset = () => { setD({ ...d, moods: [], tags: [], tagMode: 'any', from: '', to: '', date: '' }); setS('newest') }

  return (
    <Sheet open={open} onClose={onClose} title="Filter & sort" tall
      footer={
        <div className="flex gap-sm">
          <button className="btn-secondary flex-1 py-3" onClick={reset}>Reset</button>
          <button className="btn-primary flex-[2] py-3" onClick={() => { onApply(d, s); onClose() }}>Show entries</button>
        </div>
      }>
      <div className="flex flex-col gap-lg pt-1">
        <section>
          <h3 className="text-caption uppercase tracking-wider text-ink-secondary mb-sm">Sort by</h3>
          <div className="flex flex-wrap gap-sm">
            {SORTS.map((o) => (
              <button key={o.id} onClick={() => setS(o.id)} className={`chip ${s === o.id ? 'chip-active' : ''}`}>{o.label}</button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-caption uppercase tracking-wider text-ink-secondary mb-sm">Mood</h3>
          <div className="flex flex-wrap gap-sm">
            {MOODS.map((m) => {
              const on = d.moods.includes(m.id)
              return (
                <button key={m.id} onClick={() => setD({ ...d, moods: toggle(d.moods, m.id) })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-chip border text-caption font-medium transition active:scale-95"
                  style={{ color: on ? m.color : undefined, background: on ? `${m.color}26` : undefined, borderColor: on ? m.color : undefined }}>
                  <span>{m.emoji}</span>{m.label}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-sm">
            <h3 className="text-caption uppercase tracking-wider text-ink-secondary">Tags</h3>
            {d.tags.length > 1 && (
              <div className="inline-flex rounded-full bg-base-elevated border border-base-border p-0.5 text-caption">
                {['any', 'all'].map((m) => (
                  <button key={m} onClick={() => setD({ ...d, tagMode: m })} className={`px-2.5 py-0.5 rounded-full transition ${d.tagMode === m ? 'bg-primary/20 text-primary' : 'text-ink-secondary'}`}>
                    {m === 'any' ? 'Any of' : 'All of'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {tags.length > 10 && (
            <div className="relative mb-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input className="input !py-2 pl-9" placeholder="Find a tag" value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} />
            </div>
          )}
          {tags.length === 0 ? (
            <p className="text-body-small text-ink-secondary">No tags yet — add some while writing.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {shownTags.map((t) => (
                <TagChip key={t.tag} name={t.tag} color={tagColor(t.tag)} count={t.uses} active={d.tags.includes(t.tag)} onClick={() => setD({ ...d, tags: toggle(d.tags, t.tag) })} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-caption uppercase tracking-wider text-ink-secondary mb-sm">Date range</h3>
          <div className="flex flex-wrap gap-sm mb-sm">
            {[['week', 'Last 7 days'], ['30', 'Last 30 days'], ['month', 'This month'], ['year', 'This year']].map(([k, l]) => (
              <button key={k} className="chip" onClick={() => preset(k)}>{l}</button>
            ))}
            {(d.from || d.to || d.date) && <button className="chip text-error" onClick={() => preset('clear')}>Clear dates</button>}
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <label className="text-caption text-ink-secondary">From
              <input type="date" className="input mt-1" value={d.from} max={d.to || undefined} onChange={(e) => setD({ ...d, from: e.target.value, date: '' })} />
            </label>
            <label className="text-caption text-ink-secondary">To
              <input type="date" className="input mt-1" value={d.to} min={d.from || undefined} onChange={(e) => setD({ ...d, to: e.target.value, date: '' })} />
            </label>
          </div>
          {d.date && <p className="text-caption text-primary mt-sm">Showing a single day: {d.date}</p>}
        </section>
      </div>
    </Sheet>
  )
}
