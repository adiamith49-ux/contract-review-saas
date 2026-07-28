// One-off migration: create "org #1" for the existing pre-multi-tenancy data
// and backfill org_id across every business table. See Phase 7 of the
// multi-tenancy plan and the matching comment block at the bottom of
// packages/database/schema.sql, which this script implements as code.
//
// SAFETY:
//  - Never run this against production without first reading it end to end.
//  - Requires the nullable org_id columns to already exist (run schema.sql's
//    "Multi-tenancy: org_id" section in the Supabase SQL editor FIRST).
//  - Does NOT run the `ALTER COLUMN org_id SET NOT NULL` tightening step —
//    that's a separate, manual step in schema.sql, run only after a human
//    has verified the row counts this script prints.
//  - Idempotent-ish: re-running is safe for the backfill step (WHERE org_id
//    IS NULL guards it), but re-running the Clerk org-creation step will
//    create a SECOND Clerk organization if ORG1_CLERK_ID isn't set on the
//    second run — always pass ORG1_CLERK_ID after the first successful run.
//
// Usage (from backend/):
//   npx tsx scripts/migrate-org1.ts --name "Amith & Co" --admin-email amith@example.com
// or, if the Clerk org already exists (e.g. created manually in the Dashboard):
//   npx tsx scripts/migrate-org1.ts --org-id org_xxxxx --name "Amith & Co"

import "dotenv/config";
import { createClerkClient } from "@clerk/backend";
import { db } from "../src/db.js";
import { config } from "../src/config.js";

const ORG_SCOPED_TABLES = [
  "users", "clients", "contracts", "legal_intake", "analyses", "chat_messages",
  "clause_library", "review_rules", "redlines", "contract_comments", "tasks",
  "approval_rules", "contract_approvals", "contract_comparisons", "time_entries",
  "activity_logs", "client_memberships", "signature_requests", "tickets",
  "calendar_events",
] as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const name = arg("name");
  const existingOrgId = arg("org-id");
  const adminEmail = arg("admin-email");

  if (!name) {
    console.error("Usage: npx tsx scripts/migrate-org1.ts --name \"Firm Name\" [--org-id org_xxx] [--admin-email you@firm.com]");
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY });

  // ─── Step 1: resolve org #1's Clerk id ───────────────────────────────────
  let clerkOrgId = existingOrgId;
  if (!clerkOrgId) {
    if (!config.PLATFORM_OWNER_CLERK_USER_ID) {
      console.error("Set PLATFORM_OWNER_CLERK_USER_ID (your own Clerk user id) before creating a new org, or pass --org-id for an org that already exists.");
      process.exit(1);
    }
    const org = await clerk.organizations.createOrganization({
      name,
      createdBy: config.PLATFORM_OWNER_CLERK_USER_ID,
      publicMetadata: { onboarding_type: "sales_assisted" },
    });
    clerkOrgId = org.id;
    console.log(`Created Clerk organization ${clerkOrgId} ("${name}")`);
  }

  // ─── Step 2: insert/confirm the organizations mirror row, active ────────
  await db.from("organizations").upsert(
    {
      clerk_org_id: clerkOrgId,
      name,
      status: "active",
      onboarding_type: "sales_assisted",
      approved_at: new Date().toISOString(),
      approved_by: "migration:migrate-org1",
    },
    { onConflict: "clerk_org_id" },
  );
  console.log(`organizations row ready for ${clerkOrgId}`);

  // ─── Step 3: add every existing Clerk user as a member ───────────────────
  const { data: users } = await db.from("users").select("clerk_user_id, email");
  for (const u of users ?? []) {
    try {
      const role = adminEmail && u.email.toLowerCase() === adminEmail.toLowerCase() ? "org:admin" : "org:member";
      await clerk.organizations.createOrganizationMembership({
        organizationId: clerkOrgId,
        userId: u.clerk_user_id,
        role,
      });
      console.log(`  added ${u.email} as ${role}`);
    } catch (err: any) {
      // Already a member (e.g. re-run, or they were createdBy) — non-fatal
      console.warn(`  skip ${u.email}: ${err?.errors?.[0]?.message ?? err?.message ?? err}`);
    }
  }

  // ─── Step 4: backfill org_id on every business table ─────────────────────
  for (const table of ORG_SCOPED_TABLES) {
    const before = await db.from(table).select("id", { count: "exact", head: true }).is("org_id", null);
    const { error } = await db.from(table).update({ org_id: clerkOrgId }).is("org_id", null);
    if (error) {
      console.error(`  ${table}: FAILED — ${error.message}`);
      continue;
    }
    console.log(`  ${table}: backfilled ${before.count ?? 0} row(s)`);
  }

  console.log("\nDone. Next steps (manual, after verifying row counts above):");
  console.log("  1. Spot-check a handful of contracts/clients/clauses for this org in Supabase.");
  console.log("  2. Run the commented \"ALTER COLUMN org_id SET NOT NULL\" block in schema.sql.");
  console.log("  3. Only then deploy the org-aware backend code.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
