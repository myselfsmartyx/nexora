import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import BottomNav from './components/BottomNav.jsx'
import Login from './pages/Login.jsx'
import Placeholder from './pages/Placeholder.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Check existing session on load
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    // Listen for sign-in / sign-out (works across tabs too)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Splash while we check the session
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-bg">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-base-bg text-h1 font-extrabold shadow-glow animate-pulse">
          N
        </div>
      </div>
    )
  }

  // Not signed in → Login (full screen, no tabs)
  if (!session) {
    return <Login />
  }

  return (
    <BrowserRouter>
      {/* Mobile-first app frame: centered column on desktop, full-width on phone */}
      <div className="min-h-screen bg-base-bg">
        <main className="max-w-md mx-auto min-h-screen pb-24">
          <Routes>
            <Route path="/" element={<Navigate to="/capture" replace />} />
            <Route path="/capture" element={<Capture />} />
            <Route
              path="/neuro"
              element={
                <Placeholder title="Neuro Plus" subtitle="Train your brain daily." />
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
                <Placeholder title="My Journal" subtitle="Reflect. Track. Grow." />
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
            <Route path="*" element={<Navigate to="/capture" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
