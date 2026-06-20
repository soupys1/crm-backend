# CRM Backend

REST API for the AI-powered CRM. Built with [Hono](https://hono.dev/) and TypeScript, running on Node.js.

## Stack

- **Framework** — Hono (TypeScript)
- **Database / Auth** — Supabase (Postgres + JWT verification)
- **AI** — Groq / Llama 3.3 70B (lead enrichment, email drafting)
- **Email** — Gmail API via OAuth 2.0

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- Google Cloud project with Gmail API and Gemini API enabled

### Install

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
APP_URL=http://localhost:3001

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

GROQ_API_KEY=your_groq_api_key

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/gmail/callback
```

### Run

```bash
# Development
npm run dev

# Production
npm run build && npm start
```

Server starts on `http://localhost:3000` (or `$PORT`).

## API Reference

All `/api/*` routes require a `Authorization: Bearer <supabase_token>` header. Rate limit is **60 requests / minute per user**.

### Leads

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/leads` | List all leads for the authenticated user |
| `GET` | `/api/leads/:id` | Get a single lead |
| `POST` | `/api/leads` | Create a lead (auto-enriched via Gemini if name + company + role are provided) |
| `PATCH` | `/api/leads/:id` | Update a lead |
| `DELETE` | `/api/leads/:id` | Delete a lead |

**Create lead body:**
```json
{
  "name": "Jane Doe",
  "company": "Acme Corp",
  "role": "Head of Engineering",
  "email": "jane@acme.com",
  "linkedin_url": "https://linkedin.com/in/janedoe"
}
```

### Deals

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/deals` | List all deals (includes joined lead data) |
| `GET` | `/api/deals/:id` | Get a single deal |
| `POST` | `/api/deals` | Create a deal linked to a lead |
| `PATCH` | `/api/deals/:id` | Update stage, value, or next action |
| `DELETE` | `/api/deals/:id` | Delete a deal |

**Deal stages:** `prospect` · `contacted` · `meeting_booked` · `closed_won` · `closed_lost`

**Create deal body:**
```json
{
  "lead_id": "uuid",
  "stage": "prospect",
  "value": 5000,
  "next_action": "Send follow-up email"
}
```

### AI

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ai/enrich` | Enrich a lead with an AI score and summary |
| `POST` | `/api/ai/draft` | Draft a sales email for a lead |

**Enrich body:**
```json
{ "lead_id": "uuid" }
```

**Draft body:**
```json
{
  "lead_id": "uuid",
  "intent": "cold",
  "pitch": "We help engineering teams cut deployment time by 40%."
}
```
`intent` options: `cold` · `follow_up` · `breakup`

### Email (Gmail)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/email/threads?lead_email=` | Fetch Gmail threads for a lead's email address |
| `POST` | `/api/email/send` | Send an email via the user's connected Gmail |
| `GET` | `/auth/gmail/connect` | Redirect to Google OAuth consent screen |
| `GET` | `/auth/gmail/callback` | OAuth callback — saves tokens and redirects to frontend |

### Health

```
GET /health  →  { "status": "ok", "ts": "..." }
```

## Project Structure

```
src/
├── index.ts              # App entry point, route mounting, CORS
├── middleware/
│   ├── auth.ts           # Supabase JWT verification
│   └── rateLimit.ts      # 60 req/min per user (in-memory)
├── routes/
│   ├── leads.ts
│   ├── deals.ts
│   ├── ai.ts
│   └── email.ts
├── lib/
│   ├── supabase.ts       # Supabase admin client
│   ├── ai/               # Gemini client, enrichment, email drafting
│   └── gmail/            # OAuth flow and Gmail thread/send helpers
└── types/
    └── index.ts          # Shared Hono context types
```
