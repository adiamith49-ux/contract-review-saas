# Contralyne — AGENTS.md

AI-based contract review and negotiation web app.
**Production-ready V1 — not a prototype or MVP.**

---

## Project Identity

| Field | Value |
|---|---|
| Product name | Contralyne |
| Client | Amith — corporate lawyer, Karnataka (Karwar) |
| Developers | Sai Pranav + Kartik (partners) |
| GitHub | pranav-error |
| Email | rajasaipranv0@gmail.com |
| Budget | ₹20,000 total (developer fee only; client pays API + hosting) |
| Stage | V1 delivered — live at contralyne.com |
| Primary market | US and UK law firms + legal teams |
| Secondary market | EU, India, and other jurisdictions (supported, not primary focus) |

---

## Payment Milestones

| Milestone | Amount | Status |
|---|---|---|
| Milestone 1 — Upfront | ₹8,000 | Received |
| Milestone 2 — Mid-delivery | ₹6,000 | Pending |
| Milestone 3 — Final | ₹6,000 | Pending |

IP transfers to client only upon receipt of full payment.

---

## Legal Agreements

All five agreements fully signed by both parties (2026-06-01):
1. Freelance Software Development Agreement
2. NDA
3. IP Assignment and Work-For-Hire Agreement
4. Technology Security and Data Protection Agreement
5. Non-Compete and Non-Solicitation Agreement

---

## Tech Stack (Locked)

| Layer | Technology |
|---|---|
| Frontend | Next.js + Tailwind CSS (Kartik) |
| Backend | Node.js + Express + TypeScript (Pranav) |
| Database | Supabase (PostgreSQL) |
| File Storage | AWS S3 (PDF/DOCX, max 10MB, pre-signed URLs) |
| Auth | Clerk (email/password + Google OAuth) |
| Hosting | Vercel |
| AI | Anthropic Codex-sonnet-4-6 (locked 2026-06-01) |

Client pays AI API + hosting costs. Developer fee only is ₹20,000.

### AI: Anthropic Codex-sonnet-4-6
- Tool use for structured JSON output (`tool_choice: { type: "tool", name: "analyze_contract" }`)
- Prompt caching (`cache_control: { type: "ephemeral" }`) on system prompt — cuts repeated call costs
- Entry point: `backend/src/services/ai.service.ts`

---

## Locked Feature Scope

Scope frozen at contract signing. Changes require: written description → written estimate → advance payment.

### In Scope
- Dashboard, upload screen, AI review results page, contract history list (responsive)
- Clause extraction from PDF/DOCX, risk flagging (high/medium/low/critical), negotiation suggestions
- REST API, PDF/DOCX text extraction, review history per user
- Secure S3 upload up to 10MB
- Clerk auth: email/password + Google OAuth
- Export reviewed contract as PDF or DOCX with inline suggestions
- Functional testing, one bug-fix round, Vercel deployment with SSL + custom domain
- 2 months post-delivery bug-fix support (24h response, working days)

### Out of Scope (V1)
- Admin panel, dark mode, landing page
- Custom-trained models, fine-tuning
- Multi-tenant / org/team accounts, billing/subscription
- MFA, SSO/SAML, RBAC
- Bulk export, DocuSign/e-signature
- Load/stress/penetration testing
- New features during support period

**Sign-off rule:** 7 calendar days after delivery notification. Silence = accepted, final payment due.

---

## Monorepo Structure

