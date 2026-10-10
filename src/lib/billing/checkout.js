import { supabase } from '../supabase.js'

// The server hands back a hosted payment page. We only ever follow it to a payment
// provider's own domain over HTTPS, so a bad response can never send someone elsewhere.
const ALLOWED_HOSTS = [/(^|\.)dodopayments\.com$/, /(^|\.)razorpay\.com$/, /^rzp\.io$/]

export function safeCheckoutUrl(raw) {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && ALLOWED_HOSTS.some((re) => re.test(u.hostname)) ? u.toString() : null
  } catch {
    return null
  }
}

export class BillingError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const MESSAGES = {
  rate_limited: 'Too many attempts. Please wait a minute and try again.',
  already_subscribed: "You're already on Pro. Manage your plan in Settings.",
  unauthorized: 'Please sign in again to continue.',
  unavailable: "Checkout isn't available right now. You haven't been charged. Please try again in a moment.",
}

async function errorCode(error) {
  try {
    const body = await error.context.json()
    return body?.code || null
  } catch {
    return null
  }
}

async function call(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    const code = (await errorCode(error)) || 'unavailable'
    throw new BillingError(code, MESSAGES[code] || MESSAGES.unavailable)
  }
  const url = safeCheckoutUrl(data?.url)
  if (!url) throw new BillingError('unavailable', MESSAGES.unavailable)
  return url
}

// The client sends only a plan choice. Price, product and provider are decided on the server.
export async function startCheckout({ interval, currency, reason }) {
  window.location.assign(await call('create-checkout', { interval, currency, reason }))
}

export async function openBillingPortal() {
  window.location.assign(await call('billing-portal', {}))
}
