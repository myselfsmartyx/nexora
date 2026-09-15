import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import BottomNav from './components/BottomNav.jsx'
import Placeholder from './pages/Placeholder.jsx'

export default function App() {
  return (
    <BrowserRouter>
      {/* Mobile-first app frame: app looks like a native app,
          centered column on desktop, full-width on phone */}
      <div className="min-h-screen bg-base-bg">
        <main className="max-w-md mx-auto min-h-screen pb-24">
          <Routes>
            <Route path="/" element={<Navigate to="/capture" replace />} />
            <Route
              path="/capture"
              element={
                <Placeholder
                  title="Smart Capture"
                  subtitle="Capture anything. AI extracts what matters."
                />
              }
            />
            <Route
              path="/neuro"
              element={
                <Placeholder
                  title="Neuro Plus"
                  subtitle="Train your brain daily."
                />
              }
            />
            <Route
              path="/ai"
              element={
                <Placeholder
                  title="AI Companion"
                  subtitle="Practical, execution-oriented guidance."
                />
              }
            />
            <Route
              path="/journal"
              element={
                <Placeholder
                  title="My Journal"
                  subtitle="Reflect. Track. Grow."
                />
              }
            />
            <Route
              path="/growth"
              element={
                <Placeholder
                  title="Personal Growth"
                  subtitle="Your personalized development engine."
                />
              }
            />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
