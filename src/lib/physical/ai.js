import { invokeFn } from '../api.js'
import { todayLocal } from '../journal/dates.js'

// Errors carry .code: 'ai_limit' | 'rate_limited' | …  Callers fall back to local suggestions.
export const aiReading = () => invokeFn('physical-ai', { mode: 'reading', today: todayLocal() })
export const aiNextMove = ({ easier = false, avoid = [], current = '' } = {}) =>
  invokeFn('physical-ai', { mode: 'next_move', today: todayLocal(), easier, avoid: avoid.slice(0, 8), current })
