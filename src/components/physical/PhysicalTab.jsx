import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Plus, Pencil, EyeOff, Eye, FileText, Trash2, Copy, Download, Leaf } from 'lucide-react'
import { ActionSheet, ConfirmSheet, Sheet, Skeleton, useToast } from '../journal/ui.jsx'
import Onboarding from './Onboarding.jsx'
import SnapshotSheet from './SnapshotSheet.jsx'
import LongView, { DirectionChips, TrendRibbon } from './LongView.jsx'
import { NextMoveCard, Experiments } from './NextMove.jsx'
import { StepAway, NudgeCard, Moments } from './BeyondBody.jsx'
import PhysicalUpgrade from './PhysicalUpgrade.jsx'
import {
  loadPhysical, saveProfile, addSnapshot, updateSnapshot, deleteSnapshot, startExperiment, checkinExperiment, finishExperiment,
  addMoment, snooze, resetPhysical, explainPhysical,
} from '../../lib/physical/data.js'
import { aiReading, aiNextMove } from '../../lib/physical/ai.js'
import {
  directionsOf, extractSignals, healthHabitStats, evidenceOf, confidenceOf, safetyFlags, nextQuestion, pickNextMoveLocal,
  pickNudge, welcomeBack, visitSummary, goalLabel,
} from '../../lib/physical/analysis.js'
import { QUIET_LINES } from '../../lib/physical/constants.js'
import { copyText } from '../../lib/share.js'
import { daysBetween, todayLocal } from '../../lib/journal/dates.js'

