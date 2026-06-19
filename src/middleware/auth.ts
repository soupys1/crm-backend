import { Context, Next } from 'hono'
import { createUserClient } from '../lib/supabase'
import type { AppVariables } from '../types'

export async function authMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ data: null, error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = authHeader.slice(7)
  const userClient = createUserClient(token)
  const { data: { user }, error } = await userClient.auth.getUser()

  if (error || !user) {
    return c.json({ data: null, error: 'Invalid or expired token' }, 401)
  }

  c.set('userId', user.id)
  c.set('accessToken', token)

  await next()
}