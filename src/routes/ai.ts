import { Hono } from 'hono'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { enrichLead, draftEmail } from '../lib/ai'
import type { AppVariables } from '../types'

const ai = new Hono<{ Variables: AppVariables }>()

const enrichSchema = z.object({
  lead_id: z.string().uuid(),
})

const draftSchema = z.object({
  lead_id: z.string().uuid(),
  intent: z.enum(['cold', 'follow_up', 'breakup']),
  pitch: z.string().min(10),
})

// POST /ai/enrich
ai.post('/enrich', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const parsed = enrichSchema.safeParse(body)
  if (!parsed.success) return c.json({ data: null, error: parsed.error.flatten() }, 400)

  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', parsed.data.lead_id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !lead) return c.json({ data: null, error: 'Lead not found' }, 404)

  if (!lead.name || !lead.company || !lead.role) {
    return c.json({ data: null, error: 'Lead needs name, company, and role for enrichment' }, 400)
  }

  const enrichment = await enrichLead({
    name: lead.name,
    company: lead.company,
    role: lead.role,
    linkedin_url: lead.linkedin_url ?? undefined
  })

  await supabase
    .from('leads')
    .update({ score: enrichment.score, ai_summary: enrichment.summary })
    .eq('id', lead.id)

  return c.json({ data: enrichment, error: null })
})

// POST /ai/draft
ai.post('/draft', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const parsed = draftSchema.safeParse(body)
  if (!parsed.success) return c.json({ data: null, error: parsed.error.flatten() }, 400)

  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', parsed.data.lead_id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !lead) return c.json({ data: null, error: 'Lead not found' }, 404)

  if (!lead.name || !lead.company || !lead.role) {
    return c.json({ data: null, error: 'Lead needs name, company, and role for drafting' }, 400)
  }

  const enrichment = {
    summary: lead.ai_summary ?? `${lead.name} works as ${lead.role} at ${lead.company}.`,
    talking_points: [] as string[],
    score: (lead.score ?? 'warm') as 'hot' | 'warm' | 'cold',
    suggested_approach: 'email first',
    would_call_help: false,
    call_reasoning: '',
    estimated_deal_value: 'unknown'
  }

  try {
    const draft = await draftEmail(lead, enrichment, parsed.data.intent, parsed.data.pitch)
    return c.json({ data: draft, error: null })
  } catch (err: any) {
    return c.json({ data: null, error: err.message ?? 'Draft generation failed' }, 500)
  }
})

export default ai