import { getValidAccessToken } from './oauth'
import { google } from 'googleapis'

export type EmailThread = {
  id: string
  subject: string
  snippet: string
  last_message_at: string
}

function getGmailClient(token: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: token })
  return google.gmail({ version: 'v1', auth })
}

export async function fetchThreads(
  userId: string,
  leadEmail: string
): Promise<EmailThread[]> {
  const token = await getValidAccessToken(userId)
  const gmail = getGmailClient(token)

  const response = await gmail.users.threads.list({
    userId: 'me',
    q: `from:${leadEmail} OR to:${leadEmail}`,
    maxResults: 20
  })

  const threads = response.data.threads ?? []

  const detailed = await Promise.all(
    threads.map(async (t) => {
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: t.id!
      })

      const messages = thread.data.messages ?? []
      const last = messages[messages.length - 1]
      const headers = last?.payload?.headers ?? []

      const subject =
        headers.find((h) => h.name === 'Subject')?.value ?? '(no subject)'
      const date =
        headers.find((h) => h.name === 'Date')?.value ?? new Date().toISOString()

      return {
        id: t.id!,
        subject,
        snippet: thread.data.snippet ?? '',
        last_message_at: date
      }
    })
  )

  return detailed
}

export async function sendEmail(
  userId: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const token = await getValidAccessToken(userId)
  const gmail = getGmailClient(token)

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body
  ].join('\n')

  const encoded = Buffer.from(message).toString('base64url')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encoded
    }
  })
}
