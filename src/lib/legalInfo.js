// =====================================================================
// Fill in the three values below, then the "draft" banner on the policy pages disappears.
// Everything on /terms, /privacy and /refunds reads from here.
//   operator : your full legal name (if you have no registered business) or the business name
//   email    : a real inbox you read; people use it for support, refunds and privacy requests
//   jurisdiction : the country/state whose law governs the Terms
// =====================================================================
export const LEGAL_INFO = {
  product: 'Nexora',
  operator: '[Your full name or business name]',
  email: '[your support email]',
  jurisdiction: 'India',
  updated: '11 October 2026',
}

export const LEGAL_READY = !LEGAL_INFO.operator.startsWith('[') && !LEGAL_INFO.email.startsWith('[')

export const LEGAL_PATHS = { '/terms': 'terms', '/privacy': 'privacy', '/refunds': 'refunds' }
