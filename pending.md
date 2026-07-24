# Contralyne — Pending Work Tracker

Based on: `CONTRALYNE_Enterprise_SOP_PRD_v1_corrected.docx`
Last updated: 2026-06-12

Mark tasks as done with `[x]` when complete.

---

## Ad hoc — requested by Kartik (2026-07-24)

- [x] Admin: download billable work as a formatted Excel export — per user, or all users at once (same visual standard as the existing dashboard/contracts report exports)
- [x] Admin task assignment: optionally attach a contract document the user must download and re-upload (via the normal Upload flow) to run analysis
- [x] Contract approval submission: let the submitting user attach a supporting "child" document and/or a text note, visible to every approver in that round
- [x] Fix: approval decision could be made by the contract owner on any step, not just the actual named approver's account (self-approval bug)

---

## Ad hoc — requested by Kartik (2026-07-26) — layout/UX

- [x] User app: move primary navigation from the top bar into a standard left-hand sidebar (like the admin panel already has)
- [x] Contract detail page: the 4 stacked bands (Legal Intake, Approval, Versions, Matter Workspace) take up too much vertical space one after another — consolidate into a compact tab strip
- [x] Contract detail page: AI Review panel + document viewer should get the freed-up vertical space so they feel full-page, not squeezed
- [x] Sidebar: use the full wordmark logo at the top instead of icon + typed name
- [x] Sidebar: remove the app-launcher grid icon (its destinations are already all in the sidebar nav)
- [x] Sidebar: give the timer widget a better, more visible spot
- [x] Sidebar: while viewing a contract, swap the main nav for the 4 consolidated panels (Legal Intake / Approval / Versions / Workspace) as the navigator
- [x] Sidebar: add a "«" collapse toggle next to the logo to shrink it to icon-only rail mode

---

## Module 1 — Dashboard

- [ ] Risk Heatmap — visual grid of contracts by risk tier (High / Medium / Low)
- [ ] Renewal Calendar — timeline view of contracts due for renewal in next 90 days
- [ ] AI Insights Panel — top 3 AI-flagged issues across active contracts
- [ ] My Tasks section — pending approvals, pending signatures, open negotiation rounds
- [ ] Role-sensitive layout — dashboard adapts based on user's assigned role
- [ ] Multi-tenant data scoping — dashboard data scoped to user's organization (blocked on RBAC)

---

## Module 2 — Contract Intake

- [ ] Create from Template — option to draft a new agreement (alongside existing Upload flow)
- [ ] 25MB file size limit (currently capped at 10MB)
- [ ] .txt file support (currently PDF/DOCX only)
- [ ] Virus scanning — scan uploaded files before storage; quarantine on failure
- [ ] Duplicate detection — warn if same counterparty + contract type exists within 90 days
- [ ] In-app notification on successful intake
- [ ] Email confirmation on successful intake
- [ ] Business Unit metadata field on intake form
- [ ] Tags field (multi-select, free-form or pre-configured) on intake form
- [ ] Counterparty Entity Type field (Corporation, LLC, Individual, Government)

---

## Module 3 — AI Review Workspace

- [x] Split-pane viewer — left panel (ReviewPanel) shows all AI findings; right panel (DocumentViewer) shows contract with inline paragraph annotations (2026-06-12)
- [x] Clause highlighting — clicking any item in ReviewPanel scrolls to and highlights the matching paragraph in DocumentViewer (2026-06-12)
- [x] AI analysis sidebar replaces the old chat panel — Risk Areas, Clause Issues, Negotiation Points, Ambiguity Flags all in left panel (2026-06-12)
- [x] AI chat moved to floating circle button bottom-right — opens as a chat drawer (AIChatFloat) (2026-06-12)
- [x] Playbook selection on upload page — user picks which review rules to apply; rules + contract both sent to Claude (2026-06-12)
- [x] Review Rules changed to Playbook document upload — users upload DOCX/PDF playbook; system extracts text and injects it into Claude analysis (2026-06-12)
- [ ] Missing Clause Detection — AI flags standard clauses absent from the contract
- [ ] Market Standard Benchmarking — AI compares key terms against market norms for contract type
- [ ] Per-clause redline workflow — Accept / Modify / Reject AI-suggested language (true word-level redlines)
- [ ] Risk scores cite specific playbook rule triggered (rules injected as context, not cited per-clause yet)

---

## Module 4 — Playbook Engine

- [ ] Structured fallback positions — Preferred Position, Fallback 1, Fallback 2, Walk-Away per clause type
- [ ] Walk-Away position — triggers mandatory escalation; 100% enforcement required
- [ ] Risk Tier Override — manual assignment of High/Medium/Low for specific deviations
- [ ] Escalation rules — define who must approve when clause hits Fallback 2 or Walk-Away
- [ ] Playbook version history — retain prior versions for audit
- [ ] Per contract-type scoping — scope playbook rules to NDA, MSA, SOW, Vendor, etc.
- [ ] Playbook publish → AI picks up updated rules within 1 hour

---

## Module 5 — Negotiation Center

- [ ] Per-clause negotiation actions — Accept / Counter-Propose / Escalate / Mark Market Standard / Reject
- [ ] AI pre-populates counter-proposals with relevant playbook fallback language
- [ ] Escalated clauses route to correct approver as defined in Playbook Engine
- [ ] Redlined document generation — incorporates all accepted and counter-proposed positions
- [ ] Send redlines to counterparty via secure link or email
- [ ] Ingest counterparty responses and open a new negotiation round
- [ ] Full audit trail per negotiation action (user, timestamp, rationale)
- [ ] Redlined .docx export available within 30 seconds of completing a negotiation round

---

## Module 6 — Approval Workflow

- [ ] Configurable multi-level approval chains
- [ ] Value-based routing matrix (< $50K → Manager, $50K–$500K → Director, > $500K → C-Suite)
- [ ] High AI risk score → Legal Director + CFO approval (regardless of value)
- [ ] Walk-Away clause → CLO mandatory approval (non-waivable)
- [ ] New counterparty (first contract) → Compliance Officer KYC/AML check
- [ ] Approver in-app notifications within 60 seconds of preceding approval
- [ ] Approver email notifications
- [ ] Approve / Reject / Request Changes with comments
- [ ] Rejected contracts return to owner with all reviewer comments
- [ ] Full approval audit trail — stored and exportable

---

## Module 7 — Repository & Search

- [ ] AI-powered semantic search — e.g. "Find all contracts with unlimited liability exposure"
- [ ] Saved search templates for frequently used filter combinations
- [ ] Full contract lifecycle states: Draft → Under Review → In Negotiation → Pending Approval → Approved → Executed → Expired → Terminated → Archived
- [ ] Lifecycle state transitions logged in audit trail
- [ ] Document version control — every upload and redline export creates a new version
- [ ] Version diff view — compare any two versions
- [ ] Business Unit faceted filter (blocked on intake Business Unit field)
- [ ] Archived contracts remain searchable but cannot be edited

---

## Module 8 — Signature Console

- [ ] DocuSign integration — envelope creation, signing, webhooks, void
- [ ] Adobe Sign integration — agreement creation, signing, real-time status
- [ ] Dropbox Sign integration — signature request, templates, event callbacks
- [ ] Signer list configuration (internal + counterparty signers, signing order)
- [ ] Signature envelope sent within 60 seconds of initiation
- [ ] Real-time signing status updates (viewed, signed, declined) logged in Contralyne
- [ ] Executed contract auto-stored in Repository; status updated to Executed
- [ ] Voided/declined envelopes return contract to Approved state with notification

---

## Module 9 — Obligation Tracker

- [ ] AI extraction of obligations from executed contracts (≥90% recall target) within 5 minutes of execution
- [ ] Renewal & Expiry tracking — auto-renewal trigger dates, expiry notice windows
- [ ] Notice Period tracking — advance notice requirements for termination, price changes, amendments
- [ ] Payment Milestone tracking — scheduled invoices, fee adjustments, penalty triggers
- [ ] SLA tracking — uptime commitments, response time requirements, penalties
- [ ] Deliverable tracking — reports, audits, certifications due by specific dates
- [ ] Regulatory obligation tracking — compliance reporting, data retention, certification renewal
- [ ] Alert configuration — 90/60/30 day lead times for renewals; 60/30/14 for expiry; 14/7 for payments and deliverables
- [ ] Alert delivery — zero missed notifications in test environment
- [ ] Manual obligation entry, edit, and snooze
- [ ] Mark obligation complete with supporting documentation upload

---

## Module 10 — Reports & Analytics

- [ ] Contract Risk Summary report — high-risk contract count, top risk categories, trend over time
- [ ] Playbook Deviation Report — deviation frequency by clause type, accepted vs. escalated
- [ ] Cycle Time Analysis — avg days intake to execution, by contract type and team
- [ ] Renewal Pipeline report — contracts expiring in 30/60/90/180 days, ARR at risk
- [ ] Approval Bottleneck Report — avg approval time by level, rejection rates, aging queue
- [ ] Supplier Risk Report — risk scores aggregated by counterparty
- [ ] Signature Status Report — envelopes sent, pending, completed, declined
- [ ] Custom Report Builder — drag-and-drop field selector across all contract metadata and AI-extracted fields
- [ ] Scheduled report delivery — daily/weekly/monthly via email
- [ ] Export formats — PDF, CSV, Excel
- [ ] All pre-built reports load within 5 seconds for up to 10,000 contracts
- [ ] Report data refreshed hourly

---

## RBAC — User Roles & Permissions

- [ ] Admin role — full CRUD on all modules, user management, platform configuration
- [ ] Legal Counsel role — review, redline, negotiate, approve; playbook read
- [ ] Legal Director role — all Legal Counsel permissions + playbook edit + final approval authority
- [ ] Procurement role — intake, approve (within value limits), repository view, obligation tracker
- [ ] Sales role — intake creation, signature console view, own contracts only
- [ ] Finance role — reports, obligation tracker, approval (financial threshold only)
- [ ] Executive role — read-only dashboard, reports, high-level approval
- [ ] External User role — counterparty portal access (view shared redlines, submit responses)
- [ ] Server-side permission enforcement on every API endpoint
- [ ] Front-end UI elements hidden/disabled based on role
- [ ] Multi-tenant isolation — tenant_id on all DB tables, enforced at query level

---

## External Integrations

- [ ] Email notifications — SendGrid or SMTP (approvals, signatures, intake confirmation, alerts)
- [ ] SSO / SAML 2.0 — enterprise identity federation, user provisioning
- [ ] SCIM 2.0 — automated user provisioning/deprovisioning from IdP
- [ ] Salesforce CRM — bidirectional sync of contract metadata with Opportunity records
- [ ] SAP / ERP — purchase order linkage, vendor master data sync

---

## Security & Compliance

- [ ] Column-level PII encryption — counterparty contact fields encrypted at column level
- [ ] Multi-tenant DB isolation — row-level tenant scoping on all tables (blocked on RBAC)
- [ ] Penetration testing — required before any enterprise launch; findings remediated per severity SLA
- [ ] SOC 2 Type II — target within 12 months of GA launch

---

## Already Done (V1 — Live at contralyne.com)

- [x] Contract upload (PDF/DOCX, 10MB, magic-byte validation)
- [x] Text extraction (pdf-parse + AWS Textract OCR fallback for scanned PDFs)
- [x] Legal intake form (counterparty, jurisdiction, deal value, urgency)
- [x] AI analysis — clause extraction, risk scoring, negotiation suggestions
- [x] Ambiguity detection in AI schema
- [x] Jurisdiction-aware prompts (US / UK / EU / India)
- [x] AI summarization (cached after first call)
- [x] Follow-up chat per contract (persistent, last 20 messages as context)
- [x] DOCX export with Word comments + tracked-change redlines
- [x] PDF export with two-column redlines layout
- [x] Contract list with search + filters (status, type, risk, date range)
- [x] Review rules CRUD (basic playbook — injected into AI prompt)
- [x] Clause library CRUD
- [x] Analytics endpoint (totals, risk breakdown, uploads per month)
- [x] Activity log / audit trail (paginated)
- [x] GDPR account deletion (hard-delete all user data + S3 files)
- [x] Rate limiting (upload 20/hr, analyze 30/hr, chat 20/min)
- [x] Clerk auth — email/password + Google OAuth
- [x] S3 file storage with pre-signed URLs
- [x] Supabase (PostgreSQL) database
- [x] Vercel deployment with SSL + custom domain (contralyne.com)
- [x] All legal agreements signed (2026-06-01)
- [x] Milestone 1 — ₹8,000 received
