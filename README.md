# Contralyn

AI-powered contract review and negotiation platform for US and UK law firms, in-house counsel, and legal teams.

Analyzes contracts clause-by-clause, flags risks, detects ambiguous language, generates negotiation strategies, and answers follow-up questions — all in a single web interface.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (PostgreSQL) |
| File Storage | AWS S3 (PDF/DOCX, max 10MB, AES256) |
| Auth | Clerk (email/password + Google OAuth) |
| AI | Anthropic claude-sonnet-4-6 (tool use + prompt caching) |
| OCR | AWS Textract (scanned PDF fallback) |
| Hosting | Vercel |

---

## Monorepo Structure

```
contract-review-saas/
├── apps/
│   ├── api/                  Express + TypeScript (port 4000)
│   │   └── src/
│   │       ├── config.ts          Zod-validated env
│   │       ├── db.ts              Supabase client
│   │       ├── index.ts           Express entry — all routers registered
│   │       ├── middleware/
│   │       │   ├── auth.ts        Clerk JWT verification
│   │       │   ├── error.ts       Global error handler
│   │       │   └── rateLimit.ts   Per-route rate limiters
│   │       ├── routes/
│   │       │   ├── contracts.ts   Core contract CRUD + AI routes
│   │       │   ├── clauses.ts     Clause library CRUD
│   │       │   ├── rules.ts       Review rules / playbook CRUD
│   │       │   ├── analytics.ts   Dashboard stats
│   │       │   ├── activity.ts    Audit log endpoint
│   │       │   └── account.ts     GDPR account deletion
│   │       └── services/
│   │           ├── ai.service.ts       Anthropic — analyze + summarize
│   │           ├── chat.service.ts     Follow-up Q&A with context memory
│   │           ├── prompts.ts          Legal prompt builder (US/UK-first, jurisdiction-aware)
│   │           ├── document.service.ts PDF/DOCX extraction + file validation + OCR fallback
│   │           ├── storage.service.ts  S3 upload/download/delete
│   │           ├── export.service.ts   DOCX + PDF report export
│   │           └── activity.service.ts Audit log writer
│   └── web/                  Next.js frontend (port 3000)
├── packages/
│   ├── shared/src/types.ts   Shared TypeScript types
│   └── database/schema.sql   Supabase schema
├── package.json              npm workspaces root
└── tsconfig.base.json
```

---

## API Routes

All routes require `Authorization: Bearer <clerk_jwt>` except `/health`.

### Contracts

| Method | Path | Rate Limit | Description |
|---|---|---|---|
| POST | `/api/contracts/upload` | 20/hr | Upload PDF/DOCX → validate → extract → S3 + DB |
| GET | `/api/contracts` | — | List with filters: status, type, risk, search, date range |
| GET | `/api/contracts/:id` | — | Single contract + analysis + intake + presigned URL |
| PATCH | `/api/contracts/:id` | — | Update filename or contract_type |
| POST | `/api/contracts/:id/intake` | — | Save legal intake (counterparty, jurisdiction, deal value…) |
| GET | `/api/contracts/:id/intake` | — | Fetch saved intake |
| POST | `/api/contracts/:id/analyze` | 30/hr | Run AI analysis with intake + active rules |
| POST | `/api/contracts/:id/summarize` | — | Plain-English summary (cached after first call) |
| GET | `/api/contracts/:id/export/docx` | — | Download annotated DOCX report |
| GET | `/api/contracts/:id/export/pdf` | — | Download annotated PDF report |
| POST | `/api/contracts/:id/chat` | 20/min | Ask follow-up question |
| GET | `/api/contracts/:id/chat` | — | Full chat history |
| DELETE | `/api/contracts/:id/chat` | — | Clear chat history |
| DELETE | `/api/contracts/:id` | — | Delete contract + S3 file |

### Other

| Method | Path | Description |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/clauses` | Clause library management |
| GET/POST/PATCH/DELETE | `/api/rules` | Review rules / playbook management |
| GET | `/api/analytics` | Dashboard stats — totals, risk breakdown, uploads per month |
| GET | `/api/activity` | Paginated audit log |
| DELETE | `/api/account` | GDPR hard-delete — all user data + S3 files |

---

## AI Analysis

The AI returns structured JSON via Anthropic tool use. Analysis includes:

- **Risk level** — low / medium / high / critical
- **Risk summary** — high-level risk areas with severity + recommendations
- **Clause analysis** — per-clause findings with risk rating
- **Negotiation points** — preferred + fallback positions
- **Ambiguity flags** — vague or undefined terms that could create disputes, with suggested replacements

Jurisdiction-aware prompts: US (UCC, Delaware), UK (English contract law, Companies Act 2006), EU (GDPR/EU law), India (Indian Contract Act). Defaults to US. System prompt is cached via Anthropic prompt caching to reduce repeated call costs.

PDF extraction: `pdf-parse` for text PDFs, AWS Textract OCR fallback for scanned documents. DOCX extraction via `mammoth`. File magic bytes validated on every upload to prevent MIME spoofing.

---

## Local Dev Setup

```bash
# 1. Run schema in Supabase SQL editor
#    packages/database/schema.sql

# 2. Copy and fill env
cp apps/api/.env.example apps/api/.env

# 3. Install deps
npm install

# 4. Start API
npm run dev:api

# 5. Start web (separate terminal)
npm run dev:web
```

### Required env variables (`apps/api/.env`)

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
AI_MODEL=claude-sonnet-4-6
```

---

## Database

Run `packages/database/schema.sql` in the Supabase SQL editor to initialize all tables.

| Table | Purpose |
|---|---|
| `users` | Clerk user mirror |
| `contracts` | Uploaded files — status, extracted text, summary, S3 key |
| `legal_intake` | Pre-analysis context: counterparty, jurisdiction, deal value, urgency |
| `analyses` | AI results (JSONB): risk level, clauses, negotiation points, ambiguity flags |
| `chat_messages` | Per-contract Q&A history |
| `clause_library` | User's saved approved/fallback clauses |
| `review_rules` | Playbook rule sets — injected into AI prompt when active |
| `activity_logs` | Full audit trail |

---

## Build Status

| Area | Status |
|---|---|
| Backend — all routes + services | Done |
| Rate limiting | Done |
| File validation (magic bytes + MIME) | Done |
| OCR fallback (AWS Textract) | Done |
| Ambiguity detection in AI schema | Done |
| Playbook (review rules injected into analysis) | Done |
| Export — DOCX + PDF | Done |
| Chat with persistent context | Done |
| Activity log endpoint | Done |
| GDPR account deletion | Done |
| Frontend | In progress (Kartik) |
| Supabase + S3 + Clerk provisioning | Pending |

---

## Legal Disclaimer

AI-generated insights are for informational purposes only and do not constitute legal advice.
