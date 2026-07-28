import { Router } from "express";
import { z } from "zod";
import { createClerkClient } from "@clerk/backend";
import { db } from "../db.js";
import { config } from "../config.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { cascadeDeleteOrganizationData } from "../services/organization.service.js";

const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY });

export const adminOrganizationsRouter = Router();
adminOrganizationsRouter.use(requireAdmin);

function requirePlatformOwner(): string {
  if (!config.PLATFORM_OWNER_CLERK_USER_ID) {
    throw Object.assign(
      new Error("PLATFORM_OWNER_CLERK_USER_ID is not configured — set it to the founder's Clerk user id before creating organizations."),
      { status: 500 },
    );
  }
  return config.PLATFORM_OWNER_CLERK_USER_ID;
}

// GET /superadmin/organizations — list every org + status + counts
adminOrganizationsRouter.get("/", async (_req, res, next) => {
  try {
    const { data: orgs, error } = await db
      .from("organizations")
      .select("id, clerk_org_id, name, status, onboarding_type, approved_at, suspended_at, deleted_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const orgIds = (orgs ?? []).map((o) => o.clerk_org_id);
    let contractCounts: Record<string, number> = {};
    if (orgIds.length > 0) {
      const { data: rows } = await db.from("contracts").select("org_id").in("org_id", orgIds);
      for (const r of rows ?? []) {
        if (r.org_id) contractCounts[r.org_id] = (contractCounts[r.org_id] ?? 0) + 1;
      }
    }

    res.json({
      organizations: (orgs ?? []).map((o) => ({ ...o, contract_count: contractCounts[o.clerk_org_id] ?? 0 })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /superadmin/organizations — sales-assisted creation: create the Clerk
// org + invite the firm's designated admin. Pre-vetted by the super admin, so
// it goes live immediately (no pending gate) — see organization.service pattern
// and the organization.created webhook handler for how status is decided.
adminOrganizationsRouter.post("/", async (req, res, next) => {
  try {
    const { name, admin_email } = z.object({
      name: z.string().min(1).max(200),
      admin_email: z.string().email(),
    }).parse(req.body);

    const ownerUserId = requirePlatformOwner();

    const org = await clerk.organizations.createOrganization({
      name,
      createdBy: ownerUserId,
      publicMetadata: { onboarding_type: "sales_assisted" },
    });

    // Upsert synchronously — same defensive pattern already used by
    // admin.ts's POST /users/add — so the dashboard is consistent even if
    // the organization.created webhook is delayed.
    await db.from("organizations").upsert(
      {
        clerk_org_id: org.id,
        name: org.name,
        status: "active",
        onboarding_type: "sales_assisted",
        approved_at: new Date().toISOString(),
        approved_by: req.adminEmail,
      },
      { onConflict: "clerk_org_id" },
    );

    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: org.id,
      inviterUserId: ownerUserId,
      emailAddress: admin_email,
      role: "org:admin",
    });

    res.status(201).json({
      organization: { clerk_org_id: org.id, name: org.name, status: "active" },
      invitation: { id: invitation.id, email: invitation.emailAddress, status: invitation.status },
    });
  } catch (err: any) {
    const clerkMsg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message;
    if (clerkMsg && typeof err?.status === "number" && err.status < 500) {
      res.status(err.status).json({ error: clerkMsg });
      return;
    }
    next(err);
  }
});

// POST /superadmin/organizations/:id/approve — self-serve pending → active
adminOrganizationsRouter.post("/:id/approve", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("organizations")
      .update({
        status: "active",
        approved_at: new Date().toISOString(),
        approved_by: req.adminEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .eq("status", "pending")
      .select("clerk_org_id, name")
      .single();

    if (error || !data) { res.status(404).json({ error: "Pending organization not found" }); return; }

    // Best-effort notification to whoever created the org — the org admin's
    // email isn't tracked separately from their Clerk membership, so this is
    // skipped when we can't resolve it rather than guessing.
    res.json({ ok: true, organization: data });
  } catch (err) {
    next(err);
  }
});

// POST /superadmin/organizations/:id/revoke — active → suspended (reversible,
// touches zero business data; enforcement is entirely requireActiveOrg +
// the frontend gate). Does not block the Clerk sign-in step itself.
adminOrganizationsRouter.post("/:id/revoke", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("organizations")
      .update({ status: "suspended", suspended_at: new Date().toISOString(), suspended_by: req.adminEmail, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("status", "active")
      .select("clerk_org_id, name")
      .single();

    if (error || !data) { res.status(404).json({ error: "Active organization not found" }); return; }
    res.json({ ok: true, organization: data });
  } catch (err) {
    next(err);
  }
});

// POST /superadmin/organizations/:id/restore — suspended → active only
adminOrganizationsRouter.post("/:id/restore", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("organizations")
      .update({ status: "active", suspended_at: null, suspended_by: null, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("status", "suspended")
      .select("clerk_org_id, name")
      .single();

    if (error || !data) { res.status(404).json({ error: "Suspended organization not found" }); return; }
    res.json({ ok: true, organization: data });
  } catch (err) {
    next(err);
  }
});

// DELETE /superadmin/organizations/:id — permanent. Deletes every org-scoped DB
// row + S3 objects, deletes the Clerk organization itself, and marks (not
// removes) the organizations row so a minimal "this firm existed and was
// deleted" record survives for billing/dispute purposes.
adminOrganizationsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { data: org, error } = await db
      .from("organizations")
      .select("clerk_org_id, name, status")
      .eq("id", req.params.id)
      .single();

    if (error || !org) { res.status(404).json({ error: "Organization not found" }); return; }
    if (org.status === "deleted") { res.status(409).json({ error: "Organization already deleted" }); return; }

    await cascadeDeleteOrganizationData(org.clerk_org_id);

    try {
      await clerk.organizations.deleteOrganization(org.clerk_org_id);
    } catch (err: any) {
      if (err?.status !== 404) throw err; // already gone in Clerk — fine, DB cleanup already ran
    }

    await db.from("organizations")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("id", req.params.id);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
