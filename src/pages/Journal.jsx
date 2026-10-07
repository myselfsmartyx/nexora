import { Navigate, Route, Routes } from 'react-router-dom'
import { JournalProvider } from '../lib/journal/context.jsx'
import JournalHome from './JournalHome.jsx'
import JournalEditor from './JournalEditor.jsx'
import JournalEntry from './JournalEntry.jsx'

// /journal/*  →  list · new · open · edit. One provider keeps plan, tags, folders and the
// unlocked vault alive while you move between them.
export default function Journal({ session }) {
  return (
    <JournalProvider session={session}>
      <Routes>
        <Route index element={<JournalHome />} />
        <Route path="new" element={<JournalEditor />} />
        <Route path=":id" element={<JournalEntry />} />
        <Route path=":id/edit" element={<JournalEditor />} />
        <Route path="*" element={<Navigate to="/journal" replace />} />
      </Routes>
    </JournalProvider>
  )
}
