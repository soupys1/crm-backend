import { Hono } from 'hono'
import { z } from 'zod'
import { fetchThreads, sendEmail } from '../lib/gmail/threads'
import { getAuthUrl, exchangeCodeForTokens, saveTokens } from '../lib/gmail/oauth'
import { createUserClient } from '../lib/supabase'
import type { AppVariables } from '../types'

const email = new Hono<{ Variables: AppVariables }>()

const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
})

// GET /api/email/threads?lead_email=...
email.get('/threads', async (c) => {
  const userId = c.get('userId')
  const leadEmail = c.req.query('lead_email')

  if (!leadEmail) return c.json({ data: null, error: 'lead_email query param required' }, 400)

  try {
    const threads = await fetchThreads(userId, leadEmail)
    return c.json({ data: threads, error: null })
  } catch (err: any) {
    return c.json({ data: null, error: err.message ?? 'Failed to fetch threads' }, 500)
  }
})

// POST /api/email/send
email.post('/send', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) return c.json({ data: null, error: parsed.error.flatten() }, 400)

  try {
    await sendEmail(userId, parsed.data.to, parsed.data.subject, parsed.data.body)
    return c.json({ data: { sent: true }, error: null })
  } catch (err: any) {
    if (err.message?.includes('No Gmail tokens')) {
      return c.json({ data: null, error: 'Gmail not connected. Visit /settings to connect first.' }, 403)
    }
    return c.json({ data: null, error: err.message ?? 'Failed to send email' }, 500)
  }
})

// GET /auth/gmail/connect?token=<supabase_jwt>
// Unprotected — token passed as query param, forwarded as OAuth state
email.get('/connect', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.json({ data: null, error: 'Missing token query param' }, 400)

  const authUrl = getAuthUrl(token)
  return c.redirect(authUrl)
})

// GET /auth/gmail/callback — Google redirects here with code + state (our JWT)
email.get('/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state') // this is the user's Supabase JWT

  if (!code || !state) return c.json({ data: null, error: 'Missing code or state from Google' }, 400)

  // Verify the JWT to get the userId
  const userClient = createUserClient(state)
  const { data: { user }, error: authError } = await userClient.auth.getUser()

  if (authError || !user) {
    return c.json({ data: null, error: 'Invalid or expired session token in state' }, 401)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await saveTokens(user.id, tokens)
    return c.redirect(`${process.env.APP_URL ?? 'http://localhost:3001'}/settings?gmail=connected`)
  } catch (err: any) {
    return c.json({ data: null, error: err.message ?? 'OAuth exchange failed' }, 500)
  }
})

export default email
