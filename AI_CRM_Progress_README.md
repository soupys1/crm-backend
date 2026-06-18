# AI CRM / Sales Assistant — Build Progress

> A full-stack AI-powered CRM built with Next.js, Supabase, Gemini API, and Gmail API.
> Designed to help sales reps prioritize leads, draft personalized outreach, and track deals — with AI reasoning at every step.

---

## Project Status

### ✅ Completed

#### `src/lib/supabase.ts`
Supabase client setup with two exported clients:
- `supabase` — service role client, bypasses RLS, server-side only
- `createUserClient(accessToken)` — user-scoped client, respects RLS

**Known fix needed:** env var should be `NEXT_PUBLIC_SUPABASE_URL` not `SUPABASE_URL` for Next.js compatibility.

---

#### `src/lib/ai/prompts.ts`
Prompt builders for AI features. Exports:
- `LeadInput` type — `{ name, company, role, linkedin_url? }`
- `EnrichmentResult` type — `{ summary, talking_points, score, suggested_approach, would_call_help, call_reasoning, estimated_deal_value }`
- `buildEnrichmentPrompt(lead)` — builds structured JSON prompt for lead enrichment
- `buildDraftPrompt(lead, enrichment, intent, pitch)` — builds structured JSON prompt for email drafting with tone guide per intent (cold / follow_up / breakup)

---

#### `src/lib/ai/client.ts`
Thin Gemini API wrapper. Exports:
- `generateJSON(prompt)` — sends prompt to `gemini-2.0-flash`, returns raw text response
- Handles API errors with try/catch, re-throws as generic `'AI generation failed'`
- Provider abstraction layer — swapping to Anthropic Claude means only changing this file

**Requires:** `npm install @google/generative-ai` + `GEMINI_API_KEY` in `.env.local`

---

#### `src/lib/ai/enrich.ts`
Lead enrichment logic. Exports:
- `enrichLead(lead)` — calls `buildEnrichmentPrompt` → `generateJSON` → strips JSON fences → parses + validates → returns `EnrichmentResult`
- Validates all 7 required fields before returning
- Throws descriptive errors on parse/validation failure

---

#### `src/lib/ai/draft.ts`
Email drafting logic. Exports:
- `DraftResult` type — `{ subject: string, body: string }`
- `draftEmail(lead, enrichment, intent, pitch)` — calls `buildDraftPrompt` → `generateJSON` → strips fences → parses → validates `subject` and `body` → returns `DraftResult`

---

#### `src/lib/ai/index.ts`
Barrel export file (renamed from `ai.ts` for Node/TS index resolution). Re-exports:
- `enrichLead` from `./enrich`
- `draftEmail` from `./draft`
- `EnrichmentResult`, `LeadInput` (type exports) from `./prompts`
- `DraftResult` (type export) from `./draft`

---

#### `src/lib/gmail/oauth.ts`
Gmail OAuth2 flow and token management. Exports:
- `getAuthUrl()` — builds Google consent screen URL with Gmail send + readonly scopes
- `exchangeCodeForTokens(code)` — exchanges authorization code for access + refresh tokens
- `saveTokens(userId, tokens)` — upserts tokens into Supabase `gmail_tokens` table
- `getValidAccessToken(userId)` — fetches stored token, auto-refreshes if expired, returns usable access token

**Requires:** `npm install googleapis` + `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` in `.env.local`

---

#### `src/lib/gmail/threads.ts`
Gmail API send/receive layer. Exports:
- `EmailThread` type — `{ id, subject, snippet, last_message_at }`
- `fetchThreads(userId, leadEmail)` — lists + hydrates email threads for a lead using Gmail API
- `sendEmail(userId, to, subject, body)` — encodes email as base64url, sends via Gmail API

---

#### `src/lib/leads.ts`
Supabase CRUD layer for leads. Exports:
- `Lead` type — full lead row with all fields
- `LeadInput` type — subset for creation (no id, user_id, score, ai_summary)
- `createLead(userId, lead)` — inserts new lead, returns full row
- `getLeads(userId)` — returns all leads for user, ordered by created_at desc
- `getLead(userId, leadId)` — returns single lead, scoped to user
- `updateLead(userId, leadId, updates)` — partial update, scoped to user
- `deleteLead(userId, leadId)` — deletes lead, scoped to user

