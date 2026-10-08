import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from '../journal/ui.jsx'
import { ENERGY_LABELS, SLEEP_LABELS, ACTIVITY_WEEK, FEEL } from '../../lib/physical/constants.js'
import { todayLocal } from '../../lib/journal/dates.js'

const KG_PER_LB = 0.45359237
const Scale = ({ value, onChange, labels, label }) => (
  <div>
    <p className="text-caption text-ink-secondary mb-sm">{label}{value != null && <span className="text-primary"> · {labels[value - (labels.length === 4 ? 0 : 1)]}</span>}</p>
    <div className="flex gap-1.5">
      {labels.map((l, i) => { const v = labels.length === 4 ? i : i + 1; const on = value === v
        return <button key={l} onClick={() => onChange(on ? null : v)} aria-pressed={on} className={`flex-1 py-2.5 rounded-button border text-[11px] leading-tight transition active:scale-95 ${on ? 'border-primary bg-primary/15 text-primary font-semibold' : 'border-base-border bg-base-surface text-ink-secondary'}`}>{l}</button> })}
    </div>
  </div>
)

// 10 seconds. Every field optional; at least one thing makes it worth saving.
export default function SnapshotSheet({ open, onClose, units, hideNumbers, existing, preset, onSave, onDelete }) {
  const [energy, setEnergy] = useState(null)
  const [sleep, setSleep] = useState(null)
  const [activity, setActivity] = useState(null)
  const [weight, setWeight] = useState('')
  const [feel, setFeel] = useState([])
  const [pain, setPain] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const imperial = units === 'imperial'

  useEffect(() => {
    if (!open) return
    const e = existing
    setEnergy(e?.energy ?? null); setSleep(e?.sleep ?? null); setActivity(e?.activity ?? null)
    setWeight(e?.weight_kg != null ? String(imperial ? Math.round(e.weight_kg / KG_PER_LB) : e.weight_kg) : '')
    setFeel(e?.feel || (preset === 'pain' ? ['pain'] : [])); setPain(e?.pain_note || ''); setNote(e?.note || ''); setDate(e?.taken_on || todayLocal()); setErr('')
  }, [open, existing, preset, imperial])

  const w = weight === '' ? null : Number(weight)
  const kg = w == null ? null : imperial ? Math.round(w * KG_PER_LB * 10) / 10 : w
  const has = energy != null || sleep != null || activity != null || kg != null || feel.length > 0 || note.trim()

  async function save() {
    if (!has) return setErr('Add at least one thing — even a single tap.')
    if (kg != null && (kg < 25 || kg > 350)) return setErr('That weight looks off — check the units.')
    setBusy(true); setErr('')
    try {
      await onSave({ taken_on: date, energy, sleep, activity, weight_kg: kg, feel, pain_note: feel.includes('pain') ? (pain.trim() || null) : null, note: note.trim() || null })
    } catch (e) { setErr(e.message || 'Could not save.') } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} tall title={existing ? 'Edit snapshot' : 'Quick snapshot'} subtitle="Skip anything. One tap is enough."
      footer={<div className="flex gap-sm">
        {existing && <button aria-label="Delete snapshot" className="btn-secondary !px-3 text-error" onClick={() => onDelete(existing)}><Trash2 size={16} /></button>}
        <button className="btn-primary flex-1 py-3.5 disabled:opacity-50" disabled={busy || !has} onClick={save}>{busy ? 'Saving…' : 'Save snapshot'}</button>
      </div>}>
      <div className="flex flex-col gap-lg pt-1">
        <Scale value={energy} onChange={setEnergy} labels={ENERGY_LABELS} label="Energy lately" />
        <Scale value={sleep} onChange={setSleep} labels={SLEEP_LABELS} label="Sleep lately" />
        <Scale value={activity} onChange={setActivity} labels={ACTIVITY_WEEK} label="Movement this week" />
        <div>
          <p className="text-caption text-ink-secondary mb-sm">How does your body feel?</p>
          <div className="flex flex-wrap gap-sm">{FEEL.map((f) => <button key={f.id} onClick={() => setFeel(feel.includes(f.id) ? feel.filter((x) => x !== f.id) : [...feel, f.id].slice(0, 8))} className={`chip ${feel.includes(f.id) ? 'chip-active' : ''}`}>{f.label}</button>)}</div>
          {feel.includes('pain') && <input className="input mt-sm animate-pop-in" maxLength={200} placeholder="Where, and for how long? (e.g. lower back, 2 weeks)" value={pain} onChange={(e) => setPain(e.target.value)} />}
        </div>
        {!hideNumbers && (
          <label className="text-caption text-ink-secondary">Weight ({imperial ? 'lb' : 'kg'}) <span className="text-ink-tertiary">· optional, rough is fine</span>
            <input inputMode="decimal" className="input mt-1" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))} placeholder="Skip if you’d rather not" />
          </label>
        )}
        <label className="text-caption text-ink-secondary">Anything else?
          <textarea className="input mt-1 min-h-[72px]" maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Illness, travel, a hard month, a good one…" />
        </label>
        <label className="text-caption text-ink-secondary">Date <input type="date" className="input mt-1" max={todayLocal()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
        {err && <p className="text-body-small text-error" role="alert">{err}</p>}
      </div>
    </Sheet>
  )
}
