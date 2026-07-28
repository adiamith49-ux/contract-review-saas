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
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Gmail SMTP (amithadi@contralyne.com + app password) — powers admin password-reset, user welcome emails, contact form. **Must also be set in Vercel backend env.** |
| `CONTACT_EMAIL` | Where contact-form enquiries are delivered (default contact@contralyne.com) |
| `ADMIN_JWT_SECRET` | Secret for admin-panel JWTs (separate from Clerk) |

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
├── config.ts                     — Zod-validated env schema (fail-closed on placeholder secrets in prod)
├── db.ts                         — Supabase client
├── types.ts                      — Inlined shared types (no workspace dep needed)
├── types/docusign-esign.d.ts     — Ambient module decl (docusign-esign ships no TS types)
├── middleware/
│   ├── auth.ts                   — requireAuth: verifies Clerk JWT, sets req.userId + req.orgId/req.orgRole
│   ├── org.ts                    — requireActiveOrg, requireOrgAdmin (multi-tenancy)
│   ├── adminAuth.ts               — Super-admin JWT (separate system, ADMIN_JWT_SECRET)
│   ├── error.ts                  — Global error handler
│   └── rateLimit.ts              — Per-route rate limiters
├── routes/
│   ├── contracts.ts              — Core contract CRUD + AI routes (org-scoped)
│   ├── clauses.ts                — Clause library CRUD (org-scoped — was a cross-tenant leak, fixed)
│   ├── rules.ts                  — Review rules / playbook CRUD (org-scoped — was a cross-tenant leak, fixed)
│   ├── comments.ts               — Per-contract comment threads + team view
│   ├── approvals.ts              — Approval matrix + submit/decide (org-scoped; self-approval bug fixed)
│   ├── signature.ts              — DocuSign e-signature (submit after approval, status polling)
│   ├── tasks.ts                  — Personal + admin-assigned tasks (assignee column = provenance marker)
│   ├── tickets.ts, time.ts, calendar.ts — Support tickets, time tracking, renewal calendar
│   ├── clients.ts                — Client records + membership-scoped access
│   ├── analytics.ts              — Dashboard stats
│   ├── activity.ts               — Paginated audit log
│   ├── account.ts                — GDPR hard-delete
│   ├── admin.ts                  — Super-admin only: auth, cross-org stats, system health (mounted at /superadmin)
│   ├── admin-organizations.ts    — Super-admin org management (list/create/approve/revoke/restore/delete), mounted at /superadmin/organizations
│   ├── org.ts                    — THE admin panel's backend, reused per org (/api/org/*) — me, stats, clients,
│   │                                users, contracts, tasks, billing, clauses, playbooks, tickets — all scoped
│   │                                by Clerk org_id + requireOrgAdmin. Every org gets this same surface.
│   ├── webhooks.ts               — Clerk (user.*, organization.*) + DocuSign Connect callback
│   └── contact.ts                — Public landing-page contact form
└── services/
    ├── ai.service.ts             — Anthropic claude-sonnet-4-6 analysis (segmented/parallel, uncapped recall)
    ├── chat.service.ts           — Context-aware Q&A with history
    ├── document.service.ts       — PDF/DOCX extraction + AWS Textract OCR fallback
    ├── export.service.ts         — DOCX (Word comments + tracked redlines) + PDF generation
    ├── docxEdit.service.ts       — Applies accepted redlines into the DOCX
    ├── redline.service.ts        — Verbatim-match redline edits onto contract text
    ├── compare.service.ts        — Paragraph diff between two drafts
    ├── storage.service.ts        — S3 upload/download/delete (pre-signed URLs)
    ├── report.service.ts         — exceljs-formatted reports (dashboard, contracts, billing — org-aware)
    ├── docusign.service.ts       — JWT-grant auth + create/send envelope + status fetch
    ├── organization.service.ts   — cascadeDeleteOrganizationData() — single source of truth for org deletion
    ├── membership.service.ts     — Client-membership resolution (org-scoped)
    ├── mailer.service.ts         — SMTP (admin reset, welcome, ticket-resolved, task-assigned emails)
    ├── prompts.ts                — Jurisdiction-aware legal prompts (US/UK/EU/India)
    └── activity.service.ts       — Audit log writer
```

---

## 5) Database Schema

| Table | Key columns |
|---|---|
| `users` | id, clerk_user_id, email, org_id, created_at |
| `organizations` | id, clerk_org_id, name, status (pending\|active\|suspended\|deleted), onboarding_type, approved_at/by, suspended_at/by, deleted_at |
| `contracts` | id, user_id, org_id, client_id, filename, s3_key, file_size, mime_type, contract_type, status, contract_status (lifecycle), extracted_text, summary, version_number, parent_contract_id, created_at |
| `legal_intake` | id, contract_id, user_id, org_id, counterparty, jurisdiction, deal_value, urgency, notes, created_at |
| `analyses` | id, contract_id, user_id, org_id, risk_level, risk_summary (jsonb), clause_analysis (jsonb), negotiation_points (jsonb), ambiguity_flags (jsonb), model, created_at |
| `chat_messages` | id, contract_id, user_id, org_id, role (user/assistant), content, created_at |
| `clause_library` | id, user_id, org_id, title, content, clause_type, tags, jurisdiction, is_admin_managed, version, created_at |
| `review_rules` | id, user_id, org_id, title, description, playbook_text, jurisdiction, is_active, is_admin_managed, created_at |
| `clients` | id, user_id (nullable, admin-managed), org_id, name, industry, status, created_at |
| `client_memberships` | id, user_id, client_id, org_id, assigned_by, created_at |
| `tasks` | id, user_id, org_id, title, notes, priority, due_date, done, contract_id, assignee (reserved: "Admin"/"Approval Workflow"), attachment_s3_key/filename/mime_type/size |
| `approval_rules` | id, user_id, org_id, name, approver_name/email, step_order, min_value, risk_levels, departments, jurisdictions, contract_types, is_active |
| `contract_approvals` | id, contract_id, user_id, org_id, round, step_order, approver_name/email, status, comment, submission_note, attachment_s3_key/filename/mime_type/size, decided_at |
| `signature_requests` | id, contract_id, user_id, org_id, status, docusign_envelope_id, parties (jsonb: name/email/routing_order/status/signed_at), error_message |
| `redlines`, `contract_comments`, `contract_comparisons` | AI redline edits, matter comments, draft-vs-draft diffs — all org_id-scoped |
| `time_entries` | id, user_id, org_id, subject, contract, date, duration, duration_mins, billable, category, description |
| `tickets`, `calendar_events` | Support tickets, renewal/key-date calendar — org_id-scoped |
| `activity_logs` | id, user_id, org_id, contract_id, action, metadata (jsonb), created_at |
| `admins` | id, email, name, password_hash — **super admin only**, separate JWT auth, untouched by org_id |

**contract status:** `uploaded` → `processing` → `analyzed` \| `failed`
**contract_status (business lifecycle):** `draft` → `under_review` → `in_negotiation` → `pending_approval` → `approved` → `executed` → `expired`/`on_hold`/`terminated`
**risk_level:** `low` \| `medium` \| `high` \| `critical`
**contract_type:** `nda` \| `msa` \| `saas` \| `sow` \| `order_form` \| `employment` \| `vendor_agreement` \| `other`
**organizations.status:** `pending` (webhook race right after an invite is accepted, or the self-serve fallback — see below) \| `active` \| `suspended` (revoked, reversible) \| `deleted` (permanent)

**Organizations are created only via super-admin invite now** — there is no self-serve "create your
own organization" entry point in the UI (`/create-organization` was removed 2026-07-28). The webhook's
`self_serve` branch (org created client-side with no `sales_assisted` metadata → `pending`, needs
approval) is left in as a dead-but-harmless fallback, not an active flow — see the 2026-07-28 entry.

**Multi-tenancy note (as of today):** `org_id text` was added nullable to every business table
(additive migration, run and verified live), including `users` (added 2026-07-28 — needed so an
org admin's own "Add User" flow can scope who belongs to their firm). The existing-data-backfill +
`NOT NULL` tightening + org-aware backend deploy are **not yet done** — see §11 TODO. Until that
finishes, `org_id` sits unused/null on rows created before 2026-07-26.

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
| `GET` | `/api/clients` | Clients — **scoped to the user's `client_memberships`**. Creation is admin-only (POST /admin/clients). Empty list ⇒ UI says "contact your admin/manager" |
| `GET` | `/api/clients/:id` | Client detail — 404 unless the user is a member |
| `GET/POST/PATCH/DELETE` | `/api/clauses` | Clause library management |
| `GET/POST/PATCH/DELETE` | `/api/rules` | Review rules / playbook management |
| `GET/POST/PATCH/DELETE` | `/api/tasks` | Personal tasks + read admin/approval-assigned tasks (one-way: users can't delete assigned ones) |
| `GET` | `/api/tasks/:id/attachment-url` | Presigned download for a document an admin attached to a task |
| `GET/POST` | `/api/approvals/rules` | Approval matrix CRUD |
| `POST` | `/api/approvals/contracts/:id/submit` | Submit for approval (multipart: optional `note` + `file`) — builds the chain from active rules |
| `GET` | `/api/approvals/contracts/:id` | Current + historical approval chain, with presigned `attachment_url` per step |
| `POST` | `/api/approvals/steps/:stepId/decide` | Approve/reject/request-changes — **only the exact named approver's account**, no owner override (fixed a self-approval bug) |
| `POST` | `/api/contracts/:id/signature` | DocuSign: send envelope to 2+ parties — gated on `contract_status === "approved"` |
| `GET` | `/api/contracts/:id/signature` | Latest signature request + live per-party status (auto-refreshes from DocuSign) |
| `GET/POST/DELETE` | `/api/contracts/:id/comments` | Per-contract comment threads |
| `GET/POST` | `/api/tickets`, `/api/time`, `/api/calendar` | Support tickets, time log, renewal calendar |
| `GET` | `/api/analytics` | Dashboard stats — totals, by status/type/risk, uploads per month |
| `GET` | `/api/activity` | Paginated audit log (`?page=1&limit=20`) |
| `GET/POST/PATCH/DELETE` | `/api/org/*` | Backs the whole `/admin` frontend panel, reused per org — `/me`, stats, clients, users, contracts, tasks, billing, clause library, playbooks, tickets — all scoped by Clerk `org_id`, gated by `requireOrgAdmin` |
| `DELETE` | `/api/account` | GDPR hard-delete — all user data + S3 files |
| `POST` | `/api/contact` | **Public** landing-page contact form → emails CONTACT_EMAIL (reply-to = enquirer). Rate-limited 5/hr/IP |
| `POST` | `/api/webhooks` | Clerk (`user.*`, `organization.*`) + DocuSign Connect callback — public, signature-verified |

### Super admin (`/superadmin/*`, own bcrypt+JWT auth — not Clerk — the platform tier, above all orgs)
Scope is intentionally small: auth, cross-org oversight, and the organizations list. Everything
firm-specific was moved to `/api/org/*` (below) so every org reuses the same panel — see the
2026-07-28 changelog entry for why this replaced the earlier separate "org admin portal" design.
| Method | Path | Description |
|---|---|---|
| `POST` | `/superadmin/auth/login` · `/auth/forgot-password` · `/auth/reset-password` | Super admin auth (bcrypt + JWT, SMTP reset codes) |
| `POST` | `/superadmin/create-first-admin` | One-time bootstrap — self-disables once any admin exists (hidden page `/superadmin/setup`) |
| `GET` | `/superadmin/stats` | Cross-org totals + chart data (uploads/month, risk breakdown, by status/type, tickets) |
| `GET` | `/superadmin/system` | Infra health snapshot (DB/S3/AI/auth/email configured + connected, table row counts) |
| `GET/POST` | `/superadmin/organizations` | List all orgs; sales-assisted create (Clerk org + invite, goes live immediately) |
| `POST` | `/superadmin/organizations/:id/approve` \| `/revoke` \| `/restore` | Org lifecycle gate (approve only matters for the self-serve fallback, currently unreachable — see below) |
| `DELETE` | `/superadmin/organizations/:id` | Permanent — cascades every org-scoped DB row + S3 objects + the Clerk org itself |

### Admin panel backend (`/api/org/*`, Clerk auth + `requireOrgAdmin` — reused by every organization)
This is the same rich feature set the platform always had — dashboard, clients, users, contracts,
tasks, billing, clause library, playbooks, tickets — just scoped to the caller's own Clerk `org_id`
instead of being global. One org's admin can never see another's data.
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/org/me` | Org status + role for the caller — always 200s, frontend branches on `status` |
| `GET` | `/api/org/stats` | Dashboard totals + chart data, scoped to the caller's org |
| `GET` | `/api/org/contracts` · `/api/org/contracts/:id/history` | Org-scoped read-only contract overview + audit trail |
| `GET/POST/DELETE` | `/api/org/tasks`, `/api/org/tasks/with-attachment` | Admin-assigned tasks (`assignee = "Admin"`) — personal tasks stay private to users |
| `GET/POST/PATCH/DELETE` | `/api/org/tickets`, `/api/org/clients`, `/api/org/users`, `/api/org/clauses`, `/api/org/playbooks` | Org-scoped management |
| `GET` | `/api/org/report/:kind` | Formatted `.xlsx`, org-scoped — `dashboard` \| `contracts` |
| `GET` | `/api/org/billing` · `/api/org/billing/report` | Billable-hours totals + `.xlsx` export, per user or all users, org-scoped |
| `POST` | `/api/org/users/add` | Create Clerk user + add as `org:member` of the caller's org (so their own session gets `org_id`) + **sends welcome email** |
| `DELETE` | `/api/org/users/:userId` | Delete user from Clerk + hard-delete all their org-scoped data + S3 files |
| `POST/DELETE` | `/api/org/users/:userId/clients` | Assign / remove client memberships |

### Health
| Method | Path | Response |
|---|---|---|
| `GET` | `/health` | `{ ok: true }` |

---

## 7) Frontend Architecture

```
frontend/src/
├── middleware.ts                      — Clerk route protection + domain split (see §8)
├── app/
│   ├── layout.tsx                     — Root layout: ClerkProvider, Toaster, fonts
│   ├── page.tsx                       — Marketing landing page (contralyne.com only)
│   ├── globals.css                    — Tailwind directives + CSS vars (brand: Teal Wave #00BFA6 primary,
│   │                                    Deep Lagoon #0F2A2A dark surfaces, Aqua Silk #D9FAF4 background)
│   ├── (auth)/                        — sign-in only; sign-up removed, admin-provisioned accounts only
│   ├── admin/                         — THE admin panel, reused by every organization (dashboard, clients,
│   │                                    users, contracts, tasks, billing, clauses, playbooks, tickets).
│   │                                    Clerk-authenticated; layout.tsx gates on org_role === "org:admin"
│   │                                    and an active org, scoped entirely via /api/org/*
│   ├── superadmin/                    — Platform tier, above all orgs (own bcrypt+JWT auth, not Clerk):
│   │                                    dashboard (cross-org stats + system health), organizations
│   │                                    (invite/list/suspend/delete), login, setup
│   ├── organization/
│   │   ├── none/                      — Gate screen: caller has no organization at all
│   │   ├── pending/, suspended/       — Gate screens (outside dashboard chrome, OrgGate redirects here)
│   │   └── (settings lives under (dashboard)/organization/settings below)
│   └── (dashboard)/
│       ├── layout.tsx                 — AppShell (Sidebar + OrgGate wrapper)
│       ├── page.tsx / dashboard/      — Stats + recent contracts
│       ├── upload/, contracts/[id]/   — Upload flow; contract detail (AI review, redline, 5 popup panels)
│       ├── clients/, clauses/, rules/, analytics/, activity/, settings/
│       ├── tasks/, time/, calendar/, approvals/, tickets/  — Collaboration/workflow surfaces
│       └── organization/settings/[[...]]/ — Hosts Clerk's <OrganizationProfile/> (member invite/list/roles)
├── components/
│   ├── ui/                            — shadcn/ui primitives
│   ├── layout/
│   │   ├── Sidebar.tsx                — Left nav (collapsible "«", contract-context swap, full wordmark logo);
│   │   │                                shows an "Admin Panel" link (→ /admin) + "Org Settings" for org:admin
│   │   ├── AppShell.tsx               — Sidebar + OrgGate + main content wrapper
│   │   ├── OrgGate.tsx                — Redirects based on GET /api/org/me (no org / pending / suspended)
│   │   └── NavTimer.tsx               — Start/stop billable timer, top of sidebar
│   ├── ContractDetailTabs.tsx         — Popup dialog host for the 5 contract side-panels
│   ├── IntakePanel, ApprovalPanel, VersionComparePanel, MatterWorkspace, SignaturePanel — the 5 panels
│   ├── RiskBadge.tsx / StatusBadge.tsx
│   └── AIChatFloat.tsx                — Floating per-contract AI chat
└── lib/
    ├── utils.ts                       — cn(), formatFileSize(), formatDate(), label maps
    ├── api.ts                         — All user-facing API methods, typed, token-injected
    ├── admin-api.ts                   — /admin panel's client, hits /api/org/* with a Clerk token read
    │                                    imperatively off window.Clerk (keeps the same plain-function
    │                                    shape without threading a token through every call site)
    ├── superadmin-api.ts              — /superadmin client (bcrypt+JWT, localStorage token)
    └── org-api.ts                     — just getOrgMe() now; OrgGate + /admin/layout.tsx's gate check
```

### Pages (selected — see `/admin/*` and `/superadmin/*` above for the rest)
| Route | Purpose |
|---|---|
| `/` | Marketing landing page — **contralyne.com only**, redirects to app.contralyne.com for everything else |
| `/dashboard` | Stats cards + recent contracts + quick upload CTA |
| `/upload` | Drag-drop file + contract type, playbook selection starts with **none pre-selected** |
| `/contracts` | Filterable table of all contracts |
| `/contracts/[id]` | AI review + document viewer, full-width; Legal Intake/Approval/Versions/Workspace/Signature open as fixed-size popups (`?panel=` query param), selected from the sidebar's contract-context nav |
| `/sign-in` | Custom email+password + Google OAuth. No self sign-up — accounts admin-provisioned or via org invite |
| `/tasks` | Personal tasks + admin/approval-assigned tasks (one-way: users can't delete assigned ones) |
| `/time` | Log-only time view (manual entry form removed — nav timer is the only way to create entries) |
| `/admin/*` | The org-admin panel — Clerk-authenticated, reused by every organization, scoped via `/api/org/*` |
| `/superadmin/*` | Platform tier — separate bcrypt+JWT auth, above all organizations |
| `/organization/none`, `/pending`, `/suspended` | Gate screens for a caller with no org / an org still syncing / a suspended-deleted org |

---

## 8) Auth Flow

1. User signs in via Clerk (`/sign-in`) — email/password or Google OAuth.
2. Clerk middleware (`middleware.ts`) protects all `(dashboard)` routes — unauthenticated → redirect to `/sign-in`. It also does a **host-based domain split**: `contralyne.com`/`www` serve only the landing page (any other path 308-redirects to the same path on `app.contralyne.com`); `app.contralyne.com` is the actual product and is marked `noindex, nofollow`.
3. Frontend gets token: `const { getToken } = useAuth(); const token = await getToken();`
4. Every API call sends `Authorization: Bearer <token>` header.
5. Backend `requireAuth` middleware verifies the token via Clerk SDK, sets `req.userId = payload.sub` **and, as of the multi-tenancy work, `req.orgId`/`req.orgRole` from the token's `org_id`/`org_role` claims** (present by default, no Clerk Dashboard token customization needed).
6. **Super admin** (`/superadmin/*`) is a deliberate exception — its own JWT signed with `ADMIN_JWT_SECRET`, verified by `adminAuth.ts`, completely independent of Clerk. This predates Organizations and sits *above* them (platform-level, not an org role).
7. **Org admin** is just a Clerk Organization role (`org:admin`) — same sign-in as any other user, no separate credential system. `/admin/*`'s own `layout.tsx` checks `org_role === "org:admin"` plus an active org (via `GET /api/org/me`) before rendering — a regular member hitting `/admin` directly gets redirected to `/dashboard`.

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

- **2026-07-10** — Admin user management fixed + user deletion added
  *What:* Fixed "Unprocessable Entity" on admin Add User (Clerk instance requires a username — now auto-derived from email with collision fallback; real Clerk error messages surfaced). Added DELETE /admin/users/:userId — removes user from Clerk + hard-deletes all their data and S3 files, with confirm dialog in the admin UI. Removed "Set up admin account" link from admin login (bootstrap page /admin/setup kept hidden, self-disables once an admin exists). Created flow.md — 7-step user handout for demos.
  *Files:* `backend/src/routes/admin.ts`, `frontend/src/lib/admin-api.ts`, `frontend/src/app/admin/users/page.tsx`, `frontend/src/app/admin/login/page.tsx`, `flow.md`

- **2026-07-10** — Welcome email on user creation + SMTP configured
  *What:* POST /admin/users/add now sends the new user a welcome email (via Gmail SMTP, amithadi@contralyne.com app password) with 6-step first-login instructions (Forgot Password flow). Best-effort — user creation succeeds even if mail fails; admin toast reports whether the email was sent. sendMail() gained replyTo support. Verified end-to-end. SMTP env vars still need to be added to Vercel backend project.
  *Files:* `backend/src/routes/admin.ts`, `backend/src/services/mailer.service.ts`, `backend/src/config.ts`, `backend/.env`, `frontend/src/app/admin/users/page.tsx`, `frontend/src/lib/admin-api.ts`

- **2026-07-10** — Landing page reworked for enterprise + contact form
  *What:* Removed Pricing section ($49/$99 plans) and all "Get Started Free" self-signup CTAs — Contralyne is sold to firms, not solo users. Added Contact Sales section (name, work email, firm, team size, message) → new public POST /api/contact (rate-limited 5/hr/IP) emails contact@contralyne.com with reply-to set to the enquirer. All CTAs now "Request a Demo" → #contact; footer email changed from personal Gmail to contact@contralyne.com. NOTE: contact@contralyne.com alias must exist in Google Workspace.
  *Files:* `frontend/src/app/page.tsx`, `backend/src/routes/contact.ts`, `backend/src/app.ts`, `backend/src/middleware/rateLimit.ts`, `backend/src/config.ts`

- **2026-07-10** — Auth locked down to admin-provisioned accounts
  *What:* Removed Google + Facebook OAuth buttons and the sign-up link from /sign-in; deleted the /sign-up page entirely (route now redirects to sign-in via middleware). Sign-in note says "Ask your administrator to create one for you." Removed the admin "Invite user" button/dialog + POST /admin/users/invite route ("Add user" + welcome email is the only onboarding path). NOTE: Clerk's HaveIBeenPwned compromised-password check was briefly disabled then re-enabled at Kartik's request — it stays ON; users whose password is rejected as "found in a data breach" must pick a less common password.
  *Files:* `frontend/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `frontend/src/app/(auth)/sign-up/` (deleted), `frontend/src/middleware.ts`, `frontend/src/app/admin/users/page.tsx`, `frontend/src/lib/admin-api.ts`, `backend/src/routes/admin.ts`

- **2026-07-10** — Clients scoped to memberships; creation is admin-only
  *What:* GET /api/clients now returns only clients the user is assigned to via client_memberships (was: all active clients). GET /api/clients/:id 404s for non-members. POST /api/clients removed entirely — clients are created only by the admin (POST /admin/clients); the "New Client" button/dialog removed from the user-side Clients page. Client detail page edit controls removed too (rename pencil, Mark Inactive, Reactivate — they called a PATCH route that never existed on the backend); the page is now read-only apart from Upload Contract. Empty state says "No clients assigned to you — contact your admin or manager."
  *Files:* `backend/src/routes/clients.ts`, `frontend/src/app/(dashboard)/clients/page.tsx`, `frontend/src/app/(dashboard)/clients/[id]/page.tsx`, `frontend/src/lib/api.ts`

> Dates below (2026-07-17 onward) are reconstructed from session context (screenshots, system date markers) rather than commit timestamps — treat as approximate.

- **2026-07-17** — Ticket resolution email, admin Contracts tab, per-tab Excel reports, playbook default, nav timer
  *What:* (1) User is emailed automatically when admin resolves their support ticket. (2) New admin **Contracts** tab — every contract + per-contract history (activity trail, analysis, chat count) + report download; admin **Dashboard** got recharts bar/pie charts (uploads/month, risk breakdown, contracts by type/status). (3) Reports properly formatted `.xlsx` (exceljs — branded header, zebra rows, frozen header + autofilter), one per tab (dashboard report ≠ contracts report), not CSV. (4) Upload page playbook selection now starts with **zero** playbooks pre-selected (was all). (5) The "New Request" top-nav button replaced with a **play/stop timer**; stopping opens a popup (name, billable toggle, description) and auto-creates a time entry. (6) Time page reduced to a **log only** (manual entry form removed); clicking an entry opens a detail view with exact date/time. (7) Admin gained a **Tasks** tab to assign work to users — strictly **one-way**: only admin-assigned or approval-generated tasks are visible to admin; users' personal tasks stay private and admin can't see/delete them. When a contract is routed to an approver, a task is auto-added to their task list too (`tasks.assignee` reused as a provenance marker: `"Admin"` / `"Approval Workflow"` / anything else = personal — no schema migration needed).
  *Files:* `backend/src/routes/admin.ts`, `backend/src/routes/approvals.ts`, `backend/src/routes/tasks.ts`, `backend/src/services/report.service.ts` (new), `frontend/src/components/layout/NavTimer.tsx` (new), `frontend/src/app/(dashboard)/time/page.tsx`, `frontend/src/app/(dashboard)/tasks/page.tsx`, `frontend/src/app/admin/{contracts,tasks,dashboard,tickets}/page.tsx`, `frontend/src/lib/admin-api.ts`

- **2026-07-17/18** — Domain split for SEO (contralyne.com landing / app.contralyne.com product)
  *What:* `contralyne.com` now serves **only** the marketing landing page (better SEO, marketing team never touches the app); every other path 308-redirects to the same path on `app.contralyne.com`, which is itself marked `X-Robots-Tag: noindex, nofollow`. Host detection uses the `Host` header (not `nextUrl.hostname`, unreliable in dev/behind proxies). Configured live via Vercel CLI under Amith's account (`adiamith49-ux`) — subdomain added to the `web` project (DNS already on Vercel nameservers, automatic SSL), `WEB_URL`/`LANDING_URL` set in production env, CORS updated to allow both origins. Verified end-to-end in production (redirects, noindex header, CORS preflights).
  *Files:* `frontend/src/middleware.ts`, `backend/src/app.ts`, `backend/src/config.ts`, `backend/.env.example`

- **2026-07-18/20** — Landing page rebrand (multiple iterations → settled palette)
  *What:* Several rounds of landing-page visual direction (Ironclad-style layout inspiration, a custom black-bracket-"C" + red-"L" logo mark commissioned separately, a few candidate color palettes tried and reverted — including a brief "everything red" pass that was explicitly walked back). **Settled on:** Teal Wave `#00BFA6` as the primary/brand color, Deep Lagoon `#0F2A2A` for dark surfaces/ink text, Aqua Silk `#D9FAF4` as the page background — applied both to the landing page and, via the shared shadcn tokens + a remapped Tailwind `emerald` scale, to the entire app and admin panel. The new logo mark (with its own red accent) replaced the placeholder SVG everywhere, including the browser favicon (white backing tile so it isn't transparent in the tab strip). "Red Line" in the hero tagline and a couple of thematically-red UI touches (risk flags, redline exports) intentionally kept a plain red accent distinct from the teal brand color.
  *Files:* `frontend/src/app/page.tsx`, `frontend/src/app/globals.css`, `frontend/tailwind.config.ts`, `frontend/src/components/ContralyneLogoMark.tsx`, `frontend/public/logo.png`, `frontend/src/app/icon.png`

- **2026-07-24** — Admin billing export, task attachments, approval attachments, self-approval bug fix
  *What:* (1) New admin **Billing** tab — download billable work as formatted `.xlsx`, per user or all users at once, same visual standard as the other reports; backed by a new `time_entries` table (existed live, now properly captured in `schema.sql`). (2) Admin task assignment can now optionally **attach a contract document** (uploaded to S3) — the user downloads it from their Tasks page and re-uploads it through the normal Upload flow to run analysis (deliberately manual, no auto-linking). (3) Submitting a contract for approval can now include an optional **note and/or supporting document**, visible to every approver on every step of that round. (4) **Fixed a real security bug**: `POST /api/approvals/steps/:stepId/decide` let the contract owner decide *any* step as a fallback (a leftover "no orgs/RBAC" workaround) — meaning a user could approve/reject their own submission by virtue of owning the contract, even when a different named approver's account existed. Now strictly requires the logged-in account's email to match that step's named approver, no owner override.
  *Files:* `backend/src/services/report.service.ts`, `backend/src/routes/admin.ts`, `backend/src/routes/tasks.ts`, `backend/src/routes/approvals.ts`, `frontend/src/app/admin/billing/page.tsx` (new), `frontend/src/app/admin/tasks/page.tsx`, `frontend/src/app/(dashboard)/tasks/page.tsx`, `frontend/src/components/ApprovalPanel.tsx`, `packages/database/schema.sql`

- **2026-07-25/26** — DocuSign e-signature integration
  *What:* After a contract's approval chain completes (`contract_status === "approved"`), users can **Submit for Signature** — a popup collects 2+ signing parties (name + email, add more as needed) and sends a real DocuSign envelope (JWT Grant server-to-server auth, `docusign-esign` SDK) with one Sign Here tab per party, stacked on page 1 of the original uploaded document. DocuSign emails each party its own signing link. Status (pending/delivered/signed/declined) is tracked per party in a new `signature_requests` table, refreshable on demand and reconciled automatically via a DocuSign Connect webhook (`POST /api/webhooks/docusign`). Party status label reads "Pending" (not "Sent") with elapsed time shown underneath. **This is genuinely live and working**: a real DocuSign sandbox account was provisioned, JWT auth verified end-to-end (including the one-time consent-grant flow, which needed a redirect URI registered on the DocuSign app), and a test envelope created directly against the API. Credentials pushed to Vercel production env and the API redeployed to pick them up. Currently sandbox (`demo.docusign.net`) — going fully live needs DocuSign's separate "Go-Live" approval + a second production credential set.
  *Files:* `backend/src/services/docusign.service.ts` (new), `backend/src/routes/signature.ts` (new), `backend/src/routes/webhooks.ts`, `backend/src/config.ts`, `frontend/src/components/SignaturePanel.tsx` (new), `packages/database/schema.sql`
  *Note:* This is explicitly **beyond the locked V1 scope** (`CLAUDE.md` lists "DocuSign/e-signature" as out-of-scope) — built anyway as goodwill, same as approval routing/task assignment/calendar before it.

- **2026-07-26** — Left sidebar navigation + contract detail page reworked into popups
  *What:* Replaced the horizontal top nav with a **collapsible left sidebar** (full wordmark logo, "«" collapse toggle sitting on the header's divider line, timer moved to the top for visibility, app-launcher grid removed since every destination is already a direct sidebar link). While viewing a specific contract, the sidebar's main nav **swaps** to the 5 contract-context panels (Legal Intake, Approval, Versions, Workspace, Signature) instead of the app-wide nav. Those 5 panels — previously stacked as separate collapsible bands taking up a lot of vertical space above the document — now open as a **fixed-size popup dialog** (same dimensions for all 5, internal scroll) on top of the document/AI-review view, which stays mounted underneath and now gets the full page.
  *Files:* `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/components/layout/AppShell.tsx`, `frontend/src/components/ContractDetailTabs.tsx`, `frontend/src/components/{IntakePanel,ApprovalPanel,VersionComparePanel,MatterWorkspace,SignaturePanel}.tsx` (all gained an `embedded` prop)

- **2026-07-26 (separate session) — Multi-tenancy retrofit: Organizations**
  *What:* Adds a proper `organizations` (law-firm tenant) layer above the existing single-admin/single-user model, per the plan at `C:\Users\kartik\.claude\plans\partitioned-snacking-planet.md`. New `organizations` table + nullable `org_id` on all 19 business tables; `requireAuth` now also reads `org_id`/`org_role` off the Clerk token; new `requireActiveOrg`/`requireOrgAdmin` middleware; every existing route re-scoped by org; a **super admin portal** (`/admin/organizations` — list, sales-assisted create+invite, approve/revoke/restore, permanent delete) and a separate **org admin portal** (`/organization/**`, Clerk-authenticated, uses Clerk's own `<OrganizationProfile/>` for member management — no hand-built invite code) were built. **Two real pre-existing security gaps found and fixed during this pass**: `clauses.ts`/`rules.ts` served every user's clause library/playbook with zero tenant filtering (comment literally said "global admin-managed library"), and the approval self-approval bug above. Super admin (`admins` table, separate JWT) stays untouched — it sits *above* organizations, not inside them.
  *Status as of today:* All code written and typechecks clean (fixed one real bug during verification — `clerk.organizationInvitations.createOrganizationInvitation` doesn't exist, the method lives on `clerk.organizations`). **The additive schema step has been run and verified live** (organizations table + nullable org_id on every table, confirmed queryable). Clerk Organizations confirmed enabled (live API check) for the instance actually in use. `PLATFORM_OWNER_CLERK_USER_ID` set.
  *Files:* `packages/database/schema.sql`, `backend/src/middleware/{auth,org}.ts`, `backend/src/routes/{admin-organizations,org}.ts` (new), `backend/src/services/organization.service.ts` (new), `backend/scripts/migrate-org1.ts` (new, not yet executed), `backend/src/routes/webhooks.ts`, every route file under `backend/src/routes/`, `frontend/src/components/layout/OrgGate.tsx` (new), `frontend/src/app/{create-organization,organization}/**` (new), `frontend/src/app/(dashboard)/organization/**` (new), `frontend/src/lib/org-api.ts` (new)
  ⚠️ **Superseded 2026-07-28 — see the entry directly below.** The "separate org admin portal" design above did not match the intended workflow: the client wanted every firm to reuse the *existing* `/admin` panel (scoped to their own org), not a second, thinner portal built alongside it. Treat the architecture described above as historical — the corrected shape is below.

- **2026-07-28 — Multi-tenancy correction: reuse `/admin` per-org instead of a parallel portal**
  *What:* The prior session's "org admin portal" (`frontend/src/app/(dashboard)/organization/{clients,tasks,billing,clauses,playbooks}`, backed by a separate `/api/org/*` implementation) was a second, less-complete copy of `/admin`'s functionality — duplicated code, and firm admins would have gotten a visibly thinner UI than the super admin's. Corrected model, per the client: a **super admin** (`/superadmin`, unchanged bcrypt+JWT auth) invites organizations and oversees the list; self-serve signup is disabled for now (invite-only). Every organization's admin then uses the **same existing `/admin` panel** — dashboard, clients, users, contracts, tasks, billing, clauses, playbooks, tickets — just scoped to their own org, gated by Clerk (`org_role === "org:admin"`) instead of the bcrypt/JWT system. That system moved to `/superadmin` and now only covers auth + cross-org stats/system health + the organizations list.
  *How it works end to end:* Super admin invites a firm (name + admin email) → Clerk org created + `org:admin` invitation sent, active immediately (sales-assisted, no approval gate) → invited person accepts, signs in (personal email OK for now) → lands with `org_id`/`org_role` already on their Clerk session → `/admin` panel now renders, scoped to that org. That admin creates their firm's own users via the existing "Add User" flow (`POST /api/org/users/add`), which now also adds them as an `org:member` of the same Clerk org (previously created users had no org membership at all, so their own session never carried an `org_id`) — those users work in the normal (dashboard) app, and their work is visible only to their own org's `/admin`, never to `/superadmin` or another org.
  *Backend:* `org.ts` grew from just clients/clauses/playbooks/tasks/billing to the full set — added `/stats`, `/users` (list/add/delete/memberships), `/contracts` (list/history), `/tickets`, `/report/:kind` — all scoped by `req.orgId` via `requireOrgAdmin`. `admin.ts` trimmed to auth + cross-org `/stats` + `/system` only. Both `admin.ts` and `admin-organizations.ts` remounted from `/admin` to `/superadmin` in `app.ts`. Added `org_id text` to the `users` table (schema + live migration) — needed so org-scoped user management and billing reports can resolve emails per org. `report.service.ts`'s `buildDashboardReport`/`buildContractsReport` gained an optional `orgId` param (same convention `buildBillingReport` already used) so the per-org "Download Report" button works.
  *Frontend:* New `frontend/src/app/superadmin/**` (login, setup, dashboard, organizations) + `frontend/src/lib/superadmin-api.ts`, mirroring the old `/admin` login/setup/organizations pages almost exactly. `frontend/src/app/admin/layout.tsx` rewritten to gate on Clerk (`useAuth()` + `getOrgMe()`) instead of the bcrypt token, and its sidebar dropped the Organizations/System links (moved to superadmin). `frontend/src/lib/admin-api.ts` repointed every call from `/admin/*` to `/api/org/*`, reading the Clerk token imperatively via `window.Clerk.session.getToken()` so every existing `/admin/**` page kept working unchanged (same function names/shapes). Deleted: `frontend/src/app/(dashboard)/organization/{clients,tasks,billing,clauses,playbooks}` (superseded by scoped `/admin`), `frontend/src/app/create-organization/**` (self-serve removed), `frontend/src/app/admin/{organizations,system,setup,login}` (moved to `/superadmin`), `frontend/src/components/organization/AccessDenied.tsx` (only used by the deleted pages). `middleware.ts`'s public-route list swapped `/admin(.*)` for `/superadmin(.*)` — `/admin` now needs a real Clerk session at the edge. Added `frontend/src/app/organization/none/page.tsx` for the "no organization, not self-serve-able" gate state; `OrgGate.tsx` redirects there instead of to the removed `/create-organization`.
  *Not done / left as-is:* `backend/scripts/migrate-org1.ts` is still pending (not yet run) but now includes `users` in its backfill list; the webhook's `organization.created` self-serve/`pending` fallback branch is untouched (harmless, just unreachable now that no UI creates an org that way); `cascadeDeleteOrganizationData` still doesn't clean up `users` rows on permanent org delete (pre-existing gap, not introduced by this change). See §11 TODO for the still-pending backfill/deploy sequence.
  *Files:* `backend/src/routes/{org,admin}.ts`, `backend/src/routes/admin-organizations.ts` (comments only), `backend/src/app.ts`, `backend/src/services/report.service.ts`, `packages/database/schema.sql`, `backend/.env.example` (comment), `frontend/src/app/admin/layout.tsx`, `frontend/src/lib/{admin-api,org-api}.ts` (new `superadmin-api.ts`), `frontend/src/app/superadmin/**` (new), `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/components/layout/OrgGate.tsx`, `frontend/src/middleware.ts`, `frontend/src/app/organization/{none/page.tsx (new), pending/page.tsx (copy tweak)}`

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

### Recently Done (2026-07-10)
| Status | Task | Date |
|---|---|---|
| `[x]` | Admin: delete user (Clerk + all data + S3) | 2026-07-10 |
| `[x]` | Fix "Unprocessable Entity" on admin Add User (Clerk username requirement) | 2026-07-10 |
| `[x]` | Welcome email with login steps on user creation (SMTP via Gmail) | 2026-07-10 |
| `[x]` | Landing page: remove pricing, enterprise repositioning, contact form → contact@contralyne.com | 2026-07-10 |
| `[x]` | Remove OAuth (Google/Facebook) + self sign-up; admin-provisioned accounts only | 2026-07-10 |
| `[x]` | Clients page scoped to assigned memberships; creation admin-only; empty state → contact admin | 2026-07-10 |
| `[x]` | Remove admin "Invite user" flow (UI + API route) | 2026-07-10 |
| `[x]` | flow.md user demo handout | 2026-07-10 |

### Recently Done (2026-07-17 → 2026-07-26)
| Status | Task | Date |
|---|---|---|
| `[x]` | Ticket resolution email to the user | 2026-07-17 |
| `[x]` | Admin Contracts tab (global view + per-contract history) + dashboard charts | 2026-07-17 |
| `[x]` | Per-tab formatted Excel reports (dashboard / contracts / billing) | 2026-07-17 / 24 |
| `[x]` | Upload page: playbooks start unselected | 2026-07-17 |
| `[x]` | Nav timer (replaces "New Request") + Time page = log only + entry detail view | 2026-07-17 |
| `[x]` | Admin task assignment, strictly one-way, + email; approval routing auto-adds approver tasks | 2026-07-17 |
| `[x]` | Domain split: contralyne.com (landing only) / app.contralyne.com (product), noindex on app | 2026-07-17/18 |
| `[x]` | Landing page rebrand — new logo mark, Teal Wave/Deep Lagoon/Aqua Silk palette app-wide | 2026-07-18/20 |
| `[x]` | Admin billing (billable-hours) Excel export, per user or all | 2026-07-24 |
| `[x]` | Admin task assignment: optional contract-document attachment | 2026-07-24 |
| `[x]` | Approval submission: optional note + attachment, visible to every approver | 2026-07-24 |
| `[x]` | Fix: self-approval bug in approval decision endpoint | 2026-07-24 |
| `[x]` | DocuSign e-signature — submit after approval, real envelope send, status tracking, webhook | 2026-07-25/26 |
| `[x]` | Left sidebar nav (replaces top bar); 5 contract panels → fixed-size popup dialogs | 2026-07-26 |
| `[x]` | Multi-tenancy: additive schema (organizations table + org_id everywhere) — run + verified live | 2026-07-26 |
| `[x]` | Multi-tenancy correction: `/admin` reused per-org instead of a separate portal; `/superadmin` split out; self-serve org creation removed | 2026-07-28 |

### Pending
| Status | Task | Added |
|---|---|---|
| `[ ]` | **Multi-tenancy — remaining steps, in order**: (1) run `npm run migrate:org1 -- --name "Amith's Firm" --admin-email amithadi@contralyne.com` from `backend/` to create the real Clerk org + backfill existing data into it (now includes `users`); (2) spot-check contracts/clients/clauses for org #1 in Supabase; (3) run the commented `ALTER COLUMN org_id SET NOT NULL` block in `schema.sql`; (4) **only then** deploy the org-aware backend/frontend code; (5) add the Clerk webhook's `organization.*` events at `https://api.contralyne.com/api/webhooks/clerk`; (6) update `CLAUDE.md`'s "Tenancy model" section, which currently states multi-tenancy doesn't exist | 2026-07-26 |
| `[ ]` | Decide + apply Clerk email-restriction setting on the **Development** instance (the one actually live in prod today) — currently "any email allowed"; org-only-email is set on Production but has no effect yet since prod isn't on a real Production instance | 2026-07-26 |
| `[ ]` | Migrate Clerk to a real production instance (prod currently runs on the `pk_test_…` dev instance — also blocks the item above from being clean) | 2026-06-01 (long-standing) |
| `[ ]` | DocuSign: request Go-Live + production credentials once ready to send real (non-sandbox) envelopes | 2026-07-26 |
| `[ ]` | Commit + push all 2026-07-10 changes (deploys to production via Vercel) | 2026-07-10 |
| `[ ]` | Add SMTP_* env vars to Vercel backend project + verify WEB_URL=https://contralyne.com | 2026-07-10 |
| `[ ]` | Verify contact@contralyne.com alias exists in Google Workspace (else contact-form mail bounces) | 2026-07-10 |
| `[ ]` | End-to-end testing of all features | 2026-06-01 |
| `[ ]` | Transfer Supabase billing to Amith | 2026-06-10 |
| `[ ]` | Transfer S3 billing to Amith | 2026-06-10 |
| `[ ]` | Collect Milestone 2 — ₹6,000 | 2026-06-10 |
| `[ ]` | Collect Milestone 3 — ₹6,000 | 2026-06-10 |
