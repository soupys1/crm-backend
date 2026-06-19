import { buildEnrichmentPrompt, EnrichmentResult, LeadInput } from './prompts'
import { generateJSON } from './client'

export async function enrichLead(lead: LeadInput): Promise<EnrichmentResult> {
  const prompt = buildEnrichmentPrompt(lead)

  try {
    const raw = await generateJSON(prompt)
    const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (
      typeof parsed.summary !== 'string' ||
      !Array.isArray(parsed.talking_points) ||
      !['hot', 'warm', 'cold'].includes(parsed.score) ||
      typeof parsed.suggested_approach !== 'string' ||
      typeof parsed.would_call_help !== 'boolean' ||
      typeof parsed.call_reasoning !== 'string' ||
      typeof parsed.estimated_deal_value !== 'string'
    ) {
      throw new Error('Enrichment response missing or invalid fields')
    }

    return parsed as EnrichmentResult
  } catch (err) {
    console.error('enrichLead failed:', err)
    throw new Error('Enrichment failed')
  }
}