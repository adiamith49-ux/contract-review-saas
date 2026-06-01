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
  user_id text NOT NULL,                          -- Clerk user ID
  filename text NOT NULL,
  s3_key text NOT NULL UNIQUE,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  contract_type text NOT NULL DEFAULT 'other',    -- see ContractType
  status text NOT NULL DEFAULT 'uploaded',        -- uploaded | processing | analyzed | failed
  extracted_text text,                            -- cached after extraction
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Analyses (AI review results)
CREATE TABLE IF NOT EXISTS analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES contracts(id) ON DELETE CASCADE,
  user_id text NOT NULL,                          -- Clerk user ID (for fast user-scoped queries)
  risk_level text NOT NULL,                       -- low | medium | high | critical
  risk_summary jsonb NOT NULL DEFAULT '[]',
  clause_analysis jsonb NOT NULL DEFAULT '[]',
  negotiation_points jsonb NOT NULL DEFAULT '[]',
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

-- Indexes for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_contracts_user_created ON contracts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_contract ON analyses(contract_id);
CREATE INDEX IF NOT EXISTS idx_chat_contract_created ON chat_messages(contract_id, created_at ASC);
