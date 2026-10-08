import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Dumbbell, Flame, TrendingUp, Zap, PersonStanding, Heart } from 'lucide-react'
import { GOALS, ACTIVITY, BODY, LIMITS } from '../../lib/physical/constants.js'

const GOAL_ICON = { muscle: Dumbbell, fat: Flame, strength: TrendingUp, energy: Zap, posture: PersonStanding, general: Heart }
const toNum = (v) => (v === '' || v == null ? null : Number(v))
const KG_PER_LB = 0.45359237
const CM_PER_IN = 2.54

// 4 short steps, every field optional, "Skip" always available. Also used (as `compact`) to edit the baseline later.
export default function Onboarding({ initial, onSave, onSkip, onCancel }) {
  const p = initial || {}
  const imperial = p.units === 'imperial'
  const [step, setStep] = useState(1)
  const [units, setUnits] = useState(p.units || 'metric')
  const [age, setAge] = useState(p.age ?? '')
  const [sex, setSex] = useState(p.sex || null)
  const [height, setHeight] = useState(p.height_cm != null ? (imperial ? Math.round(p.height_cm / CM_PER_IN) : p.height_cm) : '')
  const [weight, setWeight] = useState(p.weight_kg != null ? (imperial ? Math.round(p.weight_kg / KG_PER_LB) : p.weight_kg) : '')
  const [body, setBody] = useState(p.body_condition || null)
  const [activity, setActivity] = useState(p.activity_level || null)
  const [goal, setGoal] = useState(p.goal || null)
  const [limits, setLimits] = useState(p.limits || [])
  const [limitsNote, setLimitsNote] = useState(p.limits_note || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const flip = (next) => {
    if (next === units) return
    const h = toNum(height), w = toNum(weight)
    if (h != null) setHeight(next === 'imperial' ? Math.round(h / CM_PER_IN) : Math.round(h * CM_PER_IN))
    if (w != null) setWeight(next === 'imperial' ? Math.round(w / KG_PER_LB) : Math.round(w * KG_PER_LB))
    setUnits(next)
  }

  async function finish() {
    setErr('')
    const a = toNum(age), h = toNum(height), w = toNum(weight)
    const cm = h == null ? null : units === 'imperial' ? Math.round(h * CM_PER_IN * 10) / 10 : h
    const kg = w == null ? null : units === 'imperial' ? Math.round(w * KG_PER_LB * 10) / 10 : w
    if (a != null && (a < 13 || a > 110)) { setStep(1); return setErr('Age should be between 13 and 110.') }
    if (cm != null && (cm < 100 || cm > 250)) { setStep(1); return setErr('That height looks off — check the units.') }
    if (kg != null && (kg < 25 || kg > 350)) { setStep(1); return setErr('That weight looks off — check the units.') }
    setBusy(true)
    try {
      await onSave({ age: a, sex, height_cm: cm, weight_kg: kg, body_condition: body, activity_level: activity, goal, limits, limits_note: limitsNote.trim() || null, units, skipped: false })
    } catch (e) { setErr(e.message || 'Could not save.') } finally { setBusy(false) }
  }

  const Chip = ({ on, onClick, children }) => (
    <button type="button" onClick={onClick} className={`px-md py-3 rounded-card border text-left transition active:scale-[0.98] ${on ? 'border-primary bg-primary/10 text-ink-primary' : 'border-base-border bg-base-surface text-ink-secondary hover:border-primary/40'}`}>{children}</button>
  )

  return (
    <div className="flex flex-col gap-lg animate-fade-in">
      <div>
        <div className="flex items-center justify-between mb-sm">
          <p className="text-caption uppercase tracking-wider text-primary font-semibold">Step {step} of 4</p>
          <button className="text-caption text-ink-secondary hover:text-ink-primary" onClick={onCancel || onSkip}>{onCancel ? 'Close' : 'Skip for now'}</button>
        </div>
        <div className="flex gap-1.5">{[1, 2, 3, 4].map((i) => <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-primary' : 'bg-base-border'}`} />)}</div>
      </div>

      {step === 1 && (
        <section className="flex flex-col gap-md animate-rise">
          <div><h2 className="text-h2 text-ink-primary">A rough starting point</h2><p className="text-body-small text-ink-secondary mt-1">Everything here is optional. Skip any field — I’ll work with what I have.</p></div>
          <div className="inline-flex p-1 rounded-button bg-base-elevated border border-base-border self-start">
            {['metric', 'imperial'].map((u) => <button key={u} onClick={() => flip(u)} className={`px-3 py-1 rounded-[9px] text-caption transition ${units === u ? 'bg-base-surface text-primary shadow-card' : 'text-ink-secondary'}`}>{u === 'metric' ? 'cm · kg' : 'in · lb'}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <label className="text-caption text-ink-secondary col-span-2">Age<input inputMode="numeric" className="input mt-1" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="Years" /></label>
            <label className="text-caption text-ink-secondary">Height ({units === 'metric' ? 'cm' : 'in'})<input inputMode="decimal" className="input mt-1" value={height} onChange={(e) => setHeight(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))} /></label>
            <label className="text-caption text-ink-secondary">Weight ({units === 'metric' ? 'kg' : 'lb'})<input inputMode="decimal" className="input mt-1" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))} /></label>
          </div>
          <div>
            <p className="text-caption text-ink-secondary mb-sm">Biological sex <span className="text-ink-tertiary">(only used to keep advice sensible)</span></p>
            <div className="flex gap-sm">{[['male', 'Male'], ['female', 'Female'], ['other', 'Prefer not to say']].map(([id, l]) => <button key={id} onClick={() => setSex(sex === id ? null : id)} className={`chip ${sex === id ? 'chip-active' : ''}`}>{l}</button>)}</div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-md animate-rise">
          <div><h2 className="text-h2 text-ink-primary">How would you describe your build?</h2><p className="text-body-small text-ink-secondary mt-1">A feeling, not a measurement.</p></div>
          <div className="grid grid-cols-2 gap-sm">{BODY.map((b) => <Chip key={b.id} on={body === b.id} onClick={() => setBody(body === b.id ? null : b.id)}><span className="text-body-small font-medium">{b.label}</span></Chip>)}</div>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-md animate-rise">
          <div><h2 className="text-h2 text-ink-primary">How active is a normal week?</h2></div>
          <div className="flex flex-col gap-sm">{ACTIVITY.map((a) => <Chip key={a.id} on={activity === a.id} onClick={() => setActivity(activity === a.id ? null : a.id)}><span className="block text-body-small font-medium">{a.label}</span><span className="block text-caption text-ink-tertiary">{a.desc}</span></Chip>)}</div>
        </section>
      )}

      {step === 4 && (
        <section className="flex flex-col gap-md animate-rise">
          <div><h2 className="text-h2 text-ink-primary">What matters most right now?</h2><p className="text-body-small text-ink-secondary mt-1">You can change this any time.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">{GOALS.map((g) => { const Icon = GOAL_ICON[g.id]; return (
            <Chip key={g.id} on={goal === g.id} onClick={() => setGoal(goal === g.id ? null : g.id)}>
              <span className="flex items-center gap-sm"><Icon size={18} className="text-primary shrink-0" /><span><span className="block text-body-small font-medium">{g.label}</span><span className="block text-caption text-ink-tertiary">{g.desc}</span></span></span>
            </Chip>) })}</div>
          <div>
            <p className="text-caption text-ink-secondary mb-sm">Anything that limits movement? <span className="text-ink-tertiary">(keeps suggestions safe)</span></p>
            <div className="flex flex-wrap gap-sm">{LIMITS.map((l) => <button key={l.id} onClick={() => setLimits(limits.includes(l.id) ? limits.filter((x) => x !== l.id) : [...limits, l.id])} className={`chip ${limits.includes(l.id) ? 'chip-active' : ''}`}>{l.label}</button>)}</div>
            {limits.length > 0 && <input className="input mt-sm" maxLength={300} placeholder="Anything else I should know? (optional)" value={limitsNote} onChange={(e) => setLimitsNote(e.target.value)} />}
          </div>
          <p className="text-caption text-ink-tertiary leading-relaxed">Nexora offers guidance, not medical advice. If something hurts or worries you, a doctor or physiotherapist is the right call.</p>
        </section>
      )}

      {err && <p className="text-body-small text-error" role="alert">{err}</p>}

      <div className="flex gap-sm">
        {step > 1 && <button className="btn-secondary px-md py-3 flex items-center gap-1.5" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button>}
        {step < 4 ? (
          <button className="btn-primary flex-1 py-3.5 flex items-center justify-center gap-2" onClick={() => setStep(step + 1)}>{(step === 1 && !age && !height && !weight) || (step === 2 && !body) || (step === 3 && !activity) ? 'Skip this step' : 'Continue'} <ArrowRight size={16} /></button>
        ) : (
          <button className="btn-primary flex-1 py-3.5 flex items-center justify-center gap-2 disabled:opacity-60" disabled={busy} onClick={finish}><Check size={16} /> {busy ? 'Saving…' : onCancel ? 'Save' : 'Start gently'}</button>
        )}
      </div>
    </div>
  )
}