---

### 🔧 Still To Build

#### 1. Supabase Schema (do this first before API routes)
Run in Supabase SQL editor:

```sql
-- Leads table
create table leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  company text not null,
  role text not null,
  email text not null,
  linkedin_url text,
  score text check (score in ('hot', 'warm', 'cold')),
  ai_summary text,
  created_at timestamp default now()
);
alter table leads enable row level security;
create policy "Users can only access their own leads"
on leads for all using (auth.uid() = user_id);

-- Deals table
create table deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  stage text check (stage in ('prospect', 'contacted', 'meeting_booked', 'closed_won', 'closed_lost')),
  value numeric,
  next_action text,
  updated_at timestamp default now()
);
alter table deals enable row level security;
create policy "Users can only access their own deals"
on deals for all using (auth.uid() = user_id);

-- Gmail tokens table
create table gmail_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expiry_date bigint not null,
  updated_at timestamp default now()
);
alter table gmail_tokens enable row level security;
create policy "Users can only access their own tokens"
on gmail_tokens for all using (auth.uid() = user_id);
```

---

#### 2. `src/middleware.ts`
Runs before every API route. Needs to:
- Verify Supabase JWT from request cookies/headers
- Block unauthenticated requests with 401
- Rate limit per user (optional but recommended)

---

#### 3. API Routes (8 files)

**`src/app/api/leads/route.ts`**
- `GET` → calls `getLeads(userId)` → returns lead array
- `POST` → calls `createLead(userId, body)` → calls `enrichLead()` → calls `updateLead()` with enrichment → returns enriched lead

**`src/app/api/leads/[id]/route.ts`**
- `GET` → calls `getLead(userId, id)`
- `PATCH` → calls `updateLead(userId, id, body)`
- `DELETE` → calls `deleteLead(userId, id)`

**`src/app/api/ai/enrich/route.ts`**
- `POST` → calls `enrichLead(lead)` → returns `EnrichmentResult`

**`src/app/api/ai/draft/route.ts`**
- `POST` → calls `draftEmail(lead, enrichment, intent, pitch)` → returns `DraftResult`

**`src/app/api/auth/gmail/connect/route.ts`**
- `GET` → calls `getAuthUrl()` → redirects browser to Google consent screen

**`src/app/api/auth/gmail/callback/route.ts`**
- `GET` → extracts `code` from query params → calls `exchangeCodeForTokens(code)` → calls `saveTokens(userId, tokens)` → redirects to dashboard

**`src/app/api/email/send/route.ts`**
- `POST` → calls `sendEmail(userId, to, subject, body)`

**`src/app/api/email/threads/route.ts`**
- `GET` → calls `fetchThreads(userId, leadEmail)` → returns `EmailThread[]`

---

#### 4. Frontend Pages

**`src/app/(dashboard)/leads/page.tsx`**
- Leads list with search + filter
- "Add Lead" button → form → POST to `/api/leads`
- Score badge (hot/warm/cold) per lead card
- Click lead → navigate to lead detail

**`src/app/(dashboard)/leads/[id]/page.tsx`**
- Lead detail: enrichment summary, talking points, score
- Email thread history per lead
- "Draft Email" button → intent + pitch form → POST to `/api/ai/draft` → editable draft → send via `/api/email/send`

**`src/app/(dashboard)/deals/page.tsx`**
- Kanban board: Prospect → Contacted → Meeting Booked → Closed
- Drag and drop between columns
- AI next-action suggestion per card

**`src/app/(dashboard)/settings/page.tsx`**
- Gmail connect/disconnect button
- Calls `/api/auth/gmail/connect` on click

---

## Remaining Time Estimate

