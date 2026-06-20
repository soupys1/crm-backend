import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rateLimit'

import leadsRouter from './routes/leads'
import dealsRouter from './routes/deals'
import aiRouter from './routes/ai'
import emailRouter from './routes/email'

const app = new Hono()

app.use('*', logger())
const allowedOrigins = process.env.APP_URL
  ? [process.env.APP_URL]
  : ['http://localhost:3000', 'http://localhost:3001']

app.use('*', cors({
  origin: allowedOrigins,
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
}))

app.get('/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }))

app.route('/auth/gmail', emailRouter)

app.use('/api/*', authMiddleware)
app.use('/api/*', rateLimitMiddleware)

app.route('/api/leads', leadsRouter)
app.route('/api/deals', dealsRouter)
app.route('/api/ai', aiRouter)
app.route('/api/email', emailRouter)

app.notFound((c) => c.json({ data: null, error: 'Route not found' }, 404))

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ data: null, error: 'Internal server error' }, 500)
})

const port = Number(process.env.PORT ?? 8080)
console.log(`🚀 Server running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })