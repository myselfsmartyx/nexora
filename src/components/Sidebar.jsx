import { NavLink } from 'react-router-dom'
import { Camera, Brain, Sparkles, BookOpen, TrendingUp, Settings } from 'lucide-react'

// Desktop-only navigation (phones keep the bottom bar).
const tabs = [
  { to: '/capture', label: 'Smart Capture', hint: 'Save & organize', icon: Camera },
  { to: '/neuro', label: 'Neuro Plus', hint: 'Train your brain', icon: Brain },
  { to: '/ai', label: 'AI Companion', hint: 'Ask your knowledge', icon: Sparkles },
  { to: '/journal', label: 'My Journal', hint: 'Reflect & write', icon: BookOpen },
  { to: '/growth', label: 'Growth', hint: 'Habits & vocabulary', icon: TrendingUp },
]

function Item({ to, label, hint, icon: Icon }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div
          className={`flex items-center gap-md px-md py-3 rounded-button border transition-colors duration-200 ${
            isActive
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-transparent text-ink-secondary hover:bg-base-elevated hover:text-ink-primary'
          }`}
        >
          <Icon size={22} strokeWidth={isActive ? 2.4 : 2} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-body font-medium leading-tight">{label}</p>
            {hint && <p className="text-caption text-ink-tertiary truncate">{hint}</p>}
          </div>
        </div>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-base-surface border-r border-base-border z-40 px-md py-lg">
      <div className="flex items-center gap-md px-sm mb-xl">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-base-bg text-h3 font-extrabold shadow-glow">
          N
        </div>
        <div>
          <p className="text-h3 text-ink-primary leading-tight">Nexora</p>
          <p className="text-caption text-ink-tertiary">Personal OS</p>
        </div>
      </div>

      <nav className="flex flex-col gap-xs">
        {tabs.map((t) => (
          <Item key={t.to} {...t} />
        ))}
      </nav>

      <div className="mt-auto pt-md border-t border-base-border">
        <Item to="/settings" label="Settings" icon={Settings} />
      </div>
    </aside>
  )
}
