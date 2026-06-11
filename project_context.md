# Project Context — Contralyne

> **Single source of truth** for project state, architecture, decisions, and history.
> Every meaningful change must be logged in [§10 Changelog](#10-update-protocol--changelog).
> Every task must be added to [§11 TODO List](#11-todo-list) and marked when done.

---

## 1) Overview

**Contralyne** — AI-powered contract review and negotiation SaaS for corporate lawyers.
Client: Amith (corporate lawyer, Karnataka). Developers: Kartik + Sai Pranav.

**Core flow:** Upload contract (PDF/DOCX) → AI extracts clauses → risk flags + negotiation points → export annotated report → chat with AI about specific clauses.

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui + Clerk |
| Backend | Node.js + Express + TypeScript (backend) |
| Database | Supabase (PostgreSQL) |
| File Storage | AWS S3 (pre-signed URLs, never public) |
| Auth | Clerk (JWT, 1-year free via GitHub Student) |
| AI | Anthropic claude-sonnet-4-6 |
| Hosting | Vercel |
| Monorepo | npm workspaces — frontend, backend, packages/shared |

---

## 2) Running the Project

### Backend
```bash
cd backend
cp .env.example .env   # fill in all keys
npm install
npm run dev            # http://localhost:4000
```

### Frontend
```bash
cd frontend
cp .env.example .env   # fill in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + NEXT_PUBLIC_API_URL
npm install
npm run dev            # http://localhost:3000
```

### From monorepo root
```bash
npm run dev:api    # starts backend
npm run dev:web    # starts frontend
```

---

## 3) Environment Variables

### backend/.env
| Variable | Source |
|---|---|
| `SUPABASE_URL` | Supabase project settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings > API |
| `CLERK_SECRET_KEY` | Clerk dashboard > API Keys |
| `AWS_REGION` | ap-south-1 |
| `AWS_ACCESS_KEY_ID` | IAM user with S3 permissions |
| `AWS_SECRET_ACCESS_KEY` | IAM user |
| `S3_BUCKET_NAME` | contralyn-contracts |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

### frontend/.env
| Variable | Source |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard > API Keys — **set** (measured-satyr-29.clerk.accounts.dev) |
| `CLERK_SECRET_KEY` | Clerk dashboard > API Keys — **set** |
| `NEXT_PUBLIC_API_URL` | http://localhost:4000 (dev) / deployed URL (prod) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | /sign-in |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | /sign-up |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | / |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | / |

---

## 4) Backend Architecture

```
backend/src/
├── app.ts                        — Express app (CORS, helmet, routes — no dotenv, Vercel-safe)
├── index.ts                      — Local dev entry (dotenv + app.ts)
├── config.ts                     — Zod-validated env schema
├── db.ts                         — Supabase client
├── types.ts                      — Inlined shared types (no workspace dep needed)
├── middleware/
│   ├── auth.ts                   — requireAuth: verifies Clerk JWT, sets req.userId
│   ├── error.ts                  — Global error handler
│   └── rateLimit.ts              — Per-route rate limiters
├── routes/
│   ├── contracts.ts              — Core contract CRUD + AI routes
│   ├── clauses.ts                — Clause library CRUD
│   ├── rules.ts                  — Review rules / playbook CRUD
│   ├── analytics.ts              — Dashboard stats
│   ├── activity.ts               — Paginated audit log
│   └── account.ts                — GDPR hard-delete
└── services/
    ├── ai.service.ts             — Anthropic claude-sonnet-4-6 analysis + ambiguity detection
    ├── chat.service.ts           — Context-aware Q&A with history
    ├── document.service.ts       — PDF/DOCX extraction + AWS Textract OCR fallback
    ├── export.service.ts         — DOCX (Word comments + tracked redlines) + PDF generation
    ├── storage.service.ts        — S3 upload/download/delete (pre-signed URLs)
    ├── prompts.ts                — Jurisdiction-aware legal prompts (US/UK/EU/India)
    └── activity.service.ts       — Audit log writer
```

---

## 5) Database Schema

| Table | Key columns |
|---|---|
| `users` | id, clerk_user_id, email, created_at |
| `contracts` | id, user_id, filename, s3_key, file_size, mime_type, contract_type, status, extracted_text, summary, created_at |
| `legal_intake` | id, contract_id, user_id, counterparty, jurisdiction, deal_value, urgency, notes, created_at |
| `analyses` | id, contract_id, user_id, risk_level, risk_summary (jsonb), clause_analysis (jsonb), negotiation_points (jsonb), ambiguity_flags (jsonb), model, created_at |
| `chat_messages` | id, contract_id, user_id, role (user/assistant), content, created_at |
| `clause_library` | id, user_id, name, content, clause_type, created_at |
| `review_rules` | id, user_id, name, description, rules (jsonb), is_active, created_at |
| `activity_logs` | id, user_id, action, entity_type, entity_id, metadata (jsonb), created_at |

**contract status:** `uploaded` → `processing` → `analyzed` | `failed`

**risk_level:** `low` | `medium` | `high` | `critical`

**contract_type:** `nda` | `msa` | `saas` | `sow` | `order_form` | `employment` | `vendor_agreement` | `other`

---

## 6) API Contract Reference

All routes require `Authorization: Bearer <clerk_jwt>` except `/health`.

### Contracts
| Method | Path | Rate Limit | Body / Notes | Response |
|---|---|---|---|---|
| `POST` | `/api/contracts/upload` | 20/hr | multipart: `file` (PDF/DOCX ≤10MB) + `contract_type` | `{ contract: { id, filename, contract_type, status, created_at } }` |
| `GET` | `/api/contracts` | — | query: `status`, `contract_type`, `risk_level`, `search`, `from`, `to` | `{ contracts: [...] }` |
| `GET` | `/api/contracts/:id` | — | — | `{ contract: { ...fields, fileUrl, analyses: [...] } }` |
| `PATCH` | `/api/contracts/:id` | — | `{ filename?, contract_type? }` | `{ contract: {...} }` |
| `POST` | `/api/contracts/:id/intake` | — | `{ counterparty, jurisdiction, deal_value, urgency, notes }` | `{ intake: {...} }` |
| `GET` | `/api/contracts/:id/intake` | — | — | `{ intake: {...} }` |
| `POST` | `/api/contracts/:id/analyze` | 30/hr | — | `{ analysisId, status: "analyzed" }` |
| `POST` | `/api/contracts/:id/summarize` | — | — | `{ summary: string }` (cached after first call) |
| `GET` | `/api/contracts/:id/export/pdf` | — | — | Binary PDF (two-column redlines layout) |
| `GET` | `/api/contracts/:id/export/docx` | — | — | Binary DOCX (Word comments + tracked-change redlines) |
| `POST` | `/api/contracts/:id/chat` | 20/min | `{ question: string }` | `{ answer: string }` |
| `GET` | `/api/contracts/:id/chat` | — | — | `{ messages: [{ id, role, content, created_at }] }` |
| `DELETE` | `/api/contracts/:id/chat` | — | — | 204 No Content |
| `DELETE` | `/api/contracts/:id` | — | — | 204 No Content |

### Other
| Method | Path | Description |
|---|---|---|
| `GET/POST/PATCH/DELETE` | `/api/clauses` | Clause library management |
| `GET/POST/PATCH/DELETE` | `/api/rules` | Review rules / playbook management |
| `GET` | `/api/analytics` | Dashboard stats — totals, by status/type/risk, uploads per month |
| `GET` | `/api/activity` | Paginated audit log (`?page=1&limit=20`) |
| `DELETE` | `/api/account` | GDPR hard-delete — all user data + S3 files |

### Health
| Method | Path | Response |
|---|---|---|
| `GET` | `/health` | `{ ok: true }` |

---

## 7) Frontend Architecture

```
frontend/src/
├── middleware.ts                      — Clerk route protection
├── app/
│   ├── layout.tsx                     — Root layout: ClerkProvider, Toaster, fonts
│   ├── globals.css                    — Tailwind directives + CSS vars
│   ├── (auth)/
│   │   ├── layout.tsx                 — Centered card layout for auth pages
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx                 — AppShell with Sidebar
│       ├── page.tsx                   — Dashboard: stats + recent contracts
│       ├── upload/page.tsx            — File dropzone + contract type selector
│       └── contracts/
│           ├── page.tsx               — Contracts history list + date filter
│           └── [id]/
│               ├── page.tsx           — AI review results + chat
│               └── export/page.tsx   — PDF/DOCX export triggers
├── components/
│   ├── ui/                            — shadcn/ui primitives (Button, Badge, Card, etc.)
│   ├── layout/
│   │   ├── Sidebar.tsx                — Nav links, user avatar, logout
│   │   └── AppShell.tsx               — Sidebar + main content wrapper
│   ├── RiskBadge.tsx                  — Color-coded risk level pill
│   └── StatusBadge.tsx                — Contract status pill
└── lib/
    ├── utils.ts                       — cn(), formatFileSize(), formatDate(), label maps
    └── api.ts                         — All API methods, typed, token-injected
```

### Pages
| Route | Component | Purpose |
|---|---|---|
| `/` | Dashboard | Stats cards + recent contracts + quick upload CTA |
| `/upload` | Upload | Drag-drop file + contract type → POST upload → auto analyze |
| `/contracts` | Contracts | Filterable table of all contracts |
| `/contracts/[id]` | ContractDetail | Risk/clause/negotiation tabs + chat panel |
| `/contracts/[id]/export` | Export | Download PDF or DOCX report |
| `/sign-in` | Sign In | Clerk-hosted sign-in |
| `/sign-up` | Sign Up | Clerk-hosted sign-up |

---

## 8) Auth Flow

1. User signs in via Clerk (`/sign-in`)
2. Clerk middleware (`middleware.ts`) protects all `(dashboard)` routes — unauthenticated → redirect to `/sign-in`
3. Frontend gets token: `const { getToken } = useAuth(); const token = await getToken();`
4. Every API call sends `Authorization: Bearer <token>` header
5. Backend `requireAuth` middleware verifies token via Clerk SDK, sets `req.userId = payload.sub`

---

## 9) Key Decisions

| Decision | Reason |
|---|---|
| Next.js 14 (not 15) | Stable App Router, no breaking-change risk for client delivery |
| Client components for all pages | Auth token from `useAuth()` requires client context; avoids server/client boundary complexity |
| shadcn/ui (Radix + Tailwind) | Production-quality accessible primitives, matches scope |
| Tailwind CSS v3 | Stable, well-supported with Next.js 14 |
| No SWR/React Query | useState + useEffect is sufficient for V1 scope; fewer dependencies |
| Export as direct fetch + blob download | Backend returns binary; no redirect approach to keep auth header |
| Chat on contract detail page | Natural UX — user reads analysis then asks follow-up questions in context |
| Auto-trigger analyze after upload | Reduces friction; user shouldn't have to press two buttons |
| app.ts / index.ts split in API | Vercel requires no dotenv in the entry — app.ts is Vercel-safe; index.ts wraps it with dotenv for local dev |
| types.ts inlined in each app | Avoids workspace resolution issues on Vercel; shared types duplicated intentionally |
| Deploy from repo root, not subdirectory | Vercel rootDirectory config handles path routing; deploying from a subdir doubles the path |

---

## 10) Update Protocol & Changelog

**Rules:**
1. New task requested → add to **§11 TODO** as `[ ] pending`
2. Start work → mark `[~] in progress`
3. Done → mark `[x] done (date)`
4. Every meaningful change → append one bullet in changelog below

### Changelog

- **2026-06-01** — Backend fully scaffolded by Sai Pranav
  *What:* Express API, Supabase DB, Clerk auth middleware, S3 storage, Anthropic AI analysis, PDF/DOCX export, contract chat with history
  *Files:* All files under `backend/src/`, `packages/database/schema.sql`

- **2026-06-01** — Frontend scaffolded: full Next.js 14 app in frontend
  *What:* Config files (next.config.js, tailwind, tsconfig, postcss), Clerk middleware, root layout, globals.css, lib/utils.ts, lib/api.ts, all shadcn/ui components, AppShell + Sidebar layout, auth pages (sign-in/sign-up), all 5 dashboard pages (Dashboard, Upload, Contracts list, Contract detail, Export)
  *Files:* All files under `frontend/src/`

- **2026-06-04** — Environment setup + both dev servers running
  *What:* Ran `npm install`, created `backend/.env` and `frontend/.env`, wired in Clerk credentials (project: measured-satyr-29). Backend on :4000, frontend on :3000 with full Clerk auth. Note: `frontend` uses `.env` not `.env.local`.
  *Files:* `backend/.env`, `frontend/.env`

- **2026-06-10** — Backend hardened + V1 features complete
  *What:* Added rate limiting (per-route), file magic bytes validation, AWS Textract OCR fallback for scanned PDFs, ambiguity detection in AI schema, jurisdiction-aware prompts (US/UK/EU/India), DOCX export with Word comments + tracked-change redlines, PDF two-column redlines layout, activity log endpoint (paginated), GDPR account deletion, PATCH /contracts/:id, app.ts split from index.ts for Vercel, types.ts inlined
  *Files:* `backend/src/app.ts`, `backend/src/types.ts`, `backend/src/middleware/rateLimit.ts`, `backend/src/routes/activity.ts`, `backend/src/routes/account.ts`

- **2026-06-10** — Vercel deployment configured + both apps live
  *What:* vercel.json per app, rootDirectory config, Supabase + S3 + Clerk + Anthropic keys provisioned, auto-deploy on git push to main. Frontend live at contralyne.com, API at api.contralyne.com.
  *Files:* `backend/vercel.json`, `frontend/vercel.json`

- **2026-06-10** — Competitor research document added
  *What:* Deep dive on ContractKen, Lexzur, Spellbook, Ironclad, Kira, LegalOn, goHeather — pricing, features, battlecards, positioning
  *Files:* `docs/competitor-research.md`

---

## 11) TODO List

> Legend: `[ ]` pending · `[~]` in progress · `[x]` done (date)

### Done
| Status | Task | Date |
|---|---|---|
| `[x]` | npm install — all dependencies installed (271 packages) | 2026-06-04 |
| `[x]` | Backend: Express API, all routes, services | 2026-06-01 |
| `[x]` | Backend: Supabase DB schema | 2026-06-01 |
| `[x]` | Backend: Clerk JWT auth middleware | 2026-06-01 |
| `[x]` | Backend: S3 storage service | 2026-06-01 |
| `[x]` | Backend: Anthropic AI analysis service | 2026-06-01 |
| `[x]` | Backend: PDF/DOCX export service | 2026-06-01 |
| `[x]` | Backend: Contract chat with history | 2026-06-01 |
| `[x]` | project_context.md created | 2026-06-01 |
| `[x]` | frontend config files (package.json, next.config.js, tailwind, tsconfig) | 2026-06-01 |
| `[x]` | Clerk middleware + root layout + globals.css | 2026-06-01 |
| `[x]` | lib/utils.ts + lib/api.ts (full typed API client) | 2026-06-01 |
| `[x]` | shadcn/ui base components | 2026-06-01 |
| `[x]` | AppShell + Sidebar layout components | 2026-06-01 |
| `[x]` | Auth pages (sign-in, sign-up) | 2026-06-01 |
| `[x]` | Dashboard page (/) | 2026-06-01 |
| `[x]` | Upload page (/upload) | 2026-06-01 |
| `[x]` | Contracts list page (/contracts) | 2026-06-01 |
| `[x]` | Contract detail page (/contracts/[id]) with analysis tabs + chat | 2026-06-01 |
| `[x]` | Export page (/contracts/[id]/export) | 2026-06-01 |
| `[x]` | npm install + TypeScript/build verification | 2026-06-01 |

### Recently Done
| Status | Task | Date |
|---|---|---|
| `[x]` | Set up Clerk project + fill .env keys | 2026-06-04 |
| `[x]` | Set up Supabase project + run schema.sql (8 tables) | 2026-06-10 |
| `[x]` | Configure AWS S3 bucket (contralyn-contracts, ap-south-1) | 2026-06-10 |
| `[x]` | Deploy backend to Vercel (api.contralyne.com) | 2026-06-10 |
| `[x]` | Deploy frontend to Vercel (contralyne.com) | 2026-06-10 |
| `[x]` | Custom domain connected (contralyne.com) | 2026-06-10 |
| `[x]` | Full UI complete (all 5 pages + auth) | 2026-06-10 |

### Pending
| Status | Task | Added |
|---|---|---|
| `[ ]` | End-to-end testing of all features | 2026-06-01 |
| `[ ]` | Transfer Supabase billing to Amith | 2026-06-10 |
| `[ ]` | Transfer S3 billing to Amith | 2026-06-10 |
| `[ ]` | Collect Milestone 2 — ₹6,000 | 2026-06-10 |
