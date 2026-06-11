# Contralyne

AI-powered contract review and negotiation platform for US and UK law firms, in-house counsel, and legal teams.

Analyzes contracts clause-by-clause, flags risks, detects ambiguous language, generates negotiation strategies, exports redlined DOCX with Word comments and tracked-change suggestions, and answers follow-up questions — all in a single web interface.

---

## Live URLs

| App | URL |
|---|---|
| Frontend | https://contralyne.com |
| Backend API | https://api.contralyne.com |
| Vercel team | amitadi-s-projects (Amith's account) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (PostgreSQL) — project ref: `qdjdoxwebuwpnggifeku` |
| File Storage | AWS S3 (PDF/DOCX, max 10MB, AES256) — bucket: `contralyn-contracts` (ap-south-1) |
| Auth | Clerk (email/password + Google OAuth) |
| AI | Anthropic claude-sonnet-4-6 (tool use + prompt caching) |
| OCR | AWS Textract (scanned PDF fallback) |
| Hosting | Vercel |

---

## Team

| Person | Role | Contact |
|---|---|---|
| Sai Pranav | Backend developer | rajasaipranv0@gmail.com / GitHub: pranav-error |
| Kartik | Frontend developer | kartikjarali@gmail.com |
| Amith | Client (corporate lawyer) | Vercel + Clerk account owner |

---

## Monorepo Structure

```
contract-review-saas/
├── apps/
│   ├── api/                  Express + TypeScript (port 4000) — Pranav
│   │   ├── vercel.json       Vercel build config (src/app.ts, @vercel/node)
│   │   └── src/
│   │       ├── app.ts             Express app (no dotenv — for Vercel)
│   │       ├── index.ts           Local dev entry (imports app.ts + dotenv)
│   │       ├── config.ts          Zod-validated env — single source of truth
│   │       ├── db.ts              Supabase client
│   │       ├── types.ts           Inlined shared types (no workspace dep)
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
│   │           ├── ai.service.ts       Anthropic — analyze + summarize
│   │           ├── chat.service.ts     Follow-up Q&A with context memory
│   │           ├── prompts.ts          Legal prompt builder (US/UK-first, jurisdiction-aware)
│   │           ├── document.service.ts PDF/DOCX extraction + magic bytes validation + Textract OCR
│   │           ├── storage.service.ts  S3 upload/download/delete (pre-signed URLs)
│   │           ├── export.service.ts   DOCX (Word comments + redlines) + PDF (two-column redlines)
│   │           └── activity.service.ts Audit log writer
│   └── web/                  Next.js frontend (port 3000) — Kartik
│       ├── vercel.json       framework: nextjs
│       └── src/
│           ├── lib/types.ts  Inlined shared types
│           └── middleware.ts Clerk v5 auth middleware
├── packages/
│   └── database/schema.sql  Supabase schema — run in SQL editor to init
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
| GET | `/api/contracts/:id/export/docx` | — | Download annotated DOCX with Word comments + redlines |
| GET | `/api/contracts/:id/export/pdf` | — | Download annotated PDF with two-column redlines layout |
| POST | `/api/contracts/:id/chat` | 20/min | Ask follow-up question (full contract + analysis context) |
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

Structured JSON output via Anthropic tool use (`tool_choice: { type: "tool", name: "analyze_contract" }`). System prompt cached via Anthropic prompt caching to reduce repeated call costs.

Analysis includes:
- **Risk level** — low / medium / high / critical
- **Risk summary** — high-level risk areas with severity + recommendations
- **Clause analysis** — per-clause findings with risk rating
- **Negotiation points** — preferred + fallback positions
- **Ambiguity flags** — vague or undefined terms that could create disputes

Jurisdiction-aware prompts: US (UCC, Delaware), UK (English contract law, Companies Act 2006), EU (GDPR), India (Indian Contract Act). Defaults to US.

PDF extraction: `pdf-parse` for text PDFs, AWS Textract OCR fallback for scanned documents. DOCX extraction via `mammoth`. File magic bytes validated on every upload.

---

## DOCX Export — Word Integration

The DOCX export produces a proper redlined annotated contract (not just a separate report). When opened in Microsoft Word or Google Docs:

- **Highlighted paragraphs** — risky clauses are shaded by severity (red = high/critical, orange = medium, green = low)
- **Word comments** — each flagged clause has a native Word comment balloon in the margin with the AI finding and recommendation (author: "Contralyne AI")
- **Tracked-change insertions** — negotiation suggestions appear inline as blue underlined tracked insertions; the lawyer can Accept or Reject each one natively in Word
- **Unmatched findings** — clauses that couldn't be pinned to a specific paragraph appear in an "Additional Findings" appendix
- **Fallback** — if no extracted text is available, falls back to a table-based report

Library: `docx` v9.7.1 — uses `CommentRangeStart/End/Reference` for comments, `InsertedTextRun` for tracked insertions.

---

## Local Dev Setup

```bash
# 1. Run schema in Supabase SQL editor
#    packages/database/schema.sql

# 2. Copy and fill env
cp backend/.env.example backend/.env

# 3. Install deps
npm install

# 4. Start API
npm run dev:api

# 5. Start web (separate terminal)
npm run dev:web
```

### Required env variables (`backend/.env`)

```env
NODE_ENV=development
PORT=4000
WEB_URL=http://localhost:3000
SUPABASE_URL=https://qdjdoxwebuwpnggifeku.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>
CLERK_SECRET_KEY=sk_test_oVWSGUgoJbGJgK619G9FED1CW2ESyf6eKEamTXXr1H
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIAZ626D2EVPRMBGBJC
AWS_SECRET_ACCESS_KEY=<from Pranav>
S3_BUCKET_NAME=contralyn-contracts
ANTHROPIC_API_KEY=<from Vercel env — ask Pranav>
AI_MODEL=claude-sonnet-4-6
```

### Web env (`frontend/.env.local`)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bWVhc3VyZWQtc2F0eXItMjkuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_oVWSGUgoJbGJgK619G9FED1CW2ESyf6eKEamTXXr1H
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## Deploying to Vercel

**Important — monorepo deploy rule:** Always deploy from the **repo root**, not from within `backend` or `frontend`. The Vercel projects have `rootDirectory` set, so running from a subdirectory causes a doubled path error.

> **⚠️ After the `apps/api → backend` / `apps/web → frontend` rename:** Update `rootDirectory` in the Vercel dashboard for both projects — API project: set to `backend`, Web project: set to `frontend`. Until this is done, git auto-deploy will fail.

```bash
# Deploy API to production (run from repo root)
VERCEL_ORG_ID=team_5kVOrDiQPhSjelez7qUKICnx \
VERCEL_PROJECT_ID=prj_JEhmNBe2xycHd0piqwMmT1E4QbiJ \
vercel --prod --yes --token <vercel-token>

# Deploy Web to production (run from repo root)
VERCEL_ORG_ID=team_5kVOrDiQPhSjelez7qUKICnx \
VERCEL_PROJECT_ID=prj_hgRCNgIHZFQbZAJ34zwgxPFQmJXW \
vercel --prod --yes --token <vercel-token>
```

Git auto-deploy is configured: pushing to `main` triggers Vercel's Git integration automatically (rootDirectory + ignored build step per app).

Vercel token: stored in Vercel dashboard / ask Pranav

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
| Export — PDF (two-column redlines layout) | Done |
| Export — DOCX (Word comments + tracked-change redlines) | Done |
| Chat with persistent context | Done |
| Activity log endpoint | Done |
| GDPR account deletion | Done |
| Analytics (by status/type/risk/month) | Done |
| Frontend | Done (Kartik) — live at contralyne.com |
| Vercel auto-deploy on git push | Done (rootDirectory + ignored build step per app) |
| Supabase provisioned (8 tables) | Done |
| S3 bucket + IAM user | Done |
| Clerk configured | Done |
| Anthropic API key live | Done |
| Transfer Supabase billing to Amith | Pending |
| Transfer S3 billing to Amith | Pending |

---

## Legal Disclaimer

AI-generated insights are for informational purposes only and do not constitute legal advice.
