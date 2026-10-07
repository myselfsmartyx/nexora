import { Check, FolderPlus, Inbox, Lock } from 'lucide-react'
import { Sheet } from './ui.jsx'
import { useJournal } from '../../lib/journal/context.jsx'

// Choose a folder (or "Unfiled"). `value` is the current folder id (null = unfiled).
export default function FolderPicker({ open, onClose, value, onPick, onManage, title = 'Move to folder' }) {
  const { folders, overview } = useJournal()
  const counts = overview?.folders || {}
  const Row = ({ active, icon, label, sub, onClick }) => (
    <button onClick={() => { onPick(onClick); onClose() }} className="w-full flex items-center gap-md px-3 py-2.5 rounded-button hover:bg-base-elevated active:bg-base-elevated transition text-left">
      <span className="w-10 h-10 rounded-button flex items-center justify-center text-xl shrink-0 bg-base-elevated">{icon}</span>
      <span className="flex-1 min-w-0"><span className="block text-body text-ink-primary truncate">{label}</span>{sub && <span className="block text-caption text-ink-tertiary">{sub}</span>}</span>
      {active && <Check size={18} className="text-primary" />}
    </button>
  )
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col -mx-2">
        <Row active={value == null} icon={<Inbox size={20} className="text-ink-secondary" />} label="Unfiled" sub="No folder" onClick={null} />
        {folders.map((f) => (
          <Row key={f.id} active={value === f.id} icon={<span>{f.emoji}</span>}
            label={<span className="flex items-center gap-1.5">{f.name}{f.is_private && <Lock size={12} className="text-primary" />}</span>}
            sub={`${counts[f.id] || 0} entries`} onClick={f.id} />
        ))}
        {onManage && (
          <button onClick={() => { onClose(); onManage() }} className="flex items-center gap-md px-3 py-2.5 rounded-button hover:bg-base-elevated text-primary text-left mt-1">
            <span className="w-10 h-10 flex items-center justify-center"><FolderPlus size={20} /></span><span className="text-body">Manage folders</span>
          </button>
        )}
      </div>
    </Sheet>
  )
}
