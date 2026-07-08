-- Contralyn Database Schema
-- Run this in Supabase SQL Editor to initialize the database

-- Clients (grouping layer for contracts — each user has their own clients)
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  industry text,
  notes text,
  status text NOT NULL DEFAULT 'active',           -- active | inactive
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id, created_at DESC);

-- Users (mirrors Clerk user data; clerk_user_id is the primary identity)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Contracts (uploaded files)
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  filename text NOT NULL,
  s3_key text NOT NULL UNIQUE,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  contract_type text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'uploaded',        -- uploaded | processing | analyzed | failed
  extracted_text text,
  summary text,                                   -- AI-generated plain-English summary
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Legal intake (context captured before/during upload)
CREATE TABLE IF NOT EXISTS legal_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES contracts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  counterparty_name text,
  department text,
  urgency text DEFAULT 'medium',                  -- low | medium | high | critical
  deal_value numeric,
  jurisdiction text DEFAULT 'us',                 -- us | uk | eu | india | other
  renewal_date date,
  business_owner text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Analyses (AI review results)
CREATE TABLE IF NOT EXISTS analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES contracts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  risk_level text NOT NULL,                       -- low | medium | high | critical
  risk_summary jsonb NOT NULL DEFAULT '[]',
  clause_analysis jsonb NOT NULL DEFAULT '[]',
  negotiation_points jsonb NOT NULL DEFAULT '[]',
  ambiguity_flags jsonb NOT NULL DEFAULT '[]',
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chat messages (follow-up Q&A per contract)
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Clause library (approved/fallback/walk-away language — institutional legal memory)
CREATE TABLE IF NOT EXISTS clause_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  clause_type text NOT NULL,                      -- approved (preferred) | fallback | unacceptable (walk-away)
  content text NOT NULL,
  notes text,                                     -- JSON: { tags: [], jurisdiction }
  contract_types jsonb NOT NULL DEFAULT '[]',     -- which contract types this clause applies to (nda, msa, …)
  status text NOT NULL DEFAULT 'approved',        -- draft | approved — only approved clauses reach AI review
  source text,                                    -- provenance, e.g. "MSA Playbook v3" or "Acme deal 2025"
  version int NOT NULL DEFAULT 1,                 -- bumped on every content edit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Executable migration for pre-existing clause_library tables (idempotent):
ALTER TABLE clause_library ADD COLUMN IF NOT EXISTS contract_types jsonb NOT NULL DEFAULT '[]';
ALTER TABLE clause_library ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE clause_library ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE clause_library ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

-- Review rules / Playbooks — uploaded DOCX/PDF playbook documents injected into AI analysis
CREATE TABLE IF NOT EXISTS review_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  rules jsonb NOT NULL DEFAULT '[]',              -- kept for backward compat; new rows use playbook_text
  playbook_text text,                             -- extracted full text from uploaded playbook document
  original_filename text,                         -- original uploaded filename (e.g. "MSA_Playbook_v3.docx")
  file_size bigint,                               -- file size in bytes
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Migration (run if table already exists):
-- ALTER TABLE review_rules ADD COLUMN IF NOT EXISTS playbook_text text;
-- ALTER TABLE review_rules ADD COLUMN IF NOT EXISTS original_filename text;
-- ALTER TABLE review_rules ADD COLUMN IF NOT EXISTS file_size bigint;
-- ALTER TABLE analyses ADD COLUMN IF NOT EXISTS playbooks_used jsonb NOT NULL DEFAULT '[]';  -- applied 2026-07-04

-- Redlines (AI-generated clause-level track changes per contract)
-- Each POST /redline creates a new row; GET /redline returns the latest.
CREATE TABLE IF NOT EXISTS redlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  edits jsonb NOT NULL DEFAULT '[]',         -- array of ProcessedEdit objects (matched + unmatched)
  matched_count int NOT NULL DEFAULT 0,
  unmatched_count int NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_redlines_contract ON redlines (contract_id, user_id, created_at DESC);

-- Migration (run if redlines table already exists from an older schema):
-- ALTER TABLE redlines DROP CONSTRAINT IF EXISTS redlines_contract_id_key;
-- ALTER TABLE redlines ADD COLUMN IF NOT EXISTS edits jsonb NOT NULL DEFAULT '[]';
-- ALTER TABLE redlines ADD COLUMN IF NOT EXISTS matched_count int NOT NULL DEFAULT 0;
-- ALTER TABLE redlines ADD COLUMN IF NOT EXISTS unmatched_count int NOT NULL DEFAULT 0;
-- ALTER TABLE redlines ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT '';
-- ALTER TABLE redlines DROP COLUMN IF EXISTS placed_count;
-- ALTER TABLE redlines DROP COLUMN IF EXISTS total_count;
-- ALTER TABLE redlines DROP COLUMN IF EXISTS updated_at;

-- Contract comments (matter collaboration — internal notes + @mentions)
CREATE TABLE IF NOT EXISTS contract_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  author_name text NOT NULL DEFAULT 'Team member',
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal',    -- internal | shared (counterparty-visible)
  mentions jsonb NOT NULL DEFAULT '[]',           -- ["Finance Director", ...] parsed from @mentions
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_comments ON contract_comments(contract_id, created_at DESC);

-- Tasks (personal + matter-linked to-dos; assignee is a display name, not a login)
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',        -- low | medium | high
  due_date date,
  done boolean NOT NULL DEFAULT false,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  assignee text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Executable migration for pre-existing tasks tables (idempotent):
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_tasks_contract ON tasks(contract_id);

-- Approval matrix rules (who must approve, and when they are triggered)
CREATE TABLE IF NOT EXISTS approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,                             -- e.g. "Finance sign-off over $100k"
  approver_name text NOT NULL,
  approver_email text,
  step_order int NOT NULL DEFAULT 1,              -- chain position (1 = first approver)
  min_value numeric,                              -- trigger: contract/deal value >= min_value
  risk_levels jsonb NOT NULL DEFAULT '[]',        -- trigger: analysis risk in list, e.g. ["high","critical"]
  departments jsonb NOT NULL DEFAULT '[]',        -- trigger: intake department in list
  jurisdictions jsonb NOT NULL DEFAULT '[]',      -- trigger: intake jurisdiction in list
  contract_types jsonb NOT NULL DEFAULT '[]',     -- trigger: contract_type in list
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approval_rules_user ON approval_rules(user_id, is_active, step_order);

-- Contract approval steps (one row per approver per submission round)
CREATE TABLE IF NOT EXISTS contract_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  round int NOT NULL DEFAULT 1,                   -- resubmissions start a new round
  step_order int NOT NULL,
  approver_name text NOT NULL,
  approver_email text,
  rule_name text,                                 -- matrix rule that triggered this step
  matched_reason text,                            -- e.g. "value ≥ $100,000; risk high"
  status text NOT NULL DEFAULT 'pending',         -- pending | approved | rejected | changes_requested | skipped
  comment text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_approvals ON contract_approvals(contract_id, round DESC, step_order);

-- Activity logs (audit trail for all key actions)
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  action text NOT NULL,                           -- contract.uploaded | contract.analyzed | contract.exported | etc.
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_user_created    ON contracts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_status          ON contracts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_type            ON contracts(user_id, contract_type);
CREATE INDEX IF NOT EXISTS idx_analyses_user_created     ON analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_contract         ON analyses(contract_id);
CREATE INDEX IF NOT EXISTS idx_analyses_risk             ON analyses(user_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_chat_contract_created     ON chat_messages(contract_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_clause_library_user       ON clause_library(user_id, clause_type);
CREATE INDEX IF NOT EXISTS idx_review_rules_user         ON review_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user        ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_contract    ON activity_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client          ON contracts(client_id);

-- ─── Migration: admin + RBAC (run in Supabase SQL editor) ────────────────────
-- Run after the base schema if tables already exist.

-- 1. Admin auth
-- CREATE TABLE IF NOT EXISTS admins (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   email text NOT NULL UNIQUE,
--   name text NOT NULL,
--   password_hash text NOT NULL,
--   created_at timestamptz NOT NULL DEFAULT now()
-- );

-- 1b. Admin password reset (2026-07-07) — required for POST /admin/auth/forgot-password
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS reset_code_hash text;
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS reset_code_expires_at timestamptz;

-- 2. User-to-client many-to-many
-- CREATE TABLE IF NOT EXISTS client_memberships (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id text NOT NULL,
--   client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
--   assigned_by text,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   UNIQUE(user_id, client_id)
-- );
-- CREATE INDEX IF NOT EXISTS idx_memberships_user   ON client_memberships(user_id);
-- CREATE INDEX IF NOT EXISTS idx_memberships_client ON client_memberships(client_id);

-- 3. Change request tickets
-- CREATE TABLE IF NOT EXISTS tickets (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id text NOT NULL,
--   type text NOT NULL,
--   reference_id uuid,
--   reference_name text,
--   description text NOT NULL,
--   status text NOT NULL DEFAULT 'open',
--   admin_notes text,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now()
-- );
-- CREATE INDEX IF NOT EXISTS idx_tickets_user   ON tickets(user_id, created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, created_at DESC);

-- 4. Make clients.user_id nullable (clients are now admin-managed)
-- ALTER TABLE clients ALTER COLUMN user_id DROP NOT NULL;

-- 5. Mark existing clauses/rules as admin-managed
-- ALTER TABLE clause_library  ADD COLUMN IF NOT EXISTS is_admin_managed boolean NOT NULL DEFAULT false;
-- ALTER TABLE review_rules     ADD COLUMN IF NOT EXISTS is_admin_managed boolean NOT NULL DEFAULT false;
-- UPDATE clause_library SET is_admin_managed = true;
-- UPDATE review_rules   SET is_admin_managed = true;

-- 6. Create clients base table (if starting fresh)
-- CREATE TABLE IF NOT EXISTS clients (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id text,  -- nullable: admin-created clients have no user_id
--   name text NOT NULL,
--   industry text,
--   notes text,
--   status text NOT NULL DEFAULT 'active',
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now()
-- );
-- ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
-- CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);

-- ─── Migration: contract metadata + version history (run in Supabase SQL editor) ─
-- Adds rich metadata to each contract record so every upload becomes a full CLM record.

-- 7. Contract metadata fields
-- ALTER TABLE contracts ADD COLUMN IF NOT EXISTS title text;
-- ALTER TABLE contracts ADD COLUMN IF NOT EXISTS counterparty text;
-- ALTER TABLE contracts ADD COLUMN IF NOT EXISTS start_date date;
-- ALTER TABLE contracts ADD COLUMN IF NOT EXISTS end_date date;
-- ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_date date;
-- ALTER TABLE contracts ADD COLUMN IF NOT EXISTS owner_name text;
-- ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_value numeric;
-- ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_status text NOT NULL DEFAULT 'draft';
-- -- contract_status values: draft | under_review | executed | expired | on_hold | terminated

-- 8. Version history (upload negotiation rounds under the same record)
-- ALTER TABLE contracts ADD COLUMN IF NOT EXISTS version_number int NOT NULL DEFAULT 1;
-- ALTER TABLE contracts ADD COLUMN IF NOT EXISTS parent_contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL;

-- 9. Indexes for metadata lookups
-- CREATE INDEX IF NOT EXISTS idx_contracts_parent ON contracts(parent_contract_id);
-- CREATE INDEX IF NOT EXISTS idx_contracts_counterparty ON contracts(client_id, counterparty);
-- CREATE INDEX IF NOT EXISTS idx_contracts_dates ON contracts(client_id, end_date, renewal_date);
