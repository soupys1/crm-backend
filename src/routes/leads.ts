



// Create a new lead
export async function createLead(userId: string, lead: LeadInput): Promise<Lead>

// Get all leads for a user
export async function getLeads(userId: string): Promise<Lead[]>

// Get a single lead by id
export async function getLead(userId: string, leadId: string): Promise<Lead>

// Update a lead (e.g. after enrichment — save ai_summary, score)
export async function updateLead(userId: string, leadId: string, updates: Partial<Lead>): Promise<Lead>


export type Lead = {
  id: string
  user_id: string
  name: string
  company: string
  role: string
  email: string
  linkedin_url?: string
  score?: 'hot' | 'warm' | 'cold'
  ai_summary?: string
  created_at: string
}