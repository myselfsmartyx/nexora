import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import BottomNav from './components/BottomNav.jsx'
import Login from './pages/Login.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Capture from './pages/Capture.jsx'
import KnowledgeDetail from './pages/KnowledgeDetail.jsx'
import Journal from './pages/Journal.jsx'
import NeuroPlusHome from './pages/NeuroPlusHome.jsx'
import RapidMath from './pages/RapidMath.jsx'
import MemoryMatrix from './pages/MemoryMatrix.jsx'
import SchulteTable from './pages/SchulteTable.jsx'
import ChessGame from './pages/ChessGame.jsx'
import PersonalDevelopment from './pages/PersonalDevelopment.jsx'
import AiChat from './pages/AiChat.jsx'
import Settings from './pages/Settings.jsx'
import AppLock from './components/AppLock.jsx'
import Sidebar from './components/Sidebar.jsx'
import { applyTheme } from './lib/theme.js'

async function profileNeedsOnboarding(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_answers')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw error
    // No row, or the trigger-created row whose answers are still the default {} → onboard
    const a = data?.onboarding_answers
    return !data || a == null || (typeof a === 'object' && Object.keys(a).length === 0)
  } catch (err) {
    // Fail open: never lock a user out because of a read error
    console.warn('Onboarding check failed, letting user in:', err.message)
    return false
  }
}

// Page frame. The AI Companion gets a wider column on desktop so its chat-history sidebar fits.
function Frame({ children }) {
  const { pathname } = useLocation()
  const wide = pathname === '/ai' || pathname.startsWith('/ai/')
  return (
    <main className={`max-w-md ${wide ? 'lg:max-w-6xl' : 'lg:max-w-3xl'} mx-auto min-h-screen pb-24 lg:pb-10`}>
      {children}
    </main>
  )
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

  // Apply the user's saved theme/accent from their account (cached copy already applied at startup)
  const signedInUserId = session?.user?.id
  useEffect(() => {
    if (!signedInUserId) return
    let cancelled = false
    supabase
      .from('user_settings')
      .select('dark_mode, accent_color')
      .eq('user_id', signedInUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) applyTheme({ mode: data.dark_mode, accent: data.accent_color })
      })
    return () => {
      cancelled = true
    }
  }, [signedInUserId])

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

  const lockForgot = () => supabase.auth.signOut()

  // Signed in but never onboarded → 15-question flow
  if (needsOnboarding) {
    return (
      <AppLock userId={session.user.id} onForgot={lockForgot}>
        <Onboarding
          session={session}
          onComplete={() => setNeedsOnboarding(false)}
        />
      </AppLock>
    )
  }

  return (
    <AppLock userId={session.user.id} onForgot={lockForgot}>
    <BrowserRouter>
      {/* Mobile-first app frame: centered column on desktop, full-width on phone */}
      <div className="min-h-screen bg-base-bg lg:pl-64">
        <Sidebar />
        <Frame>
          <Routes>
            <Route path="/" element={<Navigate to="/capture" replace />} />
            <Route path="/capture" element={<Capture session={session} />} />
            <Route path="/capture/:id" element={<KnowledgeDetail session={session} />} />
            <Route path="/neuro" element={<NeuroPlusHome session={session} />} />
            <Route path="/neuro/rapid-math" element={<RapidMath session={session} />} />
            <Route path="/neuro/rapid-math/:op" element={<RapidMath session={session} />} />
            <Route path="/neuro/memory-matrix" element={<MemoryMatrix session={session} />} />
            <Route path="/neuro/schulte-table" element={<SchulteTable session={session} />} />
            <Route path="/neuro/chess" element={<ChessGame session={session} />} />
            <Route path="/ai" element={<AiChat session={session} />} />
            <Route path="/settings" element={<Settings session={session} />} />
            <Route path="/settings/:section" element={<Settings session={session} />} />
            <Route path="/journal/*" element={<Journal session={session} />} />
            <Route path="/growth" element={<PersonalDevelopment session={session} />} />
            <Route path="*" element={<Navigate to="/capture" replace />} />
          </Routes>
        </Frame>
        <BottomNav />
      </div>
    </BrowserRouter>
    </AppLock>
  )
}
