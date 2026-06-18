export type LeadInput = {
  name: string
  company: string
  role: string
  linkedin_url?: string
}

export type EnrichmentResult = {
  summary: string
  talking_points: string[]
  score: 'hot' | 'warm' | 'cold'
  suggested_approach: string
  would_call_help: boolean
  call_reasoning: string
  estimated_deal_value: string
}

export function buildEnrichmentPrompt(lead: LeadInput): string {
  return `You are a sales intelligence assistant. Analyze the following lead and return ONLY valid JSON, no preamble or markdown formatting.

Lead details:
- Name: ${lead.name}
- Company: ${lead.company}
- Role: ${lead.role}
${lead.linkedin_url ? `- LinkedIn: ${lead.linkedin_url}` : ''}

Return JSON in exactly this shape:
{
  "summary": string,           // 2-3 sentences on who this person is and why they matter
  "talking_points": string[],  // 3-4 specific points to raise on a call
  "score": "hot" | "warm" | "cold",
  "suggested_approach": string, // email first, call first, or LinkedIn — and why
  "would_call_help": boolean,
  "call_reasoning": string,    // why a call would or wouldn't help
  "estimated_deal_value": string // rough range, e.g. "$5k-15k/year"
}`
}

export function buildDraftPrompt(
  lead: LeadInput,
  enrichment: EnrichmentResult,
  intent: 'cold' | 'follow_up' | 'breakup',
  pitch: string
): string {
  const toneGuide: Record<typeof intent, string> = {
    cold: 'This is a first outreach. Be concise, curious, and low-pressure. Reference something specific about their role or company. End with a soft call-to-action (e.g. open to a quick chat?).',
    follow_up: 'This is a follow-up to a previous email with no response. Be brief, add new value or info, and gently re-prompt without being pushy.',
    breakup: 'This is a final follow-up after no response. Be polite and direct — acknowledge the silence, leave the door open, and signal this is the last outreach unless they respond.'
  }

  return `You are a sales copywriter. Write a personalized outreach email and return ONLY valid JSON, no preamble or markdown formatting.

Lead details:
- Name: ${lead.name}
- Company: ${lead.company}
- Role: ${lead.role}

What we know about this lead:
- Summary: ${enrichment.summary}
- Talking points: ${enrichment.talking_points.join('; ')}
- Suggested approach: ${enrichment.suggested_approach}

Email intent: ${intent}
Tone guidance: ${toneGuide[intent]}

What we're pitching:
${pitch}

Return JSON in exactly this shape:
{
  "subject": string,  // short, specific, no clickbait
  "body": string      // plain text email body, 80-150 words, no placeholders like [Name]
}`
}