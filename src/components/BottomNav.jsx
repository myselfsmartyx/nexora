import { NavLink } from 'react-router-dom'
import { Camera, Brain, Sparkles, BookOpen, TrendingUp } from 'lucide-react'

const tabs = [
  { to: '/capture', label: 'Capture', icon: Camera },
  { to: '/neuro', label: 'Neuro+', icon: Brain },
  { to: '/ai', label: 'AI', icon: Sparkles },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/growth', label: 'Growth', icon: TrendingUp },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md
                 bg-base-surface/95 backdrop-blur border-t border-base-border
                 grid grid-cols-5 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to}>
          {({ isActive }) => (
            <div
              className={`flex flex-col items-center gap-1 py-2.5 text-caption font-medium transition-fast ${
                isActive
                  ? 'text-primary'
                  : 'text-ink-tertiary hover:text-ink-secondary'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
              {label}
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
