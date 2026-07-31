import type { NextFunction, Request, Response } from "express";
import { db } from "../db.js";

// Must run after requireAuth (needs req.orgId). Single enforcement point for
// both the self-serve "pending approval" gate and the revoke/suspend gate —
// everything else just flips organizations.status and this middleware reacts.
export async function requireActiveOrg(req: Request, res: Response, next: NextFunction) {
  if (!req.orgId) {
    res.status(403).json({ error: "no_active_organization" });
    return;
  }

  const { data: org, error } = await db
    .from("organizations")
    .select("status")
    .eq("clerk_org_id", req.orgId)
    .maybeSingle();

  // Distinguish "the lookup failed" from "the org isn't active". Dropping the
  // error made an unreachable database, a missing `organizations` table, or an
  // un-run migration all present as a 403 telling the user their organization
  // was suspended — an infrastructure outage wearing a permissions error's
  // clothes, which is the hardest kind to diagnose. A failed lookup is a 503:
  // not the caller's fault, and retryable.
  if (error) {
    console.error(`requireActiveOrg: org lookup failed for ${req.orgId}: ${error.message} (code=${error.code ?? "none"})`);
    res.status(503).json({
      error: "Couldn't verify your organization right now. Please try again in a moment.",
      code: "organization_lookup_failed",
    });
    return;
  }

  if (!org) {
    // Authenticated against a Clerk org with no mirror row. Usually means the
    // org_id backfill (scripts/migrate-org1.ts) hasn't run for this org yet.
    console.warn(`requireActiveOrg: no organizations row for clerk_org_id ${req.orgId}`);
    res.status(403).json({
      error: "Your organization isn't set up yet. Please contact your administrator.",
      code: "organization_not_provisioned",
    });
    return;
  }

  if (org.status !== "active") {
    res.status(403).json({
      error: "Your organization's access is not active. Please contact your administrator.",
      code: "organization_not_active",
      status: org.status,
    });
    return;
  }

  next();
}

// Must run after requireAuth. Gates org-admin-only mutations (invite/remove
// employees is handled by Clerk's own OrganizationProfile UI — this covers
// our own product endpoints: clients, clause library, playbooks, tasks, billing).
export function requireOrgAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.orgRole !== "org:admin") {
    res.status(403).json({ error: "organization_admin_required" });
    return;
  }
  next();
}
