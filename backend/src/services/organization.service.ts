import { db } from "../db.js";
import { deleteFromS3 } from "./storage.service.js";

// Every org-scoped business table. Kept as a single source of truth — used by
// both the organization.deleted webhook (safety net for out-of-band deletes)
// and POST /admin/organizations/:id/delete (the primary path) so the list
// can never drift out of sync between the two callers.
const ORG_SCOPED_TABLES = [
  "legal_intake", "analyses", "chat_messages", "clause_library", "review_rules",
  "redlines", "contract_comments", "tasks", "approval_rules", "contract_approvals",
  "contract_comparisons", "time_entries", "activity_logs", "client_memberships",
  "signature_requests", "clients", "tickets", "calendar_events", "contract_obligations",
] as const;

/**
 * Permanently deletes every row belonging to an organization, across every
 * org-scoped table, plus the S3 objects for its contracts. Idempotent — safe
 * to call twice (e.g. once from the admin endpoint, once from the webhook
 * safety net) since deleting already-deleted rows is a no-op.
 */
export async function cascadeDeleteOrganizationData(clerkOrgId: string): Promise<void> {
  const { data: contracts } = await db
    .from("contracts")
    .select("s3_key")
    .eq("org_id", clerkOrgId);

  if (contracts && contracts.length > 0) {
    await Promise.allSettled(contracts.map((c) => deleteFromS3(c.s3_key)));
  }

  await db.from("contracts").delete().eq("org_id", clerkOrgId);
  await Promise.all(ORG_SCOPED_TABLES.map((table) => db.from(table).delete().eq("org_id", clerkOrgId)));
}
