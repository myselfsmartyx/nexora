import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Bell, Brain, Check, CheckCircle2, ChevronDown, CreditCard, Crown,
  HeartPulse, Loader2, Lock, Minus, ShieldCheck, Sparkles, Zap,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { usePlan } from '../lib/billing/usePlan.js'
import { startCheckout } from '../lib/billing/checkout.js'
import {
  TRIAL_DAYS, PROOF_LINE, PRICES, CURRENCIES, COMPARE, VALUE_GROUPS, REASON_LABEL, LEGAL,
  detectCurrency, money, yearlyPerMonth, yearlyPerDay, savingsPercent, shortDate, fullDate,
} from '../lib/billing/plans.js'

const ICONS = { brain: Brain, shield: ShieldCheck, zap: Zap, heart: HeartPulse }
const DAY = 86400000

// ---------- small pieces ----------
function Header({ onBack, title }) {
  return (
    <div className="flex items-center gap-sm mb-md">
      <button aria-label="Back" onClick={onBack} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-ink-secondary hover:bg-base-elevated transition">
        <ArrowLeft size={20} />
      </button>
      <span className="text-body-small font-semibold text-ink-primary flex items-center gap-1.5"><Crown size={14} className="text-warning" /> {title}</span>
    </div>
  )
}

function PlanOption({ selected, onSelect, title, badge, price, unit, lines }) {
  return (
    <button
      type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={`w-full text-left rounded-card p-md border transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        selected ? 'border-primary bg-primary/5 shadow-glow' : 'border-base-border bg-base-surface hover:border-ink-tertiary'
      }`}
    >
      <div className="flex items-center justify-between gap-sm">
        <div className="flex items-center gap-sm">
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-primary' : 'border-ink-tertiary'}`}>
            {selected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
          </span>
          <span className="text-body text-ink-primary font-semibold">{title}</span>
        </div>
        {badge && <span className="rounded-chip bg-primary text-base-bg text-caption font-bold px-2.5 py-0.5">{badge}</span>}
      </div>
      <p className="mt-sm pl-[28px]">
        <span className="text-h2 text-ink-primary">{price}</span>{' '}
        <span className="text-body-small text-ink-secondary">{unit}</span>
      </p>
      <div className="pl-[28px] mt-1 flex flex-col gap-0.5">
        {lines.map((l, i) => (
          <p key={i} className={`text-caption ${i === 0 ? 'text-ink-secondary' : 'text-primary font-semibold'}`}>{l}</p>
        ))}
      </div>
    </button>
  )
}

function TrialTimeline({ priceLabel }) {
  const now = Date.now()
  const day = (n) => shortDate(new Date(now + n * DAY))
  const steps = [
    { icon: Crown, when: 'Today', text: 'Pro unlocks right away. You pay nothing today.' },
    TRIAL_DAYS >= 3 && { icon: Bell, when: day(TRIAL_DAYS - 2), text: 'We email you a reminder, so there are no surprises.' },
    { icon: CreditCard, when: day(TRIAL_DAYS), text: `Your plan starts at ${priceLabel}. Cancel before this date and you pay nothing.` },
  ].filter(Boolean)
  return (
    <section aria-label="How your free trial works" className="card p-md">
      <h2 className="text-h3 text-ink-primary mb-md">How your free trial works</h2>
      <ol className="relative flex flex-col gap-md">
        <span aria-hidden className="absolute left-[15px] top-4 bottom-4 w-px bg-base-border" />
        {steps.map(({ icon: Icon, when, text }) => (
          <li key={when} className="relative flex gap-md">
            <span className="relative z-10 w-8 h-8 rounded-full bg-base-elevated border border-base-border text-primary flex items-center justify-center shrink-0"><Icon size={15} /></span>
            <div>
              <p className="text-body-small text-ink-primary font-semibold">{when}</p>
              <p className="text-body-small text-ink-secondary leading-relaxed">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ValueGroup({ group, reason }) {
  const Icon = ICONS[group.icon] || Sparkles
  const hit = reason && group.items.some((i) => i.keys.includes(reason))
  return (
    <section className={`card p-md ${hit ? 'border-primary shadow-glow' : ''}`}>
      <h3 className="text-body text-ink-primary font-semibold flex items-center gap-sm mb-sm"><Icon size={18} className="text-primary" /> {group.title}</h3>
      <ul className="flex flex-col gap-2">
        {group.items.map((it) => {
          const on = reason && it.keys.includes(reason)
          return (
            <li key={it.text} className={`flex items-start gap-sm text-body-small leading-snug ${on ? 'text-ink-primary font-medium' : 'text-ink-secondary'}`}>
              <Check size={15} strokeWidth={3} className="text-primary shrink-0 mt-0.5" /> {it.text}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function CompareTable() {
  return (
    <section className="card p-md">
      <h2 className="text-h3 text-ink-primary mb-sm">Free and Pro, side by side</h2>
      <table className="w-full text-body-small">
        <caption className="sr-only">What is included in Free and in Pro</caption>
        <thead>
          <tr className="text-left">
            <th scope="col" className="py-2 pr-2 font-medium text-ink-tertiary"><span className="sr-only">Feature</span></th>
            <th scope="col" className="py-2 px-2 font-medium text-ink-secondary text-center w-[28%]">Free</th>
            <th scope="col" className="py-2 pl-2 font-semibold text-primary text-center w-[30%]">Pro</th>
          </tr>
        </thead>
        <tbody>
          {COMPARE.map(([label, free, pro]) => (
            <tr key={label} className="border-t border-base-border/70">
              <th scope="row" className="py-2.5 pr-2 text-left font-normal text-ink-primary">{label}</th>
              <td className="py-2.5 px-2 text-center text-ink-secondary">
                {free ?? <Minus size={14} className="inline text-ink-tertiary" aria-label="Not included" />}
              </td>
              <td className="py-2.5 pl-2 text-center text-ink-primary font-medium">{pro}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Faq({ currency, trialEnd }) {
  const items = [
    ['What happens if I cancel?', 'You keep Pro until the end of the period you have paid for. After that you return to the Free limits. Nothing is deleted, and you can export everything at any time.'],
    TRIAL_DAYS > 0 && ['How does the free trial work?', `You get all of Pro for ${TRIAL_DAYS} days. We email you 2 days before it ends. Cancel before ${shortDate(trialEnd)} in Settings and you pay nothing.`],
    ['Is my journal really private?', 'Private entries are end-to-end encrypted on your device before they are saved, so we cannot read them. Pro simply removes the limits on how many you can have.'],
    ['How is payment handled?', `${CURRENCIES[currency].note} We never see or store your card details.`],
  ].filter(Boolean)
  return (
    <section aria-label="Frequently asked questions" className="flex flex-col gap-sm">
      <h2 className="text-h3 text-ink-primary">Good questions</h2>
      {items.map(([q, a]) => (
        <details key={q} className="group card px-md">
          <summary className="flex items-center justify-between gap-sm py-3 cursor-pointer list-none text-body-small font-medium text-ink-primary [&::-webkit-details-marker]:hidden">
            {q}<ChevronDown size={16} className="text-ink-tertiary transition group-open:rotate-180 shrink-0" />
          </summary>
          <p className="pb-3 text-body-small text-ink-secondary leading-relaxed">{a}</p>
        </details>
      ))}
    </section>
  )
}

function useMyProgress(userId) {
  const [p, setP] = useState(null)
  useEffect(() => {
    if (!userId) return undefined
    let off = false
    Promise.all([
      supabase.from('knowledge_items').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('journal_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])
      .then(([a, b]) => { if (!off) setP({ captures: a.count || 0, entries: b.count || 0 }) })
      .catch(() => {})
    return () => { off = true }
  }, [userId])
  return p
}

// ---------- the pricing screen ----------
export default function Upgrade({ session }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const reason = params.get('reason') || ''
  const { isPro, loading, status, periodEnd } = usePlan()
  const progress = useMyProgress(session?.user?.id)

  const [currency, setCurrency] = useState(detectCurrency)
  const [billing, setBilling] = useState('year')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/capture'))

  if (!loading && isPro) {
    return (
      <div className="px-md pt-md">
        <Header onBack={back} title="Nexora Pro" />
        <div className="card p-lg text-center">
          <CheckCircle2 size={40} className="text-primary mx-auto mb-md" />
          <h1 className="text-h2 text-ink-primary">You're on Pro</h1>
          <p className="text-body-small text-ink-secondary mt-sm">
            {status === 'cancelled' ? `Pro stays active until ${fullDate(periodEnd)}.` : periodEnd ? `Next billing date: ${fullDate(periodEnd)}.` : 'Everything in Pro is unlocked.'}
          </p>
          <button className="btn-primary w-full py-3.5 mt-lg" onClick={() => navigate('/settings/account')}>Manage plan</button>
        </div>
      </div>
    )
  }

  const prices = PRICES[currency]
  const selectedPrice = money(prices[billing], currency)
  const unit = billing === 'year' ? 'year' : 'month'
  const trialEnd = new Date(Date.now() + TRIAL_DAYS * DAY)
  const showProgress = progress && progress.captures + progress.entries >= 3

  async function start() {
    setError('')
    setBusy(true)
    try {
      await startCheckout({ interval: billing, currency, reason })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="px-md pt-md -mb-24 lg:-mb-10 animate-rise">
      <Header onBack={back} title="Nexora Pro" />

      <h1 className="text-h1 text-ink-primary leading-tight">{PROOF_LINE}</h1>
      <p className="text-body text-ink-secondary leading-relaxed mt-sm">
        Pro adds an AI that knows your own notes and journal, more privacy, and room to grow.
      </p>

      {REASON_LABEL[reason] && (
        <div className="mt-md rounded-card bg-primary/5 border border-primary/20 p-md flex gap-sm items-start">
          <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-body-small text-ink-secondary">You were trying <span className="text-ink-primary font-semibold">{REASON_LABEL[reason]}</span>. It's included in every Pro plan.</p>
        </div>
      )}

      {showProgress && (
        <p className="mt-md text-body-small text-ink-secondary">
          You've already saved <span className="text-ink-primary font-semibold">{progress.captures}</span> {progress.captures === 1 ? 'idea' : 'ideas'} and
          written <span className="text-ink-primary font-semibold">{progress.entries}</span> {progress.entries === 1 ? 'entry' : 'entries'}. Pro makes all of it work harder for you.
        </p>
      )}

      <div className="mt-lg flex items-center justify-between gap-sm">
        <h2 className="text-h3 text-ink-primary">Choose your plan</h2>
        <div role="group" aria-label="Currency" className="flex gap-1 p-1 rounded-chip bg-base-elevated border border-base-border">
          {['INR', 'USD'].map((c) => (
            <button
              key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)}
              className={`px-3 py-1 rounded-chip text-caption font-semibold transition ${currency === c ? 'bg-primary text-base-bg' : 'text-ink-secondary'}`}
            >{c === 'INR' ? '₹ India' : '$ Worldwide'}</button>
          ))}
        </div>
      </div>

      <div role="radiogroup" aria-label="Billing period" className="mt-sm flex flex-col gap-sm">
        <PlanOption
          selected={billing === 'year'} onSelect={() => setBilling('year')}
          title="Annual" badge="Best value"
          price={money(prices.year, currency)} unit="a year"
          lines={[
            `That is ${money(yearlyPerMonth(currency), currency)} a month, about ${money(yearlyPerDay(currency), currency)} a day.`,
            `Save ${savingsPercent(currency)}% compared with paying monthly`,
          ]}
        />
        <PlanOption
          selected={billing === 'month'} onSelect={() => setBilling('month')}
          title="Monthly"
          price={money(prices.month, currency)} unit="a month"
          lines={['Billed monthly. Cancel anytime.']}
        />
      </div>

      <div className="mt-lg flex flex-col gap-md">
        {TRIAL_DAYS > 0 && <TrialTimeline priceLabel={`${selectedPrice} a ${unit}`} />}

        <div className="flex flex-col gap-sm">
          <h2 className="text-h3 text-ink-primary">What Pro gives you</h2>
          {VALUE_GROUPS.map((g) => <ValueGroup key={g.id} group={g} reason={reason} />)}
        </div>

        <CompareTable />

        <div className="rounded-card bg-primary/5 border border-primary/20 p-md">
          <p className="text-body-small text-ink-primary font-semibold flex items-center gap-1.5 mb-1"><ShieldCheck size={15} className="text-primary" /> Your data stays yours</p>
          <p className="text-caption text-ink-secondary leading-relaxed">
            Unlimited journal entries, search, tags, all Neuro+ games, and exporting everything are free forever. If you ever leave Pro, nothing is deleted.
          </p>
        </div>

        <Faq currency={currency} trialEnd={trialEnd} />

        <p className="text-caption text-ink-tertiary text-center pb-md">
          {[['Terms', LEGAL.terms], ['Privacy', LEGAL.privacy], ['Refunds', LEGAL.refunds]]
            .filter(([, href]) => href)
            .map(([label, href], i) => (
              <span key={label}>{i > 0 && '  |  '}<a href={href} target="_blank" rel="noreferrer" className="underline">{label}</a></span>
            ))}
        </p>
      </div>

      <div
        className="sticky bottom-0 z-40 -mx-md px-md pt-sm bg-base-bg/95 backdrop-blur border-t border-base-border"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        {error && <p role="alert" className="text-caption text-error mb-2 text-center">{error}</p>}
        <button className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60" onClick={start} disabled={busy}>
          {busy ? <><Loader2 size={16} className="animate-spin" /> Opening secure checkout</> : TRIAL_DAYS > 0 ? `Start ${TRIAL_DAYS}-day free trial` : `Get Pro for ${selectedPrice}`}
        </button>
        <p className="text-caption text-ink-secondary text-center mt-2 flex items-center justify-center gap-1.5">
          <Lock size={11} />
          {TRIAL_DAYS > 0
            ? `Then ${selectedPrice} a ${unit}. Cancel before ${shortDate(trialEnd)} and pay nothing.`
            : `${selectedPrice} a ${unit}. Cancel anytime in Settings.`}
        </p>
      </div>
    </div>
  )
}

// ---------- where the payment provider sends people back to ----------
// We never trust the address bar. The page asks the database whether Pro is active,
// and that only turns true when the provider's signed webhook has been verified.
export function UpgradeDone() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { refresh, periodEnd } = usePlan()
  const failed = ['failed', 'cancelled', 'canceled'].includes((params.get('status') || '').toLowerCase())
  const [phase, setPhase] = useState(failed ? 'failed' : 'checking')
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (failed) return undefined
    let stopped = false
    let timer
    const started = Date.now()
    setPhase('checking')
    async function tick() {
      const p = await refresh()
      if (stopped) return
      if (p?.plan === 'pro') return setPhase('active')
      if (Date.now() - started > 45000) return setPhase('slow')
      timer = setTimeout(tick, 2500)
      return undefined
    }
    tick()
    return () => { stopped = true; clearTimeout(timer) }
  }, [failed, refresh, round])

  return (
    <div className="px-md pt-xl">
      <div className="card p-lg text-center animate-pop-in" role="status" aria-live="polite">
        {phase === 'checking' && (
          <>
            <Loader2 size={36} className="animate-spin text-primary mx-auto mb-md" />
            <h1 className="text-h2 text-ink-primary">Confirming your payment</h1>
            <p className="text-body-small text-ink-secondary mt-sm">This usually takes a few seconds. You can stay on this page.</p>
          </>
        )}
        {phase === 'active' && (
          <>
            <CheckCircle2 size={44} className="text-primary mx-auto mb-md" />
            <h1 className="text-h2 text-ink-primary">Welcome to Pro</h1>
            <p className="text-body-small text-ink-secondary mt-sm">
              Everything is unlocked.{periodEnd ? ` Your next billing date is ${fullDate(periodEnd)}.` : ''}
            </p>
            <div className="flex flex-col gap-sm mt-lg">
              <button className="btn-primary w-full py-3.5" onClick={() => navigate('/journal')}>Ask your journal something</button>
              <button className="btn-secondary w-full" onClick={() => navigate('/ai')}>Chat with your AI companion</button>
            </div>
          </>
        )}
        {phase === 'slow' && (
          <>
            <h1 className="text-h2 text-ink-primary">Still confirming</h1>
            <p className="text-body-small text-ink-secondary mt-sm leading-relaxed">
              If you completed the payment, Pro switches on as soon as your bank confirms it, and you do not need to pay again. You can keep using Nexora meanwhile.
            </p>
            <div className="flex flex-col gap-sm mt-lg">
              <button className="btn-primary w-full py-3.5" onClick={() => setRound((r) => r + 1)}>Check again</button>
              <button className="btn-secondary w-full" onClick={() => navigate('/capture')}>Continue to Nexora</button>
            </div>
          </>
        )}
        {phase === 'failed' && (
          <>
            <h1 className="text-h2 text-ink-primary">No payment was made</h1>
            <p className="text-body-small text-ink-secondary mt-sm">You have not been charged. You can try again whenever you like.</p>
            <div className="flex flex-col gap-sm mt-lg">
              <button className="btn-primary w-full py-3.5" onClick={() => navigate('/upgrade')}>Back to plans</button>
              <button className="btn-secondary w-full" onClick={() => navigate('/capture')}>Continue to Nexora</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
