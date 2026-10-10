import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase.js'

// Reads the caller's plan from the database function my_plan(). The server decides
// who is Pro (webhooks write it); the app only ever reads it.
const FREE = { plan: 'free', status: 'incomplete' }

function shape(p) {
  return {
    plan: p.plan === 'pro' ? 'pro' : 'free',
    status: p.status || 'incomplete',
    provider: p.provider || null,
    interval: p.interval || null,
    periodEnd: p.current_period_end || null,
    cancelAtPeriodEnd: !!p.cancel_at_period_end,
  }
}

export function usePlan() {
  const [state, setState] = useState({ ...shape(FREE), loading: true, error: false })
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('my_plan')
      if (error) throw error
      const next = shape(data || FREE)
      if (alive.current) setState({ ...next, loading: false, error: false })
      return next
    } catch {
      // Never lock anyone out because of a read error; show Free and flag it.
      if (alive.current) setState((s) => ({ ...s, loading: false, error: true }))
      return null
    }
  }, [])

  useEffect(() => {
    alive.current = true
    refresh()
    return () => { alive.current = false }
  }, [refresh])

  return { ...state, isPro: state.plan === 'pro', refresh }
}
