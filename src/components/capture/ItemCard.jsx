import { FileText, Link2, Mic, Video, Image as ImageIcon, RefreshCw, Sparkles, Star, AlertTriangle, PencilLine } from 'lucide-react'
import { PLATFORM_LABEL } from '../../lib/capture.js'

export function timeAgo(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 172800) return 'Yesterday'
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return d.toLocaleDateString()
}

export function firstInsight(insights) {
  if (!insights) return null
  if (Array.isArray(insights) && insights.length > 0) {
    return typeof insights[0] === 'string' ? insights[0] : insights[0]?.text || null
  }
  if (typeof insights === 'object') {
    const arr = insights.key_insights || insights.insights
    if (Array.isArray(arr) && arr.length > 0) {
      return typeof arr[0] === 'string' ? arr[0] : arr[0]?.text || null
    }
  }
  return null
}

const CAT_STYLE = {
  'SEO & Marketing': 'bg-success/10 text-success border-success/20',
  'Business Strategy': 'bg-secondary/10 text-secondary border-secondary/20',
  'Personal Development': 'bg-warning/10 text-warning border-warning/20',
  'Productivity': 'bg-primary/10 text-primary border-primary/20',
  'AI & Tools': 'bg-primary/10 text-primary border-primary/20',
  'Finance': 'bg-success/10 text-success border-success/20',
}
export const catStyle = (c) => CAT_STYLE[c] || 'bg-base-elevated text-ink-secondary border-base-border'

export const SOURCE_ICON = {
  url: Link2, pdf: FileText, screenshot: ImageIcon, note: FileText, voice: Mic, video: Video, file: FileText,
}

// `analyzing` = AI is running right now in this session. `onRetry` re-runs analysis for failed items.
export default function ItemCard({ item, analyzing = false, onOpen, onRetry }) {
  const Icon = SOURCE_ICON[item.source_type] || FileText
  const insight = firstInsight(item.insights)
  const processing = analyzing || item.status === 'processing'
  const platform = item.source_platform && item.source_platform !== 'web' ? PLATFORM_LABEL[item.source_platform] : null

  return (
    <article className="bg-base-surface rounded-card border border-base-border/60 relative hover:border-primary/50 transition duration-300">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(item)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(item))}
        className="p-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-card"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          {processing ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-primary/10 text-primary border-primary/20">
              <RefreshCw size={10} className="animate-spin" /> Analyzing…
            </span>
          ) : (
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${catStyle(item.category)}`}>
              {item.category || 'Uncategorized'}
            </span>
          )}
          <span className="flex items-center gap-2">
            {item.status === 'needs_details' && !processing && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning">
                <PencilLine size={11} /> Needs details
              </span>
            )}
            {item.is_favorite && <Star size={14} className="text-warning" fill="currentColor" />}
          </span>
        </div>

        <h3 className="text-h3 text-ink-primary mb-2 break-words">{item.title}</h3>

        {item.status === 'failed' && !processing ? (
          <div className="bg-error/10 border border-error/20 rounded-md p-2 mb-3 flex items-center justify-between gap-2">
            <p className="text-body-small text-error flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" /> AI analysis didn't finish.
            </p>
            {onRetry && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetry(item.id) }}
                className="text-caption font-semibold text-primary hover:underline shrink-0"
              >
                Try again
              </button>
            )}
          </div>
        ) : insight ? (
          <div className="bg-primary/5 border border-primary/20 rounded-md p-2 mb-3">
            <p className="text-body-small text-ink-primary flex items-start gap-2">
              <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
              <span className="line-clamp-3">{insight}</span>
            </p>
          </div>
        ) : item.summary ? (
          <p className="text-body-small text-ink-secondary mb-3 line-clamp-3">{item.summary}</p>
        ) : null}

        {(item.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {item.tags.slice(0, 6).map((t) => (
              <span key={t} className="text-xs text-ink-secondary">#{t}</span>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-base-border/50">
          <span className="text-xs text-ink-secondary flex items-center gap-1 min-w-0">
            <Icon size={14} className="shrink-0" />
            <span className="truncate">{platform ? `${platform} · ` : ''}Saved {timeAgo(item.captured_at)}</span>
          </span>
          <div className="flex gap-0.5" aria-label={`Importance ${item.importance || 1} of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className={`w-1.5 h-1.5 rounded-full ${n <= (item.importance || 1) ? 'bg-primary' : 'bg-base-border'}`} />
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}
