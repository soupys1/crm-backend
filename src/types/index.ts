export type AppVariables = {
  userId: string
  accessToken: string
}

export type LeadScore = 'hot' | 'warm' | 'cold'

export type DealStage =
  | 'prospect'
  | 'contacted'
  | 'meeting_booked'
  | 'closed_won'
  | 'closed_lost'

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

export interface GmailToken {
  user_id: string
  access_token: string
  refresh_token: string
  expiry_date: number
}

export interface ApiSuccess<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError