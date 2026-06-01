# Project Context — Contralyn

> **Single source of truth** for project state, architecture, decisions, and history.
> Every meaningful change must be logged in [§10 Changelog](#10-update-protocol--changelog).
> Every task must be added to [§11 TODO List](#11-todo-list) and marked when done.

---

## 1) Overview

**Contralyn** — AI-powered contract review and negotiation SaaS for corporate lawyers.
Client: Amith (corporate lawyer, Karnataka). Developers: Kartik + Sai Pranav.

**Core flow:** Upload contract (PDF/DOCX) → AI extracts clauses → risk flags + negotiation points → export annotated report → chat with AI about specific clauses.

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui + Clerk |
| Backend | Node.js + Express + TypeScript (apps/api) |
| Database | Supabase (PostgreSQL) |
| File Storage | AWS S3 (pre-signed URLs, never public) |
| Auth | Clerk (JWT, 1-year free via GitHub Student) |
| AI | Anthropic claude-sonnet-4-6 |
| Hosting | Vercel |
| Monorepo | npm workspaces — apps/web, apps/api, packages/shared |

---

## 2) Running the Project

### Backend
```bash
cd apps/api
cp .env.example .env   # fill in all keys
npm install
npm run dev            # http://localhost:4000
```

### Frontend
```bash
cd apps/web
cp .env.example .env.local   # fill in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + NEXT_PUBLIC_API_URL
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

### apps/api/.env
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

### apps/web/.env.local
| Variable | Source |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard > API Keys |
| `NEXT_PUBLIC_API_URL` | http://localhost:4000 (dev) / deployed URL (prod) |

---

## 4) Backend Architecture

```
apps/api/src/
├── index.ts                      — Express app, CORS, helmet, routes
├── config.ts                     — Zod-validated env schema
├── db.ts                         — Supabase client
├── middleware/
│   ├── auth.ts                   — requireAuth: verifies Clerk JWT, sets req.userId
│   └── error.ts                  — Global error handler
├── routes/
│   └── contracts.ts              — All contract routes (see §6)
└── services/
    ├── ai.service.ts             — Anthropic claude-sonnet-4-6 analysis
    ├── chat.service.ts           — Context-aware Q&A
    ├── document.service.ts       — PDF/DOCX text extraction
    ├── export.service.ts         — Annotated PDF/DOCX generation
    ├── storage.service.ts        — S3 upload/download/delete
    └── prompts.ts                — Legal system prompts
```

---

## 5) Database Schema

| Table | Key columns |
|---|---|
| `users` | id, clerk_user_id, email, created_at |
| `contracts` | id, user_id (clerk), filename, s3_key, file_size, mime_type, contract_type, status, extracted_text, created_at |
| `analyses` | id, contract_id, user_id, risk_level, risk_summary (jsonb), clause_analysis (jsonb), negotiation_points (jsonb), model, created_at |
| `chat_messages` | id, contract_id, user_id, role (user/assistant), content, created_at |

**contract status:** `uploaded` → `processing` → `analyzed` | `failed`

**risk_level:** `low` | `medium` | `high` | `critical`

**contract_type:** `nda` | `msa` | `saas` | `sow` | `order_form` | `employment` | `vendor_agreement` | `other`

---

## 6) API Contract Reference

All routes prefixed `/api/contracts`. All require `Authorization: Bearer <clerk_jwt>`.

### Contracts
| Method | Path | Body / Notes | Response |
|---|---|---|---|
| `POST` | `/api/contracts/upload` | multipart: `file` (PDF/DOCX ≤10MB) + `contract_type` | `{ contract: { id, filename, contract_type, status, created_at } }` |
| `POST` | `/api/contracts/:id/analyze` | — | `{ analysisId, status: "analyzed" }` |
| `GET` | `/api/contracts` | — | `{ contracts: [{ id, filename, contract_type, status, file_size, created_at, analyses: [{ id, risk_level }] }] }` |
| `GET` | `/api/contracts/:id` | — | `{ contract: { ...all fields, fileUrl, analyses: [full analysis] } }` |
| `GET` | `/api/contracts/:id/export/pdf` | — | Binary PDF download |
| `GET` | `/api/contracts/:id/export/docx` | — | Binary DOCX download |
| `DELETE` | `/api/contracts/:id` | — | 204 No Content |

### Chat
| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/contracts/:id/chat` | `{ question: string }` | `{ answer: string }` |
| `GET` | `/api/contracts/:id/chat` | — | `{ messages: [{ id, role, content, created_at }] }` |
| `DELETE` | `/api/contracts/:id/chat` | — | 204 No Content |

### Health
| Method | Path | Response |
|---|---|---|
| `GET` | `/health` | `{ ok: true }` |

---

## 7) Frontend Architecture

```
apps/web/src/
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
  *Files:* All files under `apps/api/src/`, `packages/database/schema.sql`, `packages/shared/src/types.ts`

- **2026-06-01** — Frontend scaffolded: full Next.js 14 app in apps/web
  *What:* Config files (next.config.js, tailwind, tsconfig, postcss), Clerk middleware, root layout, globals.css, lib/utils.ts, lib/api.ts, all shadcn/ui components, AppShell + Sidebar layout, auth pages (sign-in/sign-up), all 5 dashboard pages (Dashboard, Upload, Contracts list, Contract detail, Export), project_context.md
  *Files:* All files under `apps/web/src/`

---

## 11) TODO List

> Legend: `[ ]` pending · `[~]` in progress · `[x]` done (date)

### Done
| Status | Task | Date |
|---|---|---|
| `[x]` | Backend: Express API, all routes, services | 2026-06-01 |
| `[x]` | Backend: Supabase DB schema | 2026-06-01 |
| `[x]` | Backend: Clerk JWT auth middleware | 2026-06-01 |
| `[x]` | Backend: S3 storage service | 2026-06-01 |
| `[x]` | Backend: Anthropic AI analysis service | 2026-06-01 |
| `[x]` | Backend: PDF/DOCX export service | 2026-06-01 |
| `[x]` | Backend: Contract chat with history | 2026-06-01 |
| `[x]` | project_context.md created | 2026-06-01 |
| `[x]` | apps/web config files (package.json, next.config.js, tailwind, tsconfig) | 2026-06-01 |
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

### Pending
| Status | Task | Added |
|---|---|---|
| `[ ]` | Set up Clerk project + fill .env.local keys | 2026-06-01 |
| `[ ]` | Set up Supabase project + run schema.sql | 2026-06-01 |
| `[ ]` | Configure AWS S3 bucket (contralyn-contracts) | 2026-06-01 |
| `[ ]` | Deploy backend to Vercel / Railway | 2026-06-01 |
| `[ ]` | Deploy frontend to Vercel | 2026-06-01 |
| `[ ]` | Full UI redesign (Kartik to provide design prompt) | 2026-06-01 |
| `[ ]` | End-to-end testing of all features | 2026-06-01 |
| `[ ]` | Custom domain connection | 2026-06-01 |
