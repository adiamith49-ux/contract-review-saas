# Contralyn — CLAUDE.md

AI-based contract review and negotiation web app.
**Production-ready V1 — not a prototype or MVP.**

---

## Project Identity

| Field | Value |
|---|---|
| Product name | Contralyn |
| Client | Amith — corporate lawyer, Karnataka (Karwar) |
| Developers | Sai Pranav + Kartik (partners) |
| GitHub | pranav-error |
| Email | rajasaipranv0@gmail.com |
| Budget | ₹20,000 total (developer fee only; client pays API + hosting) |
| Stage | Pre-development — waiting on client project requirements form |

---

## Payment Milestones

| Milestone | Amount | Trigger |
|---|---|---|
| Milestone 1 — Upfront | ₹8,000 | Contract signing |
| Milestone 2 — Mid-delivery | ₹6,000 | Mid-point delivery |
| Milestone 3 — Final | ₹6,000 | Final delivery + sign-off |

IP transfers to client only upon receipt of full payment.

---

## Legal Agreements (Status)

Five agreements signed by Kartik, pending countersign + verification from Pranav:
1. Freelance Software Development Agreement
2. NDA
3. IP Assignment and Work-For-Hire Agreement
4. Technology Security and Data Protection Agreement
5. Non-Compete and Non-Solicitation Agreement

---

## Tech Stack (Locked)

| Layer | Technology |
|---|---|
| Frontend | Next.js + Tailwind CSS |
| Backend | Node.js |
| Database | Supabase (Postgres + storage metadata) |
| File Storage | AWS S3 (PDF/DOCX contracts) |
| Auth | Clerk (1-year free tier) |
| Hosting | Vercel |
| AI | OpenAI OR Anthropic — one provider, decided before dev starts |

Client pays AI API costs directly. Developer pays nothing for AI usage.

### AI Provider Decision (Pending)

Choose one before dev starts:

| Provider | Model | Pros | Cons |
|---|---|---|---|
| Anthropic | claude-opus-4-7 | 200k context, superior legal reasoning, better long-doc handling | Slightly higher cost |
| Anthropic | claude-sonnet-4-6 | Faster + cheaper, still strong | Smaller context |
| OpenAI | gpt-4o | Widely known, good structured output | 128k context, weaker on long contracts |

**Recommendation: Anthropic claude-opus-4-7** for full contract analysis (200k context = no truncation on large contracts), claude-sonnet-4-6 for cheaper extraction tasks. Use prompt caching (`cache_control`) on the static legal system prompt to reduce repeated costs.

---

## Locked Feature Scope

Scope is frozen at contract signing. Any change requires: written description → written estimate → advance payment.

### Feature 1 — Frontend UI
**In:** Dashboard, contract upload screen, AI review results page, contract history list. Responsive (desktop/tablet/mobile).
**Out:** Admin panel, dark mode, landing/marketing page, custom animations.

### Feature 2 — AI Contract Review Engine
**In:** Clause extraction from PDF/DOCX, risk flagging (high/medium/low), negotiation suggestions per clause. One AI provider.
**Out:** Custom-trained models, fine-tuning, jurisdiction-specific legal DBs, real-time legal advice.

### Feature 3 — Backend + Database
**In:** REST API for all frontend features, PDF/DOCX text extraction, review history per user, basic user data management.
**Out:** Admin backend, analytics engine, multi-tenant architecture, billing/subscription logic.

### Feature 4 — File Storage
**In:** Secure PDF/DOCX upload up to 10MB per file, stored on AWS S3 with access control.
**Out:** Video storage, bulk upload, folder system, file versioning, virus scanning.

### Feature 5 — Auth
**In:** Email/password signup, Google OAuth, protected routes, session management via Clerk.
**Out:** MFA, SSO/SAML, RBAC, team/org accounts, social logins beyond Google.

### Feature 6 — Export Reviewed Contract
**In:** Download AI-reviewed contract as PDF or DOCX with inline suggestions/annotations.
**Out:** Custom branded exports, bulk export, DocuSign/e-signature integration.

### Feature 7 — Testing + Deployment
**In:** Functional testing of all features, one round of bug fixes pre-launch, Vercel deployment with SSL + custom domain connection.
**Out:** Load/stress testing, penetration testing, multi-region deployment, CI/CD pipeline beyond basic GitHub integration.

### Feature 8 — Post-Delivery Support (2 months)
**In:** Bug fixes for originally delivered features, 24h response on working days.
**Out:** New features, design changes, third-party API issues (e.g. OpenAI downtime), support beyond 2 months.

---

## Scope Protection Rules

- Scope frozen at contract signing
- Change requests: written description → written cost/timeline estimate → advance payment before work starts
- Client sign-off window: 7 calendar days after delivery notification. Silence = accepted, final payment due.

