import { invokeFn } from '../api.js'
import { todayLocal } from './dates.js'

// invokeFn throws Error with .code ('daily_limit' | 'pro_required' | 'reflection_limit' | 'not_enough' | …)
export const aiPrompts = (focus) => invokeFn('journal-ai', { mode: 'prompts', focus: focus || undefined, today: todayLocal() })
export const aiSuggest = (content, existingTags) =>
  invokeFn('journal-ai', { mode: 'suggest', content, existing_tags: existingTags, today: todayLocal() })
export const aiReflection = () => invokeFn('journal-ai', { mode: 'reflection', today: todayLocal() })
export const aiAsk = (question) => invokeFn('journal-ai', { mode: 'ask', question, today: todayLocal() })