export default function PhysicalTab({ session }) {
  const userId = session.user.id
  const navigate = useNavigate()
  const { toast, show } = useToast()
  const [d, setD] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [sheet, setSheet] = useState(null)
  const [snap, setSnap] = useState({ existing: null, preset: null })
  const [refreshing, setRefreshing] = useState(false)
  const [moveBusy, setMoveBusy] = useState(false)
  const [move, setMove] = useState(null)
  const [declined, setDeclined] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [upgrade, setUpgrade] = useState(null)
  const today = todayLocal()

  const reload = useCallback(async () => {
    try { setD(await loadPhysical(userId)); setLoadErr('') } catch (e) { setLoadErr(e.message || 'Could not load.') }
  }, [userId])
  useEffect(() => { reload() }, [reload])

  // ---------------------------------------------------------------- derived (all local, no AI)
  const v = useMemo(() => {
    if (!d) return null
    const signals = extractSignals(d.journal, today)
    const habitStats = healthHabitStats(d.habits, d.logs)
    const ev = evidenceOf({ profile: d.profile, snapshots: d.snapshots, experiments: d.experiments, signals, habitStats })
    const safety = safetyFlags(d.profile, d.snapshots)
    const lastReadingDay = d.reading ? d.reading.created_at.slice(0, 10) : null
    const changed = [...d.snapshots.map((s) => s.created_at), ...d.experiments.filter((e) => e.completed_at).map((e) => e.completed_at)].some((t) => d.reading && t > d.reading.created_at)
    const confidence = confidenceOf(ev)
    const lastActive = [...d.snapshots.map((s) => s.taken_on), ...d.experiments.map((e) => e.created_at.slice(0, 10)), d.profile?.updated_at?.slice(0, 10)].filter(Boolean).sort().pop()
    const nudge = (() => {
      const hr = d.reading?.content?.human
      if (hr && daysBetween(d.reading.created_at.slice(0, 10), today) <= 14 && !(d.dismissals[`nudge:ai-${d.reading.id}`] >= today) && !(d.dismissals['nudge:cadence'] >= today)) {
        return { id: `ai-${d.reading.id}`, text: hr.observation, action: hr.tiny_action || null, kind: 'play' }
      }
      return pickNudge({ signals, dismissals: d.dismissals, today })
    })()
    return {
      signals, ev, safety, confidence, dirs: directionsOf(d.snapshots), nudge,
      question: nextQuestion({ profile: d.profile, snapshots: d.snapshots, signals, dismissals: d.dismissals, today }),
      canRefresh: confidence !== 'none' && (!d.reading || daysBetween(lastReadingDay, today) >= 7 || changed),
      welcome: welcomeBack(lastActive, today),
      activeCount: d.experiments.filter((e) => e.status === 'active').length,
      hide: !!d.profile?.hide_numbers,
    }
  }, [d, today])

  // pick the current next move once data is in (cached AI suggestion if recent, else a local pick)
  useEffect(() => {
    if (!d || !v || move) return
    const cached = d.nextMove && daysBetween(d.nextMove.created_at.slice(0, 10), today) <= 14 ? d.nextMove.content : null
    const taken = cached && d.experiments.some((e) => e.title === cached.title)
    setMove(cached && !taken ? cached : pickNextMoveLocal({ profile: d.profile, signals: v.signals, experiments: d.experiments, declined, safety: v.safety }))
  }, [d, v, move, declined, today])

  const patch = (p) => setD((prev) => ({ ...prev, ...p }))
  const cap = d?.isPro ? 3 : 1

  // ---------------------------------------------------------------- actions
  async function saveBaseline(p) {
    const row = await saveProfile(userId, p)
    patch({ profile: row }); setSheet(null); setMove(null)
    show('Saved. That’s plenty to start with.')
  }
  async function skipBaseline() { patch({ profile: await saveProfile(userId, { skipped: true }) }) }
  async function toggleHide() {
    const row = await saveProfile(userId, { hide_numbers: !v.hide })
    patch({ profile: row }); show(row.hide_numbers ? 'Numbers hidden. You’ll see direction only.' : 'Numbers are back.')
  }

  async function saveSnap(s) {
    const row = snap.existing ? await updateSnapshot(snap.existing.id, s) : await addSnapshot(userId, s)
    patch({ snapshots: [row, ...d.snapshots.filter((x) => x.id !== row.id)] })
    setSheet(null); show(snap.existing ? 'Updated.' : 'Saved. That’s all it takes.')
  }
  async function delSnap(s) {
    try { await deleteSnapshot(s.id); patch({ snapshots: d.snapshots.filter((x) => x.id !== s.id) }); setSheet(null); show('Snapshot deleted') } catch (e) { show(e.message) }
  }
  const openSnap = (existing = null, preset = null) => { setSnap({ existing, preset }); setSheet('snapshot') }

  async function refreshReading() {
    if (refreshing) return
    setRefreshing(true)
    try {
      const r = await aiReading()
      patch({ reading: r.reading })
    } catch (e) {
      if (e.code === 'ai_limit' && !d.isPro) setUpgrade('ai')
      else show(e.message)
    } finally { setRefreshing(false) }
  }

  async function newMove(opts) {
    setMoveBusy(true)
    const avoid = [...declined, move?.title].filter(Boolean)
    try {
      const r = await aiNextMove({ easier: !!opts.easier, avoid, current: move?.title || '' })
      setMove(r.move.content)
    } catch (e) {
      // AI unavailable or out of allowance → a built-in suggestion, no drama.
      const local = pickNextMoveLocal({ profile: d.profile, signals: v.signals, experiments: d.experiments, declined: avoid, safety: v.safety })
      const easy = opts.easier ? pickNextMoveLocal({ profile: { ...d.profile, activity_level: 'sedentary' }, signals: v.signals, experiments: d.experiments, declined: avoid, safety: v.safety }) : local
      setMove(easy || local || move)
      if (e.code === 'ai_limit' && !d.isPro) show('Out of free AI suggestions this month — here’s a built-in one.', { label: 'More', onClick: () => setUpgrade('ai') })
    } finally { setMoveBusy(false) }
    if (!opts.easier && move?.title) setDeclined((x) => [...x, move.title])
  }

  async function startMove() {
    if (v.activeCount >= cap) return setSheet('limit')
    try {
      const e = await startExperiment(userId, move)
      patch({ experiments: [e, ...d.experiments] }); setMove(null)
      show('Started. Check in whenever you remember — or don’t.')
    } catch (err) {
      const x = explainPhysical(err)
      if (x.code === 'limit_experiments') setSheet('limit'); else show(x.message)
    }
  }
  async function checkin(e) {
    setBusyId(e.id)
    try { const row = await checkinExperiment(e); patch({ experiments: d.experiments.map((x) => (x.id === row.id ? row : x)) }); show('Noted.') } catch (err) { show(err.message) } finally { setBusyId(null) }
  }
  async function finish(e, val) {
    try {
      const row = await finishExperiment(e.id, val)
      patch({ experiments: d.experiments.map((x) => (x.id === row.id ? row : x)) })
      show(val.status === 'dropped' ? 'Dropped. No harm done.' : 'Thanks — I’ll remember what worked.')
      if (sheet === 'limit') setSheet(null)
    } catch (err) { show(err.message) }
  }

  async function logMoment(m) {
    try { const row = await addMoment(userId, m); patch({ moments: [row, ...d.moments] }); show('Kept.') } catch (e) { show(e.message) }
  }
  async function snoozeKey(key, days) { const until = await snooze(userId, key, days); patch({ dismissals: { ...d.dismissals, [key]: until } }) }
  async function nudgeAct(kind) {
    const n = v.nudge
    if (kind === 'done') { await logMoment({ kind: ['nature', 'connect', 'play', 'rest'].includes(n.kind) ? n.kind : 'play', minutes: null, note: null }); await snoozeKey('nudge:cadence', 7) }
    if (kind === 'later') await snoozeKey('nudge:cadence', 5)
    if (kind === 'never') { await snoozeKey(`nudge:${n.id}`, 365); await snoozeKey('nudge:cadence', 3) }
  }
  function questionAct() {
    const o = v.question.open
    if (o === 'baseline') setSheet('baseline')
    else if (o.startsWith('snapshot')) openSnap(null, o.split(':')[1] || null)
  }

  async function doReset() {
    try { await resetPhysical(userId); setMove(null); setDeclined([]); await reload(); setSheet(null); show('All Physical data deleted.') } catch (e) { show(e.message) }
  }

  const visit = useMemo(() => (d && v ? visitSummary({ profile: d.profile, snapshots: d.snapshots, experiments: d.experiments, signals: v.signals, today }) : ''), [d, v, today])
  const quiet = QUIET_LINES[Math.floor(Date.now() / 86400000) % QUIET_LINES.length]

  // ---------------------------------------------------------------- render
  if (loadErr) return <div className="card p-lg text-center"><p className="text-body-small text-error mb-md">{loadErr}</p><button className="btn-secondary px-lg py-2" onClick={reload}>Try again</button></div>
  if (!d || !v) return <div className="flex flex-col gap-md"><Skeleton className="h-48" /><Skeleton className="h-28" /><Skeleton className="h-36" /></div>

  if (!d.profile) {
    return (
      <div className="flex flex-col gap-lg">
        <div className="card p-md flex gap-md items-start animate-rise">
          <Leaf size={22} className="text-primary shrink-0 mt-0.5" />
          <div><h2 className="text-h3 text-ink-primary">Physical, without the tracking</h2><p className="text-body-small text-ink-secondary leading-relaxed mt-1">Tell me a little, or nothing at all. I’ll look at the long view, suggest one small thing at a time, and ask for updates only when they’d actually change my advice.</p></div>
        </div>
        <Onboarding onSave={saveBaseline} onSkip={skipBaseline} />
        {toast}
      </div>
    )
  }

  const goalName = goalLabel(d.profile.goal)
  const experimentsActive = d.experiments.filter((e) => e.status === 'active')

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-start gap-sm">
        <p className="flex-1 text-body-small text-ink-secondary leading-relaxed italic">{v.welcome || quiet}</p>
        <button aria-label="Physical options" onClick={() => setSheet('menu')} className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-ink-secondary hover:bg-base-elevated shrink-0"><MoreVertical size={20} /></button>
      </div>

      <LongView profile={d.profile} snapshots={d.snapshots} dirs={v.dirs} ev={v.ev} confidence={v.confidence} reading={d.reading}
        isPro={d.isPro} hideNumbers={v.hide} goalName={goalName} canRefresh={v.canRefresh} refreshing={refreshing}
        onRefresh={refreshReading} onUpgrade={() => setUpgrade('reasons')} />

      <section className="card p-md flex flex-col gap-md animate-rise" aria-label="Trend">
        <div className="flex items-center justify-between">
          <h3 className="text-body font-semibold text-ink-primary">Over time</h3>
          <button className="btn-secondary !normal-case !tracking-normal !py-1.5 !px-3 !text-xs flex items-center gap-1" onClick={() => openSnap()}><Plus size={14} /> Snapshot</button>
        </div>
        <TrendRibbon snapshots={d.snapshots} hideNumbers={v.hide} onSelect={(s) => openSnap(s)} />
        <DirectionChips dirs={v.dirs} hideNumbers={v.hide} />
      </section>

      {v.question && (
        <section className="rounded-card border border-primary/30 bg-primary/5 p-md flex flex-col gap-sm animate-rise" aria-label="One question">
          <p className="text-caption uppercase tracking-wider text-primary">One question</p>
          <p className="text-body text-ink-primary leading-snug">{v.question.text}</p>
          <p className="text-caption text-ink-tertiary">Why I’m asking: {v.question.why}</p>
          <div className="flex gap-sm items-center">
            <button className="btn-primary !normal-case !tracking-normal py-2 px-md" onClick={questionAct}>{v.question.cta}</button>
            <button className="text-body-small text-ink-secondary px-2" onClick={() => snoozeKey(v.question.key, 21)}>Later</button>
            <button className="text-caption text-ink-tertiary px-2 ml-auto" onClick={() => snoozeKey(v.question.key, 365)}>Don’t ask this</button>
          </div>
        </section>
      )}

      <NextMoveCard move={move} busy={moveBusy} atLimit={v.activeCount >= cap} onStart={startMove} onEasier={() => newMove({ easier: true })} onElse={() => newMove({})} />
      <Experiments experiments={d.experiments} onCheckin={checkin} onFinish={finish} busyId={busyId} />

      <div className="flex flex-col gap-md">
        <div>
          <h2 className="text-h3 text-ink-primary">Beyond the body</h2>
          <p className="text-body-small text-ink-secondary">The part no tracker can measure.</p>
        </div>
        <NudgeCard nudge={v.nudge} onDone={() => nudgeAct('done')} onLater={() => nudgeAct('later')} onNever={() => nudgeAct('never')} />
        <StepAway onLog={logMoment} />
        <Moments moments={d.moments} />
      </div>

      <p className="text-caption text-ink-tertiary text-center leading-relaxed px-md pb-md">{quiet}<br />Guidance, not medical advice — see a professional for anything that worries you.</p>

      {/* ---------------- sheets ---------------- */}
      <ActionSheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="Physical" actions={[
        { id: 'snap', label: 'Add a snapshot', icon: <Plus size={20} />, onClick: () => openSnap() },
        { id: 'base', label: 'Edit my baseline', icon: <Pencil size={20} />, onClick: () => setSheet('baseline') },
        { id: 'hide', label: v.hide ? 'Show numbers' : 'Hide numbers (direction only)', icon: v.hide ? <Eye size={20} /> : <EyeOff size={20} />, onClick: toggleHide },
        { id: 'visit', label: 'Doctor-visit summary', icon: <FileText size={20} />, badge: !d.isPro && <span className="text-[10px] font-bold text-warning">PRO</span>, onClick: () => (d.isPro ? setSheet('visit') : setUpgrade('visit')) },
        { id: 'reset', label: 'Delete all Physical data', icon: <Trash2 size={20} />, danger: true, onClick: () => setSheet('reset') },
      ]} />

      <Sheet open={sheet === 'baseline'} onClose={() => setSheet(null)} tall title="My baseline">
        <Onboarding initial={d.profile} onSave={saveBaseline} onCancel={() => setSheet(null)} />
      </Sheet>

      <SnapshotSheet open={sheet === 'snapshot'} onClose={() => setSheet(null)} units={d.profile.units} hideNumbers={v.hide}
        existing={snap.existing} preset={snap.preset} onSave={saveSnap} onDelete={delSnap} />

      <Sheet open={sheet === 'visit'} onClose={() => setSheet(null)} tall title="Doctor-visit summary" subtitle="Self-reported, built from what you’ve shared. Stays on your device unless you copy it."
        footer={<div className="flex gap-sm">
          <button className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2" onClick={async () => { show((await copyText(visit)) ? 'Copied' : 'Could not copy') }}><Copy size={16} /> Copy</button>
          <button className="btn-primary flex-1 py-3 flex items-center justify-center gap-2" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([visit], { type: 'text/markdown' })); a.download = `health-notes-${today}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000) }}><Download size={16} /> Download</button>
        </div>}>
        <pre className="whitespace-pre-wrap text-body-small text-ink-primary font-sans leading-relaxed">{visit}</pre>
      </Sheet>

      <Sheet open={sheet === 'limit'} onClose={() => setSheet(null)} title={d.isPro ? 'Three experiments is plenty' : 'One experiment at a time'}
        subtitle={d.isPro ? 'Wrap one up to start another.' : 'Focus beats volume. Wrap up the current one, or run up to three at once with Pro.'}>
        <div className="flex flex-col gap-sm">
          {experimentsActive.map((e) => <button key={e.id} className="card p-md text-left hover:border-primary/50 transition" onClick={() => finish(e, { status: 'dropped' })}><span className="block text-body-small text-ink-primary">{e.title}</span><span className="block text-caption text-ink-tertiary">Tap to drop this one and make room</span></button>)}
          {!d.isPro && <button className="btn-primary w-full py-3 mt-sm" onClick={() => { setSheet(null); setUpgrade('experiments') }}>Run up to 3 with Pro</button>}
        </div>
      </Sheet>

      <ConfirmSheet open={sheet === 'reset'} onClose={() => setSheet(null)} danger title="Delete all Physical data?" confirmLabel="Delete everything"
        message="This permanently deletes your baseline, snapshots, experiments, moments and AI readings. Your journal and everything else stay." onConfirm={doReset} />

      <PhysicalUpgrade reason={upgrade} onClose={() => setUpgrade(null)} onUpgrade={() => { const r = upgrade || 'ai'; setUpgrade(null); navigate(`/upgrade?reason=${encodeURIComponent(r)}`) }} />
      {toast}
    </div>
  )
}