---

## Architecture

### Frontend (Next.js App Router)

Pages:
- `/` — Dashboard (recent contracts, risk summary cards)
- `/upload` — Contract upload screen
- `/contracts` — Contract history list (filterable by date)
- `/contracts/[id]` — AI review results page
- `/contracts/[id]/export` — Export trigger

Auth: Clerk wraps all routes. Unauthenticated users redirect to sign-in.

### Backend (Node.js REST API)

| Method | Path | Description |
|---|---|---|
| POST | `/api/contracts/upload` | Upload PDF/DOCX to S3, extract text, store in Supabase |
| POST | `/api/contracts/:id/analyze` | Run AI analysis, store result in Supabase |
| GET | `/api/contracts` | List user's contracts with status + risk level |
| GET | `/api/contracts/:id` | Contract detail + analysis result |
| GET | `/api/contracts/:id/export` | Generate + return annotated PDF or DOCX |

Clerk JWT is verified on every protected route via middleware.

### Database (Supabase / PostgreSQL)

```sql
-- Users managed by Clerk; store only clerk_user_id + metadata
users (id, clerk_user_id, email, created_at)

-- Uploaded contract files
contracts (id, user_id, filename, s3_key, file_size, mime_type, status, extracted_text, created_at)
-- status: uploaded | processing | analyzed | failed

-- AI analysis output
analyses (id, contract_id, risk_level, risk_summary, clause_analysis, negotiation_points, model, created_at)
-- risk_level: low | medium | high | critical
-- risk_summary, clause_analysis, negotiation_points: JSONB
```

### File Storage (AWS S3)

- Upload path: `contracts/{user_id}/{uuid}/{filename}`
- Access: pre-signed URLs (time-limited, never public)
- Max file size: 10MB
- Accepted types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### AI Analysis Flow

1. Extract text from PDF/DOCX on upload
2. On analyze request: fetch extracted text from Supabase (or S3 fallback)
3. Build prompt: legal system prompt + contract text + contract type
4. Call AI API with structured JSON output schema
5. Store analysis result in `analyses` table
6. Return to frontend

**Context reconstruction for old contracts:**
- Fetch contract text from Supabase (or re-extract from S3)
- Fetch all prior analysis results for that contract
- Bundle into prompt: `contract text + previous reviews + new query`
- Users can re-run analysis on any historical contract — already in scope

### AI Output Schema

```typescript
{
  riskLevel: "low" | "medium" | "high" | "critical"
  riskSummary: { area: string; risk: string; severity: string; recommendation: string }[]
  clauseAnalysis: { clause: string; finding: string; risk: string; recommendation: string }[]
  negotiationPoints: { point: string; preferredPosition: string; fallbackPosition: string }[]
}
```

Always enforce with structured output (tool use / JSON schema mode). Never parse free-text AI responses.

---

## Development Principles

- Clerk handles all auth — never build custom JWT logic
- Every DB query scoped to `user_id` from Clerk session — no cross-user data leaks
- S3 files accessed via pre-signed URLs only — no public buckets
- All API inputs validated with Zod before touching DB or S3
- AI output always parsed against strict JSON schema — never trust free-text
- Store extracted contract text in Supabase so re-analysis doesn't re-download from S3
- Use prompt caching on the static legal system prompt (Anthropic) or system message caching (OpenAI) to reduce repeated API costs

---

## Legal System Prompt Principles

- Position AI as a senior corporate lawyer specializing in commercial contracts
- Always produce structured JSON output matching the schema above
- Flag both legal and business risk
- Include clear risk severity per clause
- Produce negotiation fallback positions, not just "this is risky"
- Always append: "AI-generated insights are not legal advice"

---

## Claude Code Skills to Use

| Task | Skill |
|---|---|
| Claude API integration, prompt caching | `claude-api` |
| Next.js routing, Server Components, layouts | `vercel:nextjs` |
| UI components, Tailwind, shadcn | `vercel:shadcn` |
| AI streaming / structured output | `vercel:ai-sdk` |
| Deploying to Vercel | `vercel:deploy` |
| Managing env vars | `vercel:env` |
| Supabase + S3 setup | `vercel:marketplace` |
| Clerk auth setup | `vercel:auth` |
| Security review (S3 access control, auth middleware) | `security-review` |
| Verify a feature works end-to-end | `verify` |

---

## Current Status

- [x] Legal agreements — fully signed by both parties (2026-06-01)
- [x] Milestone 1 payment — ₹8,000 received (2026-06-01)
- [ ] Client project requirements form — received, review and confirm details
- [ ] AI provider decision (OpenAI vs Anthropic) — pending
- [ ] Development start — ready to begin once requirements confirmed and AI provider chosen
