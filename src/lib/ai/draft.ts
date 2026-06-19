import { buildDraftPrompt, EnrichmentResult, LeadInput } from './prompts'
import { generateJSON } from './client'

export type DraftResult = {
  subject: string
  body: string
}

export async function draftEmail(
  lead: LeadInput,
  enrichment: EnrichmentResult,
  intent: 'cold' | 'follow_up' | 'breakup',
  pitch: string
): Promise<DraftResult> {
  const prompt = buildDraftPrompt(lead, enrichment, intent, pitch)

  try {
    const raw = await generateJSON(prompt)
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
      throw new Error('Draft response missing or invalid fields')
    }

    return parsed as DraftResult
  } catch (err) {
    console.error('draftEmail failed:', err)
    throw new Error('Draft generation failed')
  }
}