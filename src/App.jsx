import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import BottomNav from './components/BottomNav.jsx'
import Login from './pages/Login.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Capture from './pages/Capture.jsx'
import Journal from './pages/Journal.jsx'
import NeuroPlusHome from './pages/NeuroPlusHome.jsx'
import RapidMath from './pages/RapidMath.jsx'
import MemoryMatrix from './pages/MemoryMatrix.jsx'
import SchulteTable from './pages/SchulteTable.jsx'
import ChessGame from './pages/ChessGame.jsx'
import PersonalDevelopment from './pages/PersonalDevelopment.jsx'
import Placeholder from './pages/Placeholder.jsx'

async function profileNeedsOnboarding(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_answers')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw error
    // New users (trigger-created row, no answers yet) → onboard
    return !data || data.onboarding_answers == null
  } catch (err) {
    // Fail open: never lock a user out because of a read error
    console.warn('Onboarding check failed, letting user in:', err.message)
    return false
  }
}

export default function App() {
  const [session, setSession] = useState(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function handleSession(newSession) {
      setSession(newSession)
      if (newSession?.user) {
        setNeedsOnboarding(await profileNeedsOnboarding(newSession.user.id))
      } else {
        setNeedsOnboarding(false)
      }
    }
    // Check existing session on load
    supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session).finally(() => setChecking(false))
    })
    // Listen for sign-in / sign-out (works across tabs too)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      handleSession(newSession)
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

  // Signed in but never onboarded → 15-question flow
  if (needsOnboarding) {
    return (
      <Onboarding
        session={session}
        onComplete={() => setNeedsOnboarding(false)}
      />
    )
  }

  return (
    <BrowserRouter>
      {/* Mobile-first app frame: centered column on desktop, full-width on phone */}
      <div className="min-h-screen bg-base-bg">
        <main className="max-w-md mx-auto min-h-screen pb-24">
          <Routes>
            <Route path="/" element={<Navigate to="/capture" replace />} />
            <Route path="/capture" element={<Capture session={session} />} />
            <Route path="/neuro" element={<NeuroPlusHome session={session} />} />
            <Route path="/neuro/rapid-math" element={<RapidMath session={session} />} />
            <Route path="/neuro/rapid-math/:op" element={<RapidMath session={session} />} />
            <Route path="/neuro/memory-matrix" element={<MemoryMatrix session={session} />} />
            <Route path="/neuro/schulte-table" element={<SchulteTable session={session} />} />
            <Route path="/neuro/chess" element={<ChessGame session={session} />} />
            <Route
              path="/ai"
              element={
                <Placeholder
                  title="AI Companion"
                  subtitle="Practical, execution-oriented guidance."
                />
              }
            />
            <Route path="/journal" element={<Journal session={session} />} />
            <Route path="/growth" element={<PersonalDevelopment session={session} />} />
            <Route path="*" element={<Navigate to="/capture" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
