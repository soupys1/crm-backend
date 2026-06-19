import { Hono } from 'hono'
import { z } from 'zod'
import { fetchThreads, sendEmail } from '../lib/gmail/threads'
import { getAuthUrl, exchangeCodeForTokens, saveTokens } from '../lib/gmail/oauth'
import type { AppVariables } from '../types'

const email = new Hono<{ Variables: AppVariables }>()

const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
})

// GET /email/threads?lead_email=...
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

// POST /email/send
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
      return c.json({ data: null, error: 'Gmail not connected. Visit /auth/gmail/connect first.' }, 403)
    }
    return c.json({ data: null, error: err.message ?? 'Failed to send email' }, 500)
  }
})

// GET /auth/gmail/connect — redirect to Google consent screen
email.get('/connect', async (c) => {
  const authUrl = getAuthUrl()
  return c.redirect(authUrl)
})

// GET /auth/gmail/callback — Google posts back here with the authorization code
email.get('/callback', async (c) => {
  const userId = c.get('userId')
  const code = c.req.query('code')

  if (!code) return c.json({ data: null, error: 'Missing code from Google' }, 400)

  try {
    const tokens = await exchangeCodeForTokens(code)
    await saveTokens(userId, tokens)
    return c.redirect(`${process.env.APP_URL ?? 'http://localhost:3000'}/settings?gmail=connected`)
  } catch (err: any) {
    return c.json({ data: null, error: err.message ?? 'OAuth exchange failed' }, 500)
  }
})

export default email