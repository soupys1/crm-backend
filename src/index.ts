export type LeadScore = 'hot' | 'warm' | 'cold'

export type DealStage =
  | 'prospect'
  | 'contacted'
  | 'meeting_booked'
  | 'closed_won'
  | 'closed_lost'

// ── Database row types (match your Supabase schema exactly) ──

export interface Profile {
  id: string
  full_name: string | null
  gmail_connected: boolean
  created_at: string
}

export interface Lead {
  id: string
  user_id: string
  name: string
  company: string | null
  role: string | null
  email: string | null
  linkedin_url: string | null
  score: LeadScore | null
  ai_summary: string | null
  created_at: string
}

export interface Deal {
  id: string
  user_id: string
  lead_id: string
  stage: DealStage
  value: number | null
  next_action: string | null
  updated_at: string
}

export interface EmailThread {
  id: string
  user_id: string
  lead_id: string
  gmail_thread_id: string
  subject: string | null
  last_message_at: string | null
}

export interface GmailToken {
  user_id: string
  access_token: string
  refresh_token: string
  expires_at: string
}

// ── Request body types (what your API routes expect) ──

export interface CreateLeadBody {
  name: string
  company?: string
  role?: string
  email?: string
  linkedin_url?: string
}

export interface UpdateLeadBody {
  name?: string
  company?: string
  role?: string
  email?: string
  linkedin_url?: string
  score?: LeadScore
}

export interface CreateDealBody {
  lead_id: string
  stage?: DealStage
  value?: number
}

export interface UpdateDealBody {
  stage?: DealStage
  value?: number
  next_action?: string
}

export interface EnrichLeadBody {
  lead_id: string
}

export interface DraftEmailBody {
  lead_id: string
  intent: 'cold_intro' | 'follow_up' | 'breakup'
}

export interface NextActionBody {
  deal_id: string
}

// ── API response wrapper ──

export interface ApiSuccess<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError