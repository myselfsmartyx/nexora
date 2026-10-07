import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Crown } from 'lucide-react'
import { PALETTE } from '../../lib/journal/constants.js'

// ---------- Bottom sheet (centered dialog on desktop) ----------
export function Sheet({ open, onClose, title, subtitle, children, footer, tall = false }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end lg:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        className={`relative w-full max-w-md lg:max-w-lg bg-base-surface border border-base-border rounded-t-sheet lg:rounded-sheet shadow-card animate-sheet-up flex flex-col ${tall ? 'max-h-[92vh]' : 'max-h-[85vh]'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="lg:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-base-border" />
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-md px-md pt-md pb-sm">
            <div className="min-w-0">
              {title && <h2 className="text-h3 text-ink-primary truncate">{title}</h2>}
              {subtitle && <p className="text-body-small text-ink-secondary mt-xs">{subtitle}</p>}
            </div>
            {onClose && (
              <button aria-label="Close" onClick={onClose} className="shrink-0 w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-ink-secondary hover:bg-base-elevated transition">
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto px-md pb-md flex-1 min-h-0">{children}</div>
        {footer && <div className="px-md pb-md pt-sm border-t border-base-border/60">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

// ---------- Toast with optional action (e.g. Undo) ----------
export function useToast() {
  const [t, setT] = useState(null)
  const timer = useRef(null)
  const show = useCallback((message, action, ms = 4000) => {
    clearTimeout(timer.current)
    setT({ message, action, id: Date.now() })
    timer.current = setTimeout(() => setT(null), action ? Math.max(ms, 5500) : ms)
  }, [])
  const hide = useCallback(() => { clearTimeout(timer.current); setT(null) }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const node = t
    ? createPortal(
        <div key={t.id} className="fixed left-1/2 -translate-x-1/2 bottom-24 lg:bottom-8 z-[90] animate-pop-in max-w-[92vw]" role="status" aria-live="polite">
          <div className="flex items-center gap-md bg-base-elevated border border-base-border text-ink-primary text-body-small pl-md pr-sm py-2.5 rounded-button shadow-card">
            <span className="line-clamp-2">{t.message}</span>
            {t.action && (
              <button onClick={() => { t.action.onClick(); hide() }} className="shrink-0 text-primary font-semibold px-2 py-1 rounded-md hover:bg-primary/10">
                {t.action.label}
              </button>
            )}
          </div>
        </div>,
        document.body
      )
    : null
  return { toast: node, show, hide }
}

// ---------- Small pieces ----------
export function TagChip({ name, color = '#00D4AA', onClick, onRemove, active = false, count, size = 'sm' }) {
  const pad = size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-caption'
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-chip border font-medium transition ${pad} ${onClick ? 'active:scale-95' : ''}`}
      style={{ color, background: `${color}${active ? '33' : '1A'}`, borderColor: active ? color : `${color}44` }}
    >
      <span className="opacity-70">#</span>
      {name}
      {count != null && <span className="opacity-60 ml-0.5">{count}</span>}
      {onRemove && (
        <span role="button" tabIndex={0} aria-label={`Remove ${name}`} onClick={(e) => { e.stopPropagation(); onRemove() }}
          onKeyDown={(e) => e.key === 'Enter' && onRemove()} className="ml-0.5 -mr-0.5 rounded-full hover:bg-black/20 p-0.5 cursor-pointer">
          <X size={12} />
        </span>
      )}
    </Tag>
  )
}

export function ProBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-base-bg ${className}`}
      style={{ background: 'linear-gradient(135deg,#F59E0B,#F97316)' }}>
      <Crown size={10} /> Pro
    </span>
  )
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-base-border'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {PALETTE.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)}
          className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90"
          style={{ background: c, boxShadow: value === c ? `0 0 0 2px rgb(var(--c-surface)), 0 0 0 4px ${c}` : 'none' }}>
          {value === c && <Check size={16} className="text-base-bg" strokeWidth={3} />}
        </button>
      ))}
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-shimmer rounded-card bg-base-elevated ${className}`} />
}

export function EntrySkeletons({ n = 4 }) {
  return (
    <div className="flex flex-col gap-md" aria-busy="true" aria-label="Loading entries">
      {Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-[112px]" />)}
    </div>
  )
}

export function ConfirmSheet({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, busy = false }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-body-small text-ink-secondary leading-relaxed mb-lg">{message}</p>
      <div className="flex gap-sm">
        <button className="btn-secondary flex-1 py-3" onClick={onClose} disabled={busy}>Cancel</button>
        <button onClick={onConfirm} disabled={busy}
          className={`flex-1 py-3 rounded-button font-semibold uppercase tracking-wider text-sm active:scale-[0.98] transition disabled:opacity-60 ${danger ? 'bg-error text-white' : 'btn-primary'}`}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}

export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div className={`inline-flex p-1 rounded-button bg-base-elevated border border-base-border ${className}`} role="tablist">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[9px] text-body-small font-medium transition-all duration-200 ${value === o.id ? 'bg-base-surface text-primary shadow-card' : 'text-ink-secondary hover:text-ink-primary'}`}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  )
}

// Highlights search matches in a string (safe: returns React nodes, never HTML).
export function Highlight({ text, query }) {
  const q = (query || '').trim()
  if (!q || !text) return text || null
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  const parts = []
  let i = 0
  let at = lower.indexOf(needle)
  let guard = 0
  while (at !== -1 && guard++ < 20) {
    if (at > i) parts.push(text.slice(i, at))
    parts.push(<mark key={at} className="bg-primary/25 text-ink-primary rounded px-0.5">{text.slice(at, at + needle.length)}</mark>)
    i = at + needle.length
    at = lower.indexOf(needle, i)
  }
  parts.push(text.slice(i))
  return parts
}

// ---------- Action list (the "⋮" menu) ----------
export function ActionSheet({ open, onClose, title, subtitle, actions }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="flex flex-col -mx-2">
        {actions.filter(Boolean).map((a) => (
          <button key={a.id} disabled={a.disabled}
            onClick={() => { onClose(); a.onClick() }}
            className={`flex items-center gap-md px-3 py-3 rounded-button text-left transition hover:bg-base-elevated active:bg-base-elevated disabled:opacity-40 ${a.danger ? 'text-error' : 'text-ink-primary'}`}>
            <span className={a.danger ? 'text-error' : 'text-ink-secondary'}>{a.icon}</span>
            <span className="text-body flex-1">{a.label}</span>
            {a.badge}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
