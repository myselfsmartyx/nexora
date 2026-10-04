import { supabase } from './supabase.js'

// Calls a Supabase Edge Function and turns failures into readable errors.
// supabase-js hides the server's JSON error body behind a generic message, so we read it
// ourselves — that's how users see "You've used all free captures today" instead of
// "Edge Function returned a non-2xx status code".
export async function invokeFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = null
    let code = null
    try {
      const ctx = error.context
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json()
        message = typeof j?.error === 'string' ? j.error : null
        code = j?.code || null
      }
    } catch {
      /* body wasn't JSON — fall through to generic text */
    }
    if (!message && error.name === 'FunctionsFetchError') {
      message = "Can't reach Nexora right now. Check your connection and try again."
    }
    const err = new Error(message || 'Something went wrong. Please try again.')
    err.code = code
    throw err
  }
  if (data?.error) {
    const err = new Error(String(data.error))
    err.code = data.code || null
    throw err
  }
  return data
}