```
contract-review-saas/
├── apps/
│   ├── api/                  Express + TypeScript (port 4000) — Pranav
│   │   ├── vercel.json       Vercel build config (src/app.ts, @vercel/node)
│   │   └── src/
│   │       ├── app.ts             Express app (CORS, helmet, routes — no dotenv, Vercel-safe)
│   │       ├── index.ts           Local dev entry (dotenv + app.ts)
│   │       ├── config.ts          Zod-validated env — single source of truth
│   │       ├── db.ts              Supabase client
│   │       ├── types.ts           Inlined shared types (no workspace dep needed)
│   │       ├── middleware/
│   │       │   ├── auth.ts        Clerk JWT verification (standalone verifyToken)
│   │       │   ├── error.ts       Global error handler
│   │       │   └── rateLimit.ts   Per-route rate limiters
│   │       ├── routes/
│   │       │   ├── contracts.ts   Core contract CRUD + AI routes
│   │       │   ├── clauses.ts     Clause library CRUD
│   │       │   ├── rules.ts       Review rules / playbook CRUD
│   │       │   ├── analytics.ts   Dashboard stats
│   │       │   ├── activity.ts    Paginated audit log
│   │       │   └── account.ts     GDPR hard-delete
│   │       └── services/
│   │           ├── ai.service.ts       Anthropic — analyze + summarize + ambiguity detection
│   │           ├── chat.service.ts     Follow-up Q&A with context memory
│   │           ├── prompts.ts          Legal prompt builder (US/UK-first, jurisdiction-aware)
│   │           ├── document.service.ts PDF/DOCX extraction + AWS Textract OCR fallback
│   │           ├── storage.service.ts  S3 upload/download/delete (pre-signed URLs)
│   │           ├── export.service.ts   DOCX (Word comments + tracked redlines) + PDF export
│   │           └── activity.service.ts Audit log writer
│   └── frontend/             Next.js frontend (port 3000) — Kartik
│       ├── vercel.json        framework: nextjs
│       └── src/
│           ├── lib/types.ts   Inlined shared types
│           └── middleware.ts  Clerk v5 auth middleware
├── packages/
│   └── database/schema.sql   Supabase schema — run in SQL editor to init
├── package.json              npm workspaces root
└── tsconfig.base.json
```

---

## API Routes (Complete)

All routes require `Authorization: Bearer <clerk_jwt>` except `/health`.

### Contracts
| Method | Path | Rate Limit | Description |
|---|---|---|---|
| POST | `/api/contracts/upload` | 20/hr | Upload PDF/DOCX → validate (magic bytes) → extract → S3 + Supabase |
| GET | `/api/contracts` | — | List with filters: `status`, `contract_type`, `risk_level`, `search`, `from`, `to` |
| GET | `/api/contracts/:id` | — | Single contract + analysis + intake + pre-signed S3 URL |
| PATCH | `/api/contracts/:id` | — | Rename contract or update contract_type |
| POST | `/api/contracts/:id/intake` | — | Save legal intake (counterparty, jurisdiction, deal value…) |
| GET | `/api/contracts/:id/intake` | — | Fetch saved intake |
| POST | `/api/contracts/:id/analyze` | 30/hr | Run AI analysis (uses intake + active review rules as context) |
| POST | `/api/contracts/:id/summarize` | — | Plain-English summary (cached after first call) |
| GET | `/api/contracts/:id/export/docx` | — | Download DOCX with Word comments + tracked-change redlines |
| GET | `/api/contracts/:id/export/pdf` | — | Download PDF with two-column redlines layout |
| POST | `/api/contracts/:id/chat` | 20/min | Ask follow-up question (full context: contract + analysis + history) |
| GET | `/api/contracts/:id/chat` | — | Get full chat history |
| DELETE | `/api/contracts/:id/chat` | — | Clear chat history |
| DELETE | `/api/contracts/:id` | — | Delete contract + S3 file |

