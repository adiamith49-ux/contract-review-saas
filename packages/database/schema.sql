-- Contralyn Database Schema
-- Run this in Supabase SQL Editor to initialize the database

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

-- Clause library (user's saved approved/fallback clauses)
CREATE TABLE IF NOT EXISTS clause_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  clause_type text NOT NULL,                      -- liability | payment | ip | termination | nda | other
  content text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

-- Redline placements (cached matching results computed after analysis)
CREATE TABLE IF NOT EXISTS redlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES contracts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  placed_count integer NOT NULL DEFAULT 0,   -- negotiation points matched to a paragraph
  total_count integer NOT NULL DEFAULT 0,    -- total negotiation points in the analysis
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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