| What | Time |
|---|---|
| Supabase schema | 15 mins |
| Middleware | 20 mins |
| API routes (8 files) | 2 hours |
| Frontend — leads pages | 1 day |
| Frontend — deal Kanban | 1 day |
| Frontend — settings + Gmail connect | 2 hours |
| UI polish + wiring | 2-3 hours |

**Total remaining: ~3 days**

---

## Full Folder Structure

```
ai-crm/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── leads/
│   │   │   │   ├── page.tsx          ← leads list
│   │   │   │   └── [id]/page.tsx     ← lead detail
│   │   │   ├── deals/
│   │   │   │   └── page.tsx          ← kanban board
│   │   │   └── settings/
│   │   │       └── page.tsx          ← gmail connect
│   │   ├── api/
│   │   │   ├── leads/
│   │   │   │   ├── route.ts          ← GET all, POST create
│   │   │   │   └── [id]/route.ts     ← GET, PATCH, DELETE one
│   │   │   ├── ai/
│   │   │   │   ├── enrich/route.ts
│   │   │   │   └── draft/route.ts
│   │   │   ├── auth/gmail/
│   │   │   │   ├── connect/route.ts
│   │   │   │   └── callback/route.ts
│   │   │   └── email/
│   │   │       ├── send/route.ts
│   │   │       └── threads/route.ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── leads/
│   │   ├── deals/
│   │   ├── email/
│   │   └── ui/                       ← shadcn components
│   ├── lib/
│   │   ├── supabase.ts               ✅ done
│   │   ├── leads.ts                  ✅ done
│   │   ├── ai/
│   │   │   ├── prompts.ts            ✅ done
│   │   │   ├── client.ts             ✅ done
│   │   │   ├── enrich.ts             ✅ done
│   │   │   ├── draft.ts              ✅ done
│   │   │   └── index.ts              ✅ done
│   │   └── gmail/
│   │       ├── oauth.ts              ✅ done
│   │       └── threads.ts            ✅ done
│   └── middleware.ts                 ← TODO
├── .env.local
└── README.md
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini (free tier — swap to Anthropic Claude for demo)
GEMINI_API_KEY=

# Gmail OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Key Architectural Decisions

| Decision | Reason |
|---|---|
| No separate backend | Next.js API routes are sufficient at this scale, ships faster |
| Gemini free tier for dev | No credit card needed, swap to Claude for demo/production |
| Provider abstraction via `client.ts` | Swap LLM providers by changing one file |
| Service role + user-scoped Supabase clients | Service role for server ops, user-scoped for RLS-enforced queries |
| Double filter by `id` AND `user_id` in queries | Defense in depth — even if RLS fails, a user can never touch another user's data |
| Supabase encryption at rest for Gmail tokens | Acceptable for early product; AES-256 app-layer encryption is a future improvement |

---

## Known Issues / Fixes Needed

- `supabase.ts` — `SUPABASE_URL` should be `NEXT_PUBLIC_SUPABASE_URL`
- `LeadInput` type is defined in both `prompts.ts` and `leads.ts` — consolidate into `src/types/index.ts` to avoid duplication
- `EnrichmentResult` should also move to `src/types/index.ts` to avoid circular imports as the project grows

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 14 (App Router) |
| Database + Auth | Supabase (Postgres + Auth) |
| AI | Google Gemini 2.0 Flash (free tier) |
| Email | Gmail API (OAuth2) |
| Styling | Tailwind CSS + shadcn/ui |
| Deployment | Vercel |

---

## Pitching This to YC Startups

**Target verticals:** Sales tooling, RevOps, GTM infrastructure
**Comparable companies:** Clay, Attio, Apollo, Outreach

**What this demonstrates:**
- AI integration beyond surface-level ChatGPT wrappers
- Full-stack ownership (infra → backend → frontend)
- Understanding of real sales workflows
- Ability to ship production-ready features fast

**Outreach approach:**
1. Research the startup's product, find a specific gap
2. Deploy a live demo on Vercel
3. Reach out to the founder directly on Twitter/X or LinkedIn with the demo link
4. One paragraph: what you noticed, what you built, what you want