### Other
| Method | Path | Description |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/clauses` | Clause library management |
| GET/POST/PATCH/DELETE | `/api/rules` | Review rules / playbook management |
| GET | `/api/analytics` | Dashboard stats — totals, risk breakdown, uploads per month |
| GET | `/api/activity` | Paginated audit log (all user actions) |
| DELETE | `/api/account` | GDPR hard-delete — all user data + S3 files |

---

## Database Schema (Supabase)

Run `packages/database/schema.sql` in Supabase SQL editor.

| Table | Purpose |
|---|---|
| `users` | Clerk user mirror (clerk_user_id, email) |
| `contracts` | Uploaded files — status, extracted_text, summary, s3_key |
| `legal_intake` | Pre-analysis context: counterparty, jurisdiction, deal value, urgency |
| `analyses` | AI results (JSONB): risk_level, risk_summary, clause_analysis, negotiation_points |
| `chat_messages` | Per-contract Q&A history (role: user/assistant) |
| `clause_library` | User's saved approved/fallback clauses |
| `review_rules` | Playbook rule sets — injected into AI prompt when is_active = true |
| `activity_logs` | Full audit trail of all actions |

---

## How the Playbook + Contracts Flow Works

1. **User creates review rules** → `POST /api/rules` with clause-level requirements and severity
2. **User uploads contract** → text extracted and cached in `contracts.extracted_text`
3. **User fills intake** → `POST /api/contracts/:id/intake` (jurisdiction, counterparty, deal value, urgency)
4. **Analyze triggered** → backend fetches contract text + intake + all active review rules → bundles into AI prompt
5. **Codex reviews against company standards** — flags deviations from rules as specific risks
6. **Results saved** → risk_level, clause findings, negotiation points stored in `analyses`
7. **Follow-up chat** → `POST /api/contracts/:id/chat` — every message bundles contract text + analysis + last 20 chat messages as context. Persists forever in `chat_messages`

---

## Context Memory (Contracts)

Users never lose contract context:
- Contract text cached in Supabase on upload — no re-download from S3 needed
- Analysis results stored indefinitely in `analyses` table
- Chat history stored indefinitely in `chat_messages` — last 20 messages loaded per call
- Users can re-analyze any contract from any date — extracted text is always available
- Re-analysis automatically picks up the latest intake + active review rules

---

## AI Accuracy — Limitations + Roadmap

### Implemented in V1

| Feature | Notes |
|---|---|
| Scanned PDF OCR (AWS Textract) | Fallback when pdf-parse returns empty text |
| Ambiguity detection | Dedicated pass in AI tool schema — flags "reasonable", "material", "best efforts" |
| Jurisdiction-aware prompts | US (UCC, Delaware), UK (English contract law, Companies Act 2006), EU (GDPR), India (Indian Contract Act) |

### Remaining limitations (V1.5+)

| Issue | Impact | Planned fix |
|---|---|---|
| Implied terms + case law | LLM unaware of recent US/UK court decisions | RAG with CourtListener (US) + BAILII (UK) via pgvector |
| Deeply nested cross-references | Clause 8.2 referencing Schedule 4 para 3(b) analysed independently | Document structure parser + reference resolution |
| State-specific US law + recent UK case law | Knows law broadly but not sub-jurisdiction nuances | RAG with US/UK statutes and recent case law |

### Roadmap
1. ✅ **Scanned PDF OCR** (AWS Textract) — done V1
2. ✅ **Ambiguity detection** (AI tool schema) — done V1
3. ✅ **Jurisdiction prompt modules** (US/UK/EU/India) — done V1
4. **Cross-reference resolution** (document structure parser) — V1.5
5. **RAG with US/UK statutes** (UCC, UK Companies Act, GDPR via pgvector) — V1.5
6. **RAG with case law** (CourtListener for US, BAILII for UK) — V2

**Rough accuracy estimate:**
- Well-drafted standard English contracts: 75–85% of material risks caught
- Complex multi-party or poorly formatted documents: 50–65%

---

## Legal Standing

- The tool is **legal to sell and use** in India — it is software, not legal practice
- Correct disclaimer (already in all outputs): *"AI-generated insights are for informational purposes only and do not constitute legal advice"*
- Under Advocates Act 1961 — only enrolled Advocates can give legal advice. The tool gives analysis assistance, not advice
- Amith as a lawyer uses it as an assistant — professional liability for any advice remains his, not the software's
- Never market as "replace your lawyer" — always position as "makes your lawyer faster"

---

## Competitive Positioning

**Primary market:** US and UK law firms, solo practitioners, in-house legal teams, mid-sized businesses. EU supported. India available but not primary.

**Direct competitor: ContractKen (~$50/user/month)**
- They win on: Microsoft Word add-in (works inside existing workflow), one-click redline application in Word, defined terms tracking, iManage/enterprise DMS integration, privacy "Moderation Layer" (PII masking before AI)
- We win on: web-based (no Word dependency), competitive price from $49/user, conversational chat per contract, legal intake + deal context in AI, simpler onboarding (no Word add-in install)
- Their weakness: requires Microsoft Word — useless for Google Docs users or PDF-only workflows; no legal intake; no per-contract chat

**vs Ironclad / Kira (~$50,000–$200,000/year):**
- They win on: custom-trained ML models, full CLM, Salesforce/DocuSign integrations, SOC2, RBAC, years of hardening
- We win on: price (10–100x cheaper), simplicity, AI-native architecture, conversational follow-up chat, negotiation intelligence

**Pricing positioning:** $49–$99/user/month puts us directly below ContractKen and well below Ironclad/Kira. Strong value proposition for small-to-mid US/UK firms who don't need enterprise CLM.

**Key sales line:** *"ContractKen only works inside Microsoft Word and knows nothing about your deal. Contralyne works on any browser, takes your counterparty, jurisdiction, and deal value into account in every review, and gives you a full AI chat interface per contract — not just a list of flags. Starting at $49/user/month."*

**Security sales line:** *"Built on AWS, Clerk, Supabase, and Vercel — all independently SOC2 certified. Your contracts are encrypted at rest and in transit and are never used to train AI models."*

**Key differentiator to develop:** Jurisdiction-aware depth for US and UK law (UCC, Delaware corporate law, English contract law, UK Companies Act) via RAG is what eventually makes Contralyne better than any general LLM tool.

**Target market:** US and UK law firms, in-house counsel, legal teams. EU supported. India supported as secondary market — do not lead with India in positioning or UI.

---

## Development Principles

- Clerk handles all auth — never build custom JWT logic
- Every DB query scoped to `user_id` from Clerk JWT — no cross-user data leaks
- S3 files accessed via pre-signed URLs only — no public buckets
- All inputs validated with Zod before DB or S3
- AI output always via tool use with strict schema — never parse free-text AI responses
- All key actions logged to `activity_logs` via `logActivity()`
- Config always from `config.ts` — never `process.env` directly
- Org isolation note: no multi-tenant in V1 — `user_id` is Clerk user ID, single user per account

---

## Environment Variables

Copy `backend/.env.example` → `backend/.env` and fill in:

```env
NODE_ENV=development
PORT=4000
WEB_URL=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
CLERK_SECRET_KEY=sk_test_...
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=contralyn-contracts
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=Codex-sonnet-4-6
```

---

## Local Dev Setup

```bash
# 1. Run schema in Supabase SQL editor (packages/database/schema.sql)
# 2. Fill backend/.env from .env.example
# 3. Install deps
npm install
# 4. Start API
npm run dev:api
# 5. Start web (partner)
npm run dev:web
```

---

## Current Status

- [x] Legal agreements signed (2026-06-01)
- [x] Milestone 1 — ₹8,000 received (2026-06-01)
- [x] AI provider locked — Anthropic Codex-sonnet-4-6
- [x] Backend scaffold — Express, Clerk auth, S3, Supabase, Anthropic
- [x] Contract upload, extraction, analysis, export (PDF + DOCX)
- [x] Follow-up chat with persistent context memory
- [x] Search + filter on contract list
- [x] Legal intake (feeds jurisdiction + deal value into AI prompt)
- [x] AI summarization (cached)
- [x] Activity logging / audit trail
- [x] Clause library CRUD
- [x] Review rules / basic playbook (injected into AI analysis)
- [x] Analytics endpoint
- [x] Rate limiting (per-route — upload 20/hr, analyze 30/hr, chat 20/min)
- [x] File validation (magic bytes + MIME on upload)
- [x] GDPR account deletion endpoint
- [x] Activity log endpoint (paginated)
- [x] DOCX export with Word comments + tracked-change redlines
- [x] Scanned PDF OCR (AWS Textract fallback)
- [x] Ambiguity detection in AI schema
- [x] Jurisdiction prompt modules (US / UK / EU / India)
- [x] Frontend (Kartik) — done, live at contralyne.com
- [x] Vercel deployment (auto-deploy on git push to main)
- [x] Supabase + S3 + Clerk provisioned and live
- [ ] Transfer Supabase + S3 billing to Amith
- [ ] Milestone 2 — ₹6,000
- [ ] Milestone 3 — ₹6,000

---

## Codex Skills to Use

| Task | Skill |
|---|---|
| Codex API, prompt caching, tool use | `Codex-api` |
| Next.js routing, Server Components | `vercel:nextjs` |
| UI components, Tailwind, shadcn | `vercel:shadcn` |
| AI streaming interfaces | `vercel:ai-sdk` |
| Deploy to Vercel | `vercel:deploy` |
| Env vars | `vercel:env` |
| Supabase + S3 setup | `vercel:marketplace` |
| Clerk auth | `vercel:auth` |
| Security review | `security-review` |
| Verify feature works end-to-end | `verify` |
