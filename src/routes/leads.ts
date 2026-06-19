import { Hono } from 'hono'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { enrichLead } from '../lib/ai'
import type { AppVariables } from '../types'

// Passing AppVariables to Hono<{ Variables: ... }> is what makes c.get('userId') type-safe.
// Without it, TypeScript doesn't know what keys middleware has set on the context.
const leads = new Hono<{ Variables: AppVariables }>()

const createLeadSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  role: z.string().optional(),
  email: z.string().email().optional(),
  linkedin_url: z.string().url().optional(),
})

const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  email: z.string().email().optional(),
  linkedin_url: z.string().url().optional(),
  score: z.enum(['hot', 'warm', 'cold']).optional(),
})

// GET /leads
leads.get('/', async (c) => {
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return c.json({ data: null, error: error.message }, 500)
  return c.json({ data, error: null })
})

// GET /leads/:id
leads.get('/:id', async (c) => {
  const userId = c.get('userId')
  const leadId = c.req.param('id')

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return c.json({ data: null, error: 'Lead not found' }, 404)
  return c.json({ data, error: null })
})

// POST /leads — create + auto-enrich
leads.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const parsed = createLeadSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400)
  }

  const { data: lead, error: insertError } = await supabase
    .from('leads')
    .insert({ ...parsed.data, user_id: userId })
    .select()
    .single()

  if (insertError || !lead) {
    return c.json({ data: null, error: insertError?.message ?? 'Failed to create lead' }, 500)
  }

  if (lead.name && lead.company && lead.role) {
    try {
      const enrichment = await enrichLead({
        name: lead.name,
        company: lead.company,
        role: lead.role,
        linkedin_url: lead.linkedin_url ?? undefined
      })

      const { data: enriched } = await supabase
        .from('leads')
        .update({ score: enrichment.score, ai_summary: enrichment.summary })
        .eq('id', lead.id)
        .select()
        .single()

      return c.json({ data: enriched ?? lead, error: null }, 201)
    } catch (err) {
      console.error('Enrichment failed for lead', lead.id, err)
      return c.json({ data: lead, error: null }, 201)
    }
  }

  return c.json({ data: lead, error: null }, 201)
})

// PATCH /leads/:id
leads.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const leadId = c.req.param('id')
  const body = await c.req.json()

  const parsed = updateLeadSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ data: null, error: parsed.error.flatten() }, 400)
  }

  const { data, error } = await supabase
    .from('leads')
    .update(parsed.data)
    .eq('id', leadId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) return c.json({ data: null, error: 'Lead not found or update failed' }, 404)
  return c.json({ data, error: null })
})

// DELETE /leads/:id
leads.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const leadId = c.req.param('id')

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)
    .eq('user_id', userId)

  if (error) return c.json({ data: null, error: error.message }, 500)
  return c.json({ data: { deleted: true }, error: null })
})

export default leads