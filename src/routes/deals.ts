import { Hono } from 'hono'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import type { AppVariables } from '../types'

const deals = new Hono<{ Variables: AppVariables }>()

const createDealSchema = z.object({
  lead_id: z.string().uuid(),
  stage: z.enum(['prospect', 'contacted', 'meeting_booked', 'closed_won', 'closed_lost']).default('prospect'),
  value: z.number().positive().optional(),
  next_action: z.string().optional(),
})

const updateDealSchema = z.object({
  stage: z.enum(['prospect', 'contacted', 'meeting_booked', 'closed_won', 'closed_lost']).optional(),
  value: z.number().positive().optional(),
  next_action: z.string().optional(),
})

// GET /deals
deals.get('/', async (c) => {
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('deals')
    .select('*, leads(name, company, role, email, score)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) return c.json({ data: null, error: error.message }, 500)
  return c.json({ data, error: null })
})

// GET /deals/:id
deals.get('/:id', async (c) => {
  const userId = c.get('userId')
  const dealId = c.req.param('id')

  const { data, error } = await supabase
    .from('deals')
    .select('*, leads(name, company, role, email, score)')
    .eq('id', dealId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return c.json({ data: null, error: 'Deal not found' }, 404)
  return c.json({ data, error: null })
})

// POST /deals
deals.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const parsed = createDealSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400)
  }

  // Verify the lead belongs to this user
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id')
    .eq('id', parsed.data.lead_id)
    .eq('user_id', userId)
    .single()

  if (leadError || !lead) {
    return c.json({ data: null, error: 'Lead not found' }, 404)
  }

  const { data, error } = await supabase
    .from('deals')
    .insert({ ...parsed.data, user_id: userId })
    .select()
    .single()

  if (error || !data) {
    return c.json({ data: null, error: error?.message ?? 'Failed to create deal' }, 500)
  }

  return c.json({ data, error: null }, 201)
})

// PATCH /deals/:id
deals.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const dealId = c.req.param('id')
  const body = await c.req.json()

  const parsed = updateDealSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400)
  }

  const { data, error } = await supabase
    .from('deals')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) return c.json({ data: null, error: 'Deal not found or update failed' }, 404)
  return c.json({ data, error: null })
})

// DELETE /deals/:id
deals.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const dealId = c.req.param('id')

  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', dealId)
    .eq('user_id', userId)

  if (error) return c.json({ data: null, error: error.message }, 500)
  return c.json({ data: { deleted: true }, error: null })
})

export default deals
