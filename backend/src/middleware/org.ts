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

  const { data: org } = await db
    .from("organizations")
    .select("status")
    .eq("clerk_org_id", req.orgId)
    .maybeSingle();

  if (!org || org.status !== "active") {
    res.status(403).json({ error: "organization_not_active", status: org?.status ?? "unknown" });
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
