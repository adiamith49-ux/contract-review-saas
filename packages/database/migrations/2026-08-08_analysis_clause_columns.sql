-- Analysis clause columns — 2026-08-08
--
-- `extracted_clauses` and `missing_clauses` are declared in the frontend types
-- and rendered by ReviewPanel, but no column has ever existed and nothing has
-- ever written them, so both panels are permanently empty. Adding the columns
-- is step 1 of 2; step 2 is declaring the matching fields in the analyze tool
-- schema in ai.service.ts, without which these stay empty.
--
-- `contract_metadata` is deliberately NOT added: the same facts already live on
-- the contracts row (extractContractMeta writes them on upload), and the panel
-- now reads those instead. Adding a third copy would just be another thing to
-- keep in sync.
--
-- APPLIED to production 2026-08-08 via the Supabase Management API
-- (project qdjdoxwebuwpnggifeku). Both columns verified present, jsonb,
-- defaulting to '[]'. Safe to re-run.

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS extracted_clauses jsonb NOT NULL DEFAULT '[]';
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS missing_clauses   jsonb NOT NULL DEFAULT '[]';

-- Verify:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'analyses' ORDER BY column_name;
