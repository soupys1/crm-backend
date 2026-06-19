import { Context, Next } from 'hono'
import type { AppVariables } from '../types'

const requestCounts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 60

export async function rateLimitMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const userId = c.get('userId')
  if (!userId) return next()

  const now = Date.now()
  const record = requestCounts.get(userId)

  if (!record || now > record.resetAt) {
    requestCounts.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return next()
  }

  if (record.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000)
    c.header('Retry-After', String(retryAfter))
    return c.json({ data: null, error: 'Rate limit exceeded. Try again in a moment.' }, 429)
  }

  record.count++
  return next()
}