import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { createClerkClient } from "@clerk/backend";
import { db } from "../db.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveOrg, requireOrgAdmin } from "../middleware/org.js";
import { extractText } from "../services/document.service.js";
import { deleteFromS3, uploadToS3 } from "../services/storage.service.js";
import { isMailerConfigured, sendMail, wrapEmail, emailParagraphs, emailInfoBox, emailNoteBox, emailButton, escapeHtml as escapeAmp } from "../services/mailer.service.js";
import { buildBillingReport, buildDashboardReport, buildContractsReport } from "../services/report.service.js";

const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

export const orgRouter = Router();
// Deliberately NOT requireActiveOrg at the router level — /me is the one
// endpoint that must keep working for a caller with no org, or a pending/
// suspended one, so the frontend gate pages can find out *why* they're
// blocked instead of getting the same opaque 403 as every other route.
orgRouter.use(requireAuth);

// GET /api/org/me — used by every gate/guard on the frontend. Always 200s
// for any authenticated caller; the frontend branches on `status`.
orgRouter.get("/me", async (req, res, next) => {
  try {
    if (!req.orgId) {
      res.json({ name: null, status: "no_organization", role: null });
      return;
    }

    const { data, error } = await db
      .from("organizations")
      .select("name, status")
      .eq("clerk_org_id", req.orgId)
      .maybeSingle();

    if (error || !data) {
      // Org exists in Clerk but our webhook hasn't synced it yet (race on a
      // freshly created org) — report pending rather than a confusing 404.
      res.json({ name: null, status: "pending", role: req.orgRole });
      return;
    }

    res.json({ name: data.name, status: data.status, role: req.orgRole });
  } catch (err) {
    next(err);
  }
});

// Every route below DOES require an active org.
orgRouter.use(requireActiveOrg);

// ─── Clients (org-admin management view — day-to-day access for members is
// still GET /api/clients, scoped by client_memberships) ───────────────────────

orgRouter.get("/clients", requireOrgAdmin, async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("clients")
      .select("id, name, industry, notes, status, created_at, updated_at")
      .eq("org_id", req.orgId!)
      .order("name");
    if (error) throw error;

    const ids = (data ?? []).map((c: any) => c.id);
    let memberCounts: Record<string, number> = {};
    let contractCounts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: memRows } = await db.from("client_memberships").select("client_id").eq("org_id", req.orgId!).in("client_id", ids);
      for (const r of memRows ?? []) memberCounts[r.client_id] = (memberCounts[r.client_id] ?? 0) + 1;

      const { data: ctRows } = await db.from("contracts").select("client_id").eq("org_id", req.orgId!).in("client_id", ids);
      for (const r of ctRows ?? []) if (r.client_id) contractCounts[r.client_id] = (contractCounts[r.client_id] ?? 0) + 1;
    }

    res.json({
      clients: (data ?? []).map((c: any) => ({ ...c, member_count: memberCounts[c.id] ?? 0, contract_count: contractCounts[c.id] ?? 0 })),
    });
  } catch (err) {
    next(err);
  }
});

orgRouter.post("/clients", requireOrgAdmin, async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(200),
      industry: z.string().max(100).optional(),
      notes: z.string().max(2000).optional(),
    }).parse(req.body);

    const { data, error } = await db
      .from("clients")
      .insert({ ...body, user_id: req.userId, org_id: req.orgId })
      .select("id, name, industry, notes, status, created_at, updated_at")
      .single();
    if (error) throw error;
    res.status(201).json({ client: { ...(data as any), member_count: 0, contract_count: 0 } });
  } catch (err) {
    next(err);
  }
});

orgRouter.patch("/clients/:id", requireOrgAdmin, async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(200).optional(),
      industry: z.string().max(100).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      status: z.enum(["active", "inactive"]).optional(),
    }).parse(req.body);

    const { data, error } = await db
      .from("clients")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("org_id", req.orgId!)
      .select("id, name, industry, notes, status, created_at, updated_at")
      .single();
    if (error || !data) { res.status(404).json({ error: "Client not found" }); return; }
    res.json({ client: data });
  } catch (err) {
    next(err);
  }
});

orgRouter.delete("/clients/:id", requireOrgAdmin, async (req, res, next) => {
  try {
    const { error } = await db.from("clients").delete().eq("id", req.params.id).eq("org_id", req.orgId!);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Assign / remove a member from a client (client_memberships)
orgRouter.post("/clients/:id/members", requireOrgAdmin, async (req, res, next) => {
  try {
    const { user_id } = z.object({ user_id: z.string().min(1) }).parse(req.body);
    const { data, error } = await db
      .from("client_memberships")
      .insert({ user_id, client_id: req.params.id, org_id: req.orgId, assigned_by: req.userId })
      .select()
      .single();
    if (error) {
      if ((error as any).code === "23505") { res.status(409).json({ error: "User already assigned to this client" }); return; }
      throw error;
    }
    res.status(201).json({ membership: data });
  } catch (err) {
    next(err);
  }
});

orgRouter.delete("/clients/:id/members/:userId", requireOrgAdmin, async (req, res, next) => {
  try {
    const { error } = await db
      .from("client_memberships")
      .delete()
      .eq("client_id", req.params.id)
      .eq("user_id", req.params.userId)
      .eq("org_id", req.orgId!);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Clause library (org-isolated — no cross-org sharing) ────────────────────

function encodeNotes(tags: string[], jurisdiction: string | null | undefined): string {
  return JSON.stringify({ tags, jurisdiction: jurisdiction ?? null });
}
function decodeNotes(notes: string | null | undefined): { tags: string[]; jurisdiction: string | null } {
  if (!notes) return { tags: [], jurisdiction: null };
  try {
    const p = JSON.parse(notes);
    if (Array.isArray(p)) return { tags: p, jurisdiction: null };
    if (typeof p === "object" && p !== null) {
      return { tags: Array.isArray(p.tags) ? p.tags : [], jurisdiction: typeof p.jurisdiction === "string" ? p.jurisdiction : null };
    }
  } catch { /* empty */ }
  return { tags: [], jurisdiction: null };
}
function formatClause(row: any) {
  const { tags, jurisdiction } = decodeNotes(row.notes);
  return { ...row, tags, jurisdiction, notes: undefined };
}

const clauseSchema = z.object({
  title: z.string().min(1).max(200),
  clause_type: z.enum(["approved", "fallback", "unacceptable"]),
  content: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  jurisdiction: z.string().nullable().optional(),
  contract_types: z.array(z.string()).optional().default([]),
  status: z.enum(["draft", "approved"]).optional().default("approved"),
  source: z.string().max(500).nullable().optional(),
});

orgRouter.get("/clauses", requireOrgAdmin, async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("clause_library")
      .select("id, title, clause_type, content, notes, contract_types, status, source, version, is_admin_managed, created_at, updated_at")
      .eq("is_admin_managed", true)
      .eq("org_id", req.orgId!)
      .order("clause_type")
      .order("title");
    if (error) throw error;
    res.json({ clauses: (data ?? []).map(formatClause) });
  } catch (err) {
    next(err);
  }
});

orgRouter.post("/clauses", requireOrgAdmin, async (req, res, next) => {
  try {
    const body = clauseSchema.parse(req.body);
    const { tags, jurisdiction, ...rest } = body;
    const { data, error } = await db
      .from("clause_library")
      .insert({ ...rest, notes: encodeNotes(tags ?? [], jurisdiction), user_id: req.userId, org_id: req.orgId, is_admin_managed: true })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ clause: formatClause(data) });
  } catch (err) {
    next(err);
  }
});

orgRouter.patch("/clauses/:id", requireOrgAdmin, async (req, res, next) => {
  try {
    const body = clauseSchema.partial().parse(req.body);
    const { tags, jurisdiction, ...rest } = body;

    const notesUpdate: { notes?: string } = {};
    let versionUpdate: { version?: number } = {};
    if (tags !== undefined || jurisdiction !== undefined || body.content !== undefined) {
      const { data: existing } = await db
        .from("clause_library")
        .select("notes, content, version")
        .eq("id", req.params.id)
        .eq("org_id", req.orgId!)
        .eq("is_admin_managed", true)
        .single();
      if (tags !== undefined || jurisdiction !== undefined) {
        const cur = decodeNotes((existing as any)?.notes);
        notesUpdate.notes = encodeNotes(tags !== undefined ? tags : cur.tags, jurisdiction !== undefined ? jurisdiction : cur.jurisdiction);
      }
      if (body.content !== undefined && existing && body.content !== (existing as any).content) {
        versionUpdate = { version: (((existing as any).version as number) ?? 1) + 1 };
      }
    }

    const { data, error } = await db
      .from("clause_library")
      .update({ ...rest, ...notesUpdate, ...versionUpdate, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("org_id", req.orgId!)
      .eq("is_admin_managed", true)
      .select()
      .single();
    if (error || !data) { res.status(404).json({ error: "Clause not found" }); return; }
    res.json({ clause: formatClause(data) });
  } catch (err) {
    next(err);
  }
});

orgRouter.delete("/clauses/:id", requireOrgAdmin, async (req, res, next) => {
  try {
    const { error } = await db.from("clause_library").delete().eq("id", req.params.id).eq("org_id", req.orgId!).eq("is_admin_managed", true);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Playbooks (org-isolated) ──────────────────────────────────────────────────

orgRouter.get("/playbooks", requireOrgAdmin, async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("review_rules")
      .select("id, title, description, is_active, original_filename, file_size, jurisdiction, is_admin_managed, created_at")
      .eq("is_admin_managed", true)
      .eq("org_id", req.orgId!)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ rules: (data ?? []).map((r: any) => ({ ...r, name: r.title })) });
  } catch (err) {
    next(err);
  }
});

orgRouter.post("/playbooks", requireOrgAdmin, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ error: "A PDF or DOCX playbook file is required" }); return; }
    const name = (req.body.name as string | undefined)?.trim();
    if (!name) { res.status(400).json({ error: "Playbook name is required" }); return; }

    const VALID_JURISDICTIONS = ["us", "uk", "eu", "india"];
    const rawJurisdiction = (req.body.jurisdiction as string | undefined)?.trim().toLowerCase();
    const jurisdiction = rawJurisdiction && VALID_JURISDICTIONS.includes(rawJurisdiction) ? rawJurisdiction : null;

    let playbookText = "";
    try {
      playbookText = await extractText(req.file.buffer, req.file.mimetype);
    } catch { /* empty */ }
    if (!playbookText.trim()) { res.status(422).json({ error: "Could not extract text from this document." }); return; }

    const { data, error } = await db
      .from("review_rules")
      .insert({
        user_id: req.userId,
        org_id: req.orgId,
        title: name,
        description: (req.body.description as string | undefined)?.trim() || null,
        is_active: req.body.is_active !== "false",
        playbook_text: playbookText,
        original_filename: req.file.originalname,
        file_size: req.file.size,
        jurisdiction,
        rules: [],
        is_admin_managed: true,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ rule: { ...(data as any), name: (data as any).title } });
  } catch (err) {
    next(err);
  }
});

orgRouter.patch("/playbooks/:id", requireOrgAdmin, async (req, res, next) => {
  try {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (req.body.name !== undefined) updates.title = String(req.body.name).trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description).trim() || null;
    if (req.body.is_active !== undefined) updates.is_active = Boolean(req.body.is_active);
    if (req.body.jurisdiction !== undefined) {
      const j = String(req.body.jurisdiction).trim().toLowerCase();
      updates.jurisdiction = ["us", "uk", "eu", "india"].includes(j) ? j : null;
    }

    const { data, error } = await db
      .from("review_rules")
      .update(updates)
      .eq("id", req.params.id)
      .eq("org_id", req.orgId!)
      .eq("is_admin_managed", true)
      .select()
      .single();
    if (error || !data) { res.status(404).json({ error: "Playbook not found" }); return; }
    res.json({ rule: { ...(data as any), name: (data as any).title } });
  } catch (err) {
    next(err);
  }
});

orgRouter.delete("/playbooks/:id", requireOrgAdmin, async (req, res, next) => {
  try {
    const { error } = await db.from("review_rules").delete().eq("id", req.params.id).eq("org_id", req.orgId!).eq("is_admin_managed", true);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Tasks (org admin assigns work to org members) ────────────────────────────

orgRouter.get("/tasks", requireOrgAdmin, async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("tasks")
      .select("*")
      .eq("org_id", req.orgId!)
      .eq("assignee", "Admin")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ tasks: data ?? [] });
  } catch (err) {
    next(err);
  }
});

orgRouter.post("/tasks", requireOrgAdmin, async (req, res, next) => {
  try {
    const body = z.object({
      user_id: z.string().min(1),
      title: z.string().min(1).max(500),
      notes: z.string().max(2000).optional().default(""),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
    }).parse(req.body);

    const { data: task, error } = await db
      .from("tasks")
      .insert({
        user_id: body.user_id,
        org_id: req.orgId,
        title: body.title,
        notes: body.notes,
        priority: body.priority,
        due_date: body.due_date || null,
        assignee: "Admin",
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

orgRouter.delete("/tasks/:id", requireOrgAdmin, async (req, res, next) => {
  try {
    const { error } = await db.from("tasks").delete().eq("id", req.params.id).eq("org_id", req.orgId!).eq("assignee", "Admin");
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Billing (org's own billable-work totals + Excel export) ──────────────────

orgRouter.get("/billing", requireOrgAdmin, async (req, res, next) => {
  try {
    const [entriesRes, usersRes] = await Promise.all([
      db.from("time_entries").select("user_id, duration_mins, date").eq("org_id", req.orgId!).eq("billable", true),
      db.from("users").select("clerk_user_id, email").eq("org_id", req.orgId!),
    ]);
    if (entriesRes.error) throw entriesRes.error;
    const entries = entriesRes.data ?? [];
    const emailByUser = new Map((usersRes.data ?? []).map((u) => [u.clerk_user_id as string, u.email as string]));

    const totals = new Map<string, { entries: number; mins: number; last_entry_at: string | null }>();
    for (const e of entries) {
      const uid = e.user_id as string;
      const cur = totals.get(uid) ?? { entries: 0, mins: 0, last_entry_at: null };
      cur.entries += 1;
      cur.mins += (e.duration_mins as number) ?? 0;
      const date = e.date as string;
      if (!cur.last_entry_at || date > cur.last_entry_at) cur.last_entry_at = date;
      totals.set(uid, cur);
    }

    const users = Array.from(totals.entries())
      .map(([user_id, t]) => ({
        user_id, user_email: emailByUser.get(user_id) ?? user_id, entries: t.entries, total_mins: t.mins,
        total_hours: Math.round((t.mins / 60) * 10) / 10, last_entry_at: t.last_entry_at,
      }))
      .sort((a, b) => b.total_mins - a.total_mins);

    res.json({ users });
  } catch (err) {
    next(err);
  }
});

orgRouter.get("/billing/report", requireOrgAdmin, async (req, res, next) => {
  try {
    const userId = typeof req.query.user_id === "string" ? req.query.user_id : undefined;
    const buffer = await buildBillingReport(req.orgId!, userId);
    const suffix = userId ? `-${userId}` : "-all-users";
    const filename = `contralyne-billing-report${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// ─── Dashboard stats (org-scoped) ──────────────────────────────────────────────

orgRouter.get("/stats", requireOrgAdmin, async (req, res, next) => {
  try {
    const orgId = req.orgId!;
    const [clients, users, openTickets, contracts, analyses, tickets] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      db.from("users").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      db.from("tickets").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "open"),
      db.from("contracts").select("status, contract_type, created_at").eq("org_id", orgId),
      db.from("analyses").select("risk_level").eq("org_id", orgId),
      db.from("tickets").select("status").eq("org_id", orgId),
    ]);

    const contractData = contracts.data ?? [];
    const analysisData = analyses.data ?? [];
    const ticketData = tickets.data ?? [];

    const uploads_per_month: { month: string; count: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      uploads_per_month.push({
        month: key,
        count: contractData.filter((c) => (c.created_at as string).slice(0, 7) === key).length,
      });
    }

    const risk_breakdown = (["low", "medium", "high", "critical"] as const).map((risk) => ({
      risk,
      count: analysisData.filter((a) => a.risk_level === risk).length,
    }));

    const contracts_by_status = (["uploaded", "processing", "analyzed", "failed"] as const).map((status) => ({
      status,
      count: contractData.filter((c) => c.status === status).length,
    }));

    const contracts_by_type = Object.entries(
      contractData.reduce<Record<string, number>>((acc, c) => {
        acc[c.contract_type] = (acc[c.contract_type] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const tickets_by_status = (["open", "in_progress", "resolved"] as const).map((status) => ({
      status,
      count: ticketData.filter((t) => t.status === status).length,
    }));

    res.json({
      clients: clients.count ?? 0,
      contracts: contractData.length,
      users: users.count ?? 0,
      open_tickets: openTickets.count ?? 0,
      charts: { uploads_per_month, risk_breakdown, contracts_by_status, contracts_by_type, tickets_by_status },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Users (org-scoped — the org admin's own firm) ────────────────────────────

orgRouter.get("/users", requireOrgAdmin, async (req, res, next) => {
  try {
    const { data: users, error } = await db
      .from("users")
      .select("clerk_user_id, email, created_at")
      .eq("org_id", req.orgId!)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const userIds = (users ?? []).map((u: any) => u.clerk_user_id);
    let memberships: Record<string, string[]> = {};
    if (userIds.length > 0) {
      const { data: memRows } = await db
        .from("client_memberships")
        .select("user_id, client_id")
        .eq("org_id", req.orgId!)
        .in("user_id", userIds);
      for (const r of memRows ?? []) {
        const m = r as any;
        if (!memberships[m.user_id]) memberships[m.user_id] = [];
        memberships[m.user_id].push(m.client_id);
      }
    }

    res.json({
      users: (users ?? []).map((u: any) => ({ ...u, client_ids: memberships[u.clerk_user_id] ?? [] })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/org/users/add — create a Clerk user directly (no invitation email)
// and add them as a member of the caller's org so their own session carries
// org_id/org_role — same mechanism the org admin themselves joined through.
orgRouter.post("/users/add", requireOrgAdmin, async (req, res, next) => {
  try {
    const { email, first_name, last_name } = z.object({
      email: z.string().email(),
      first_name: z.string().max(100).optional(),
      last_name: z.string().max(100).optional(),
    }).parse(req.body);

    const baseParams = {
      emailAddress: [email],
      firstName: first_name,
      lastName: last_name,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    };

    const deriveUsername = () => {
      let base = (email.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "") || "user").slice(0, 20).toLowerCase();
      if (base.length < 4) base = `user_${base}`;
      return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    };

    let clerkUser;
    try {
      clerkUser = await clerk.users.createUser({ ...baseParams, username: deriveUsername() });
    } catch (err: any) {
      const code = err?.errors?.[0]?.code;
      if (code === "form_identifier_exists") {
        clerkUser = await clerk.users.createUser({ ...baseParams, username: deriveUsername() });
      } else if (code === "form_param_unknown" || (err?.errors?.[0]?.longMessage ?? "").includes("username is not")) {
        clerkUser = await clerk.users.createUser(baseParams);
      } else {
        throw err;
      }
    }

    await clerk.organizations.createOrganizationMembership({
      organizationId: req.orgId!,
      userId: clerkUser.id,
      role: "org:member",
    });

    await db.from("users").upsert(
      { clerk_user_id: clerkUser.id, email, org_id: req.orgId },
      { onConflict: "clerk_user_id" },
    );

    let email_sent = false;
    if (isMailerConfigured()) {
      const greeting = first_name ? `Hi ${first_name},` : "Hi,";
      const signInUrl = `${config.WEB_URL}/sign-in`;
      const text = `${greeting}

An account has been created for you on Contralyne, the AI contract review platform.

To log in for the first time:

1. Open ${signInUrl}
2. Click "Forgot password?"
3. Enter this email address: ${email}
4. Check your inbox for a verification code and enter it
5. Choose a new password
6. Sign in with your email and new password

That's it — you're in. If you have any trouble logging in, reply to this email or contact support@contralyne.com.

— The Contralyne Team`;
      const html = wrapEmail(
        `${emailParagraphs(`${greeting}\n\nAn account has been created for you on Contralyne, the AI contract review platform.`)}
         <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;">First-time login</p>
         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
           ${[
             "Open the sign-in page",
             `Click "Forgot password?"`,
             `Enter this email address: ${email}`,
             "Check your inbox for a verification code and enter it",
             "Choose a new password",
             "Sign in with your email and new password",
           ]
             .map(
               (step, i) => `
           <tr>
             <td valign="top" style="padding:5px 10px 5px 0;">
               <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:#D9FAF4;color:#0F2A2A;font-size:11px;font-weight:700;text-align:center;line-height:20px;">${i + 1}</span>
             </td>
             <td style="padding:5px 0;font-size:13.5px;line-height:1.5;color:#1f2937;">${escapeAmp(step)}</td>
           </tr>`,
             )
             .join("")}
         </table>
         ${emailButton(signInUrl, "Sign in to Contralyne")}
         ${emailParagraphs("That's it — you're in. If you have any trouble logging in, reply to this email or contact support@contralyne.com.")}`,
        { preheader: "Your Contralyne account is ready — here's how to log in" },
      );
      try {
        await Promise.race([
          sendMail(email, "Your Contralyne account is ready", text, { html }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("mail timeout")), 12000)),
        ]);
        email_sent = true;
      } catch (mailErr) {
        console.error("Welcome email failed for", email, (mailErr as Error)?.message);
      }
    }

    res.status(201).json({
      ok: true,
      email_sent,
      user: { clerk_user_id: clerkUser.id, email, created_at: clerkUser.createdAt },
    });
  } catch (err: any) {
    const code = err?.errors?.[0]?.code ?? "";
    if (code === "form_identifier_exists" || code === "duplicate_record") {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    const clerkMsg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message;
    if (clerkMsg && typeof err?.status === "number" && err.status < 500) {
      res.status(err.status).json({ error: clerkMsg });
      return;
    }
    next(err);
  }
});

orgRouter.get("/users/:userId/clients", requireOrgAdmin, async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("client_memberships")
      .select("id, client_id, assigned_by, created_at, clients(id, name, industry, status)")
      .eq("user_id", req.params.userId)
      .eq("org_id", req.orgId!);
    if (error) throw error;
    res.json({ memberships: data ?? [] });
  } catch (err) {
    next(err);
  }
});

orgRouter.post("/users/:userId/clients", requireOrgAdmin, async (req, res, next) => {
  try {
    const { client_id } = z.object({ client_id: z.string().uuid() }).parse(req.body);
    const { data, error } = await db
      .from("client_memberships")
      .insert({ user_id: req.params.userId, client_id, org_id: req.orgId, assigned_by: req.userId })
      .select()
      .single();
    if (error) {
      if ((error as any).code === "23505") { res.status(409).json({ error: "User already assigned to this client" }); return; }
      throw error;
    }
    res.status(201).json({ membership: data });
  } catch (err) {
    next(err);
  }
});

orgRouter.delete("/users/:userId/clients/:clientId", requireOrgAdmin, async (req, res, next) => {
  try {
    const { error } = await db
      .from("client_memberships")
      .delete()
      .eq("user_id", req.params.userId)
      .eq("client_id", req.params.clientId)
      .eq("org_id", req.orgId!);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// DELETE /api/org/users/:userId — remove user from Clerk + hard-delete their
// org-scoped data. Guarded to only ever touch a user who belongs to the
// caller's own org — never lets one firm's admin reach into another firm.
orgRouter.delete("/users/:userId", requireOrgAdmin, async (req, res, next) => {
  try {
    const userId = req.params.userId;

    const { data: target } = await db
      .from("users")
      .select("clerk_user_id")
      .eq("clerk_user_id", userId)
      .eq("org_id", req.orgId!)
      .maybeSingle();
    if (!target) { res.status(404).json({ error: "User not found in this organization" }); return; }

    try {
      await clerk.users.deleteUser(userId);
    } catch (err: any) {
      if (err?.status !== 404) throw err;
    }

    const { data: contracts } = await db
      .from("contracts")
      .select("s3_key")
      .eq("user_id", userId)
      .eq("org_id", req.orgId!);
    if (contracts && contracts.length > 0) {
      await Promise.allSettled(contracts.map((c: any) => deleteFromS3(c.s3_key)));
    }

    await Promise.all([
      db.from("contracts").delete().eq("user_id", userId).eq("org_id", req.orgId!),
      db.from("clause_library").delete().eq("user_id", userId).eq("org_id", req.orgId!),
      db.from("review_rules").delete().eq("user_id", userId).eq("org_id", req.orgId!),
      db.from("activity_logs").delete().eq("user_id", userId).eq("org_id", req.orgId!),
      db.from("chat_messages").delete().eq("user_id", userId),
      db.from("client_memberships").delete().eq("user_id", userId).eq("org_id", req.orgId!),
      db.from("tickets").delete().eq("user_id", userId).eq("org_id", req.orgId!),
      db.from("tasks").delete().eq("user_id", userId).eq("org_id", req.orgId!),
      db.from("time_entries").delete().eq("user_id", userId).eq("org_id", req.orgId!),
      db.from("calendar_events").delete().eq("user_id", userId).eq("org_id", req.orgId!),
      db.from("users").delete().eq("clerk_user_id", userId).eq("org_id", req.orgId!),
    ]);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Contracts (org-scoped, read-only overview) ───────────────────────────────

function joinedOne<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

orgRouter.get("/contracts", requireOrgAdmin, async (req, res, next) => {
  try {
    const [contractsRes, usersRes] = await Promise.all([
      db
        .from("contracts")
        .select("id, user_id, client_id, filename, contract_type, status, file_size, created_at, updated_at, clients(name), analyses(risk_level, created_at)")
        .eq("org_id", req.orgId!)
        .order("created_at", { ascending: false }),
      db.from("users").select("clerk_user_id, email").eq("org_id", req.orgId!),
    ]);
    if (contractsRes.error) throw contractsRes.error;

    const emailByUser = new Map((usersRes.data ?? []).map((u) => [u.clerk_user_id as string, u.email as string]));

    const contracts = (contractsRes.data ?? []).map((c) => {
      const client = joinedOne<{ name: string }>(c.clients);
      const analysis = joinedOne<{ risk_level: string; created_at: string }>(c.analyses);
      return {
        id: c.id,
        filename: c.filename,
        contract_type: c.contract_type,
        status: c.status,
        file_size: c.file_size,
        created_at: c.created_at,
        updated_at: c.updated_at,
        client_name: client?.name ?? null,
        user_email: emailByUser.get(c.user_id as string) ?? c.user_id,
        risk_level: analysis?.risk_level ?? null,
        analyzed_at: analysis?.created_at ?? null,
      };
    });

    res.json({ contracts });
  } catch (err) {
    next(err);
  }
});

orgRouter.get("/contracts/:id/history", requireOrgAdmin, async (req, res, next) => {
  try {
    const id = req.params.id;
    const [contract, activity, analysis, chat] = await Promise.all([
      db
        .from("contracts")
        .select("id, user_id, filename, contract_type, status, file_size, mime_type, summary, error_message, created_at, updated_at, clients(name)")
        .eq("id", id)
        .eq("org_id", req.orgId!)
        .single(),
      db
        .from("activity_logs")
        .select("id, action, metadata, created_at")
        .eq("contract_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("analyses").select("risk_level, model, created_at").eq("contract_id", id).maybeSingle(),
      db.from("chat_messages").select("id", { count: "exact", head: true }).eq("contract_id", id),
    ]);

    if (contract.error || !contract.data) { res.status(404).json({ error: "Contract not found" }); return; }

    const { data: owner } = await db
      .from("users")
      .select("email")
      .eq("clerk_user_id", contract.data.user_id)
      .maybeSingle();

    res.json({
      contract: {
        ...contract.data,
        clients: undefined,
        client_name: joinedOne<{ name: string }>(contract.data.clients)?.name ?? null,
        user_email: owner?.email ?? contract.data.user_id,
      },
      activity: activity.data ?? [],
      analysis: analysis.data ?? null,
      chat_count: chat.count ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Tickets (org-scoped) ──────────────────────────────────────────────────────

orgRouter.get("/tickets", requireOrgAdmin, async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    let query = db
      .from("tickets")
      .select("id, user_id, type, reference_id, reference_name, description, status, admin_notes, created_at, updated_at, users(email)")
      .eq("org_id", req.orgId!)
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ tickets: data ?? [] });
  } catch (err) {
    next(err);
  }
});

orgRouter.patch("/tickets/:id", requireOrgAdmin, async (req, res, next) => {
  try {
    const body = z.object({
      status: z.enum(["open", "in_progress", "resolved"]).optional(),
      admin_notes: z.string().optional(),
    }).parse(req.body);

    const { data: before } = await db
      .from("tickets")
      .select("status, users(email)")
      .eq("id", req.params.id)
      .eq("org_id", req.orgId!)
      .single();

    const { data, error } = await db
      .from("tickets")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("org_id", req.orgId!)
      .select()
      .single();
    if (error || !data) { res.status(404).json({ error: "Ticket not found" }); return; }

    let email_sent = false;
    const joinedUser = before?.users as unknown;
    const ownerEmail: string | undefined = Array.isArray(joinedUser)
      ? joinedUser[0]?.email
      : (joinedUser as { email?: string } | null)?.email;
    const justResolved = body.status === "resolved" && before?.status !== "resolved";
    if (justResolved && ownerEmail && isMailerConfigured()) {
      try {
        const subjectRef = data.reference_name ? ` — ${data.reference_name}` : "";
        const signInUrl = `${config.WEB_URL}/sign-in`;
        const text = `Hi,

Good news — your support ticket on Contralyne has been resolved by our team.

Ticket details:
Type:      ${data.type}${data.reference_name ? `\nRegarding: ${data.reference_name}` : ""}
Raised on: ${new Date(data.created_at).toDateString()}

Your request:
${data.description}
${data.admin_notes ? `\nNote from our team:\n${data.admin_notes}\n` : ""}
You can log in at ${signInUrl} to continue where you left off.

If the issue isn't fully fixed, just reply to this email and we'll take another look.

— The Contralyne Team`;
        const html = wrapEmail(
          `${emailParagraphs("Hi,\n\nGood news — your support ticket on Contralyne has been resolved by our team.")}
           ${emailInfoBox(
             [
               { label: "Type", value: String(data.type) },
               { label: "Regarding", value: data.reference_name ?? "" },
               { label: "Raised on", value: new Date(data.created_at).toDateString() },
             ],
             { title: "Ticket details" },
           )}
           ${emailNoteBox(data.description, { label: "Your request" })}
           ${data.admin_notes ? emailNoteBox(data.admin_notes, { label: "Note from our team" }) : ""}
           ${emailButton(signInUrl, "Sign in to Contralyne")}
           ${emailParagraphs("If the issue isn't fully fixed, just reply to this email and we'll take another look.")}`,
          { preheader: `Your ticket${subjectRef} has been resolved` },
        );
        await sendMail(
          ownerEmail,
          `Your Contralyne support ticket has been resolved${subjectRef}`,
          text,
          { html },
        );
        email_sent = true;
      } catch (mailErr) {
        console.error("Ticket resolution email failed for", ownerEmail, mailErr);
      }
    }

    res.json({ ticket: data, email_sent });
  } catch (err) {
    next(err);
  }
});

// ─── Tasks (admin assigns work, with optional attachment) ─────────────────────
// Supplements the simpler POST /tasks above with the file-attachment variant
// used by the admin.ts-derived UI. Kept as a distinct path so the plain JSON
// version above (no attachment) stays a minimal, fast path.

orgRouter.post("/tasks/with-attachment", requireOrgAdmin, upload.single("file"), async (req, res, next) => {
  try {
    const body = z.object({
      user_id: z.string().min(1),
      title: z.string().min(1).max(500),
      notes: z.string().max(2000).optional().default(""),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
    }).parse(req.body);

    const { data: target } = await db
      .from("users")
      .select("clerk_user_id, email")
      .eq("clerk_user_id", body.user_id)
      .eq("org_id", req.orgId!)
      .maybeSingle();
    if (!target) { res.status(404).json({ error: "User not found in this organization" }); return; }

    let attachment: { attachment_s3_key: string; attachment_filename: string; attachment_mime_type: string; attachment_size: number } | null = null;
    if (req.file) {
      const key = `task-attachments/${crypto.randomUUID()}/${req.file.originalname}`;
      await uploadToS3({ buffer: req.file.buffer, key, mimeType: req.file.mimetype });
      attachment = {
        attachment_s3_key: key,
        attachment_filename: req.file.originalname,
        attachment_mime_type: req.file.mimetype,
        attachment_size: req.file.size,
      };
    }

    const { data: task, error } = await db
      .from("tasks")
      .insert({
        user_id: body.user_id,
        org_id: req.orgId,
        title: body.title,
        notes: body.notes,
        priority: body.priority,
        due_date: body.due_date || null,
        assignee: "Admin",
        ...attachment,
      })
      .select()
      .single();
    if (error) throw error;

    let email_sent = false;
    if (isMailerConfigured()) {
      try {
        const dueStr = body.due_date ? new Date(body.due_date + "T00:00:00").toDateString() : "";
        const due = dueStr ? `\nDue date:  ${dueStr}` : "";
        const attachmentLine = attachment ? `\nAttached document: ${attachment.attachment_filename} — download it from your Tasks page.` : "";
        const tasksUrl = `${config.WEB_URL}/tasks`;
        const text = `Hi,

A new task has been assigned to you on Contralyne:

Task:      ${body.title}
Priority:  ${body.priority}${due}${attachmentLine}${body.notes ? `\n\nDetails:\n${body.notes}` : ""}

View your tasks: ${tasksUrl}

— The Contralyne Team`;
        const html = wrapEmail(
          `${emailParagraphs("Hi,\n\nA new task has been assigned to you on Contralyne:")}
           ${emailInfoBox([
             { label: "Task", value: body.title },
             { label: "Priority", value: body.priority },
             { label: "Due date", value: dueStr },
             { label: "Attachment", value: attachment ? attachment.attachment_filename : "" },
           ])}
           ${body.notes ? emailNoteBox(body.notes, { label: "Details" }) : ""}
           ${emailButton(tasksUrl, "View your tasks")}`,
          { preheader: `New task: ${body.title}` },
        );
        await sendMail(
          target.email,
          `New task assigned to you: ${body.title}`,
          text,
          { html },
        );
        email_sent = true;
      } catch (mailErr) {
        console.error("Task assignment email failed for", target.email, mailErr);
      }
    }

    res.status(201).json({ task: { ...task, user_email: target.email }, email_sent });
  } catch (err) {
    next(err);
  }
});

// ─── Reports (per-tab formatted Excel downloads, org-scoped) ──────────────────

orgRouter.get("/report/:kind", requireOrgAdmin, async (req, res, next) => {
  try {
    const kind = req.params.kind;
    if (kind !== "dashboard" && kind !== "contracts") { res.status(404).json({ error: "Unknown report type" }); return; }

    const buffer = kind === "dashboard"
      ? await buildDashboardReport(req.orgId!)
      : await buildContractsReport(req.orgId!);

    const filename = `contralyne-${kind}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
