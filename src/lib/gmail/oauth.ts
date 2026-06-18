import { google } from 'googleapis'
import { supabase } from '../supabase'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly'
]

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
}

export function getAuthUrl(): string {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  })
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expiry_date: number
}> {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error('Incomplete tokens from Google')
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date
  }
}

export async function saveTokens(userId: string, tokens: {
  access_token: string
  refresh_token: string
  expiry_date: number
}): Promise<void> {
  const { error } = await supabase
    .from('gmail_tokens')
    .upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      updated_at: new Date().toISOString()
    })

  if (error) throw new Error('Failed to save tokens')
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('gmail_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) throw new Error('No Gmail tokens found for user')

  const isExpired = Date.now() >= data.expiry_date
  if (!isExpired) return data.access_token

  const client = getOAuthClient()
  client.setCredentials({ refresh_token: data.refresh_token })
  const { credentials } = await client.refreshAccessToken()

  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error('Failed to refresh access token')
  }

  await saveTokens(userId, {
    access_token: credentials.access_token,
    refresh_token: data.refresh_token,
    expiry_date: credentials.expiry_date
  })

  return credentials.access_token
}