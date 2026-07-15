import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { z } from "zod";
import { db } from "../db.js";
import { config } from "../config.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { extractText } from "../services/document.service.js";
import { deleteFromS3 } from "../services/storage.service.js";
import { isMailerConfigured, sendMail } from "../services/mailer.service.js";
import { createClerkClient } from "@clerk/backend";

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

function signAdminToken(email: string) {
  return jwt.sign(
    { email, iss: "contralyne-admin" },
    config.ADMIN_JWT_SECRET,
    { expiresIn: "12h" },
  );
}

export const adminRouter = Router();

// ─── Auth ─────────────────────────────────────────────────────────────────────

adminRouter.post("/auth/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const { data: admin } = await db
      .from("admins")
      .select("id, email, name, password_hash")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (!admin) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, (admin as any).password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signAdminToken((admin as any).email);
    res.json({ token, admin: { email: (admin as any).email, name: (admin as any).name } });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/auth/me", requireAdmin, async (req, res) => {
  res.json({ email: req.adminEmail });
});

// Requires SMTP_* env vars and the reset_code_hash / reset_code_expires_at
// columns on admins (see packages/database/schema.sql migration section).
adminRouter.post("/auth/forgot-password", authLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    if (!isMailerConfigured()) {
      res.status(503).json({ error: "Password reset email is not configured on the server. Contact your developer." });
      return;
    }

    const { data: admin } = await db
      .from("admins")
      .select("id, email")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (admin) {
      const code = String(crypto.randomInt(100000, 1000000));
      const reset_code_hash = await bcrypt.hash(code, 10);
      const reset_code_expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error } = await db
        .from("admins")
        .update({ reset_code_hash, reset_code_expires_at })
        .eq("id", (admin as any).id);
      if (error) throw error;

      await sendMail(
        (admin as any).email,
        "Contralyne admin password reset",
        `Your Contralyne admin password reset code is: ${code}\n\nIt expires in 15 minutes. If you did not request this, you can ignore this email.`,
      );
    }

    // Always OK — never reveal whether an admin account exists for this email
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/auth/reset-password", authLimiter, async (req, res, next) => {
  try {
    const { email, code, password } = z.object({
      email: z.string().email(),
      code: z.string().length(6),
      password: z.string().min(8),
    }).parse(req.body);

    const { data: admin } = await db
      .from("admins")
      .select("id, email, name, reset_code_hash, reset_code_expires_at")
      .eq("email", email.toLowerCase().trim())
      .single();

    const a = admin as any;
    const expired = !a?.reset_code_expires_at || new Date(a.reset_code_expires_at) < new Date();
    if (!a?.reset_code_hash || expired || !(await bcrypt.compare(code, a.reset_code_hash))) {
      res.status(400).json({ error: "Invalid or expired reset code" });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const { error } = await db
      .from("admins")
      .update({ password_hash, reset_code_hash: null, reset_code_expires_at: null })
      .eq("id", a.id);
    if (error) throw error;

    const token = signAdminToken(a.email);
    res.json({ token, admin: { email: a.email, name: a.name } });
  } catch (err) {
    next(err);
  }
});

// ─── Stats ────────────────────────────────────────────────────────────────────

adminRouter.get("/stats", requireAdmin, async (_req, res, next) => {
  try {
    const [clients, users, openTickets, contracts, analyses, tickets] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }),
      db.from("users").select("id", { count: "exact", head: true }),
      db.from("tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      db.from("contracts").select("status, contract_type, created_at"),
      db.from("analyses").select("risk_level"),
      db.from("tickets").select("status"),
    ]);

    const contractData = contracts.data ?? [];
    const analysisData = analyses.data ?? [];
    const ticketData = tickets.data ?? [];

    // Uploads per month — last 6 months, zero-filled so charts don't skip empty months
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

    // Risk breakdown — fixed order so chart colors stay stable
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
      charts: {
        uploads_per_month,
        risk_breakdown,
        contracts_by_status,
        contracts_by_type,
        tickets_by_status,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── System / architecture overview ────────────────────────────────────────────
// Demonstrable infrastructure health + data-model snapshot (no secrets exposed).
adminRouter.get("/system", requireAdmin, async (_req, res, next) => {
  try {
    // Live connectivity probe: a real DB round-trip proves Supabase is reachable.
    let dbConnected = true;
    try {
      const { error } = await db.from("users").select("id", { count: "exact", head: true });
      if (error) dbConnected = false;
    } catch { dbConnected = false; }

    const TABLES = [
      "users", "clients", "contracts", "legal_intake", "analyses", "chat_messages",
      "clause_library", "review_rules", "contract_comments", "contract_approvals",
      "approval_rules", "redlines", "tasks", "activity_logs",
    ] as const;

    const counts = await Promise.all(
      TABLES.map(async (t) => {
        try {
          const { count } = await db.from(t).select("id", { count: "exact", head: true });
          return { table: t, rows: count ?? 0, ok: true };
        } catch {
          return { table: t, rows: 0, ok: false };
        }
      }),
    );

    // Secrets are read from env via zod config — report only whether each is CONFIGURED,
    // never the value. "dev-placeholder"/"" means unset.
    const isSet = (v: string) => Boolean(v) && v !== "dev-placeholder" && v !== "change-me-admin-secret";

    res.json({
      status: dbConnected ? "healthy" : "degraded",
      environment: config.NODE_ENV,
      services: {
        database:   { provider: "Supabase (PostgreSQL)", connected: dbConnected },
        storage:    { provider: "AWS S3", bucket: config.S3_BUCKET_NAME, region: config.AWS_REGION, configured: isSet(config.AWS_ACCESS_KEY_ID) },
        ai:         { provider: "Anthropic", model: config.AI_MODEL, configured: isSet(config.ANTHROPIC_API_KEY) },
        auth:       { provider: "Clerk", configured: isSet(config.CLERK_SECRET_KEY) },
        email:      { provider: "SMTP", configured: isMailerConfigured() },
      },
      secrets_managed_via: "Environment variables (zod-validated in config.ts); never hardcoded, injected at deploy time by Vercel",
      tables: counts,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Clients ──────────────────────────────────────────────────────────────────

adminRouter.get("/clients", requireAdmin, async (_req, res, next) => {
  try {
    const { data, error } = await db
      .from("clients")
      .select("id, name, industry, notes, status, created_at, updated_at")
      .order("name");

    if (error) throw error;

    // Attach member counts
    const ids = (data ?? []).map((c: any) => c.id);
    let memberCounts: Record<string, number> = {};
    let contractCounts: Record<string, number> = {};

    if (ids.length > 0) {
      const { data: memRows } = await db
        .from("client_memberships")
        .select("client_id")
        .in("client_id", ids);
      for (const r of memRows ?? []) {
        memberCounts[r.client_id] = (memberCounts[r.client_id] ?? 0) + 1;
      }

      const { data: ctRows } = await db
        .from("contracts")
        .select("client_id")
        .in("client_id", ids);
      for (const r of ctRows ?? []) {
        if (r.client_id) contractCounts[r.client_id] = (contractCounts[r.client_id] ?? 0) + 1;
      }
    }

    res.json({
      clients: (data ?? []).map((c: any) => ({
        ...c,
        member_count: memberCounts[c.id] ?? 0,
        contract_count: contractCounts[c.id] ?? 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/clients", requireAdmin, async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(200),
      industry: z.string().max(100).optional(),
      notes: z.string().max(2000).optional(),
    }).parse(req.body);

    const { data, error } = await db
      .from("clients")
      .insert({ ...body, user_id: "admin" })
      .select("id, name, industry, notes, status, created_at, updated_at")
      .single();

    if (error) throw error;
    res.status(201).json({ client: { ...(data as any), member_count: 0, contract_count: 0 } });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/clients/:id", requireAdmin, async (req, res, next) => {
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
      .select("id, name, industry, notes, status, created_at, updated_at")
      .single();

    if (error || !data) { res.status(404).json({ error: "Client not found" }); return; }
    res.json({ client: data });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/clients/:id", requireAdmin, async (req, res, next) => {
  try {
    const { error } = await db.from("clients").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Users ────────────────────────────────────────────────────────────────────

adminRouter.get("/users", requireAdmin, async (_req, res, next) => {
  try {
    const { data: users, error } = await db
      .from("users")
      .select("clerk_user_id, email, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Attach client assignments per user
    const userIds = (users ?? []).map((u: any) => u.clerk_user_id);
    let memberships: Record<string, string[]> = {};

    if (userIds.length > 0) {
      const { data: memRows } = await db
        .from("client_memberships")
        .select("user_id, client_id, clients(name)")
        .in("user_id", userIds);

      for (const r of memRows ?? []) {
        const m = r as any;
        if (!memberships[m.user_id]) memberships[m.user_id] = [];
        memberships[m.user_id].push(m.client_id);
      }
    }

    res.json({
      users: (users ?? []).map((u: any) => ({
        ...u,
        client_ids: memberships[u.clerk_user_id] ?? [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/users/:userId/clients", requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("client_memberships")
      .select("id, client_id, assigned_by, created_at, clients(id, name, industry, status)")
      .eq("user_id", req.params.userId);

    if (error) throw error;
    res.json({ memberships: data ?? [] });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users/:userId/clients", requireAdmin, async (req, res, next) => {
  try {
    const { client_id } = z.object({ client_id: z.string().uuid() }).parse(req.body);

    const { data, error } = await db
      .from("client_memberships")
      .insert({ user_id: req.params.userId, client_id, assigned_by: req.adminEmail })
      .select()
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        res.status(409).json({ error: "User already assigned to this client" });
        return;
      }
      throw error;
    }
    res.status(201).json({ membership: data });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/users/:userId/clients/:clientId", requireAdmin, async (req, res, next) => {
  try {
    const { error } = await db
      .from("client_memberships")
      .delete()
      .eq("user_id", req.params.userId)
      .eq("client_id", req.params.clientId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /admin/users/add — create a Clerk user directly (no invitation email)
adminRouter.post("/users/add", requireAdmin, async (req, res, next) => {
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

    // A valid Clerk username: >=4 chars, [a-z0-9_-]. Derived from the local-part.
    const deriveUsername = () => {
      let base = (email.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "") || "user").slice(0, 20).toLowerCase();
      if (base.length < 4) base = `user_${base}`;
      return `${base}${Math.floor(1000 + Math.random() * 9000)}`; // suffix keeps it unique
    };

    // This Clerk instance requires a username, so pass one upfront (avoids a
    // guaranteed-to-fail first call). If a rare instance forbids usernames,
    // fall back to no username. Retry once on a username collision.
    let clerkUser;
    try {
      clerkUser = await clerk.users.createUser({ ...baseParams, username: deriveUsername() });
    } catch (err: any) {
      const code = err?.errors?.[0]?.code;
      if (code === "form_identifier_exists") {
        // username collision (or email exists) — one retry with a fresh username
        clerkUser = await clerk.users.createUser({ ...baseParams, username: deriveUsername() });
      } else if (code === "form_param_unknown" || (err?.errors?.[0]?.longMessage ?? "").includes("username is not")) {
        // instance doesn't accept usernames — create without
        clerkUser = await clerk.users.createUser(baseParams);
      } else {
        throw err;
      }
    }

    await db.from("users").upsert(
      { clerk_user_id: clerkUser.id, email },
      { onConflict: "clerk_user_id" },
    );

    // The account works immediately: the user's email is verified (admin strategy),
    // so they can set their password via "Forgot password" (Clerk's own email —
    // independent of our SMTP). The welcome email is a convenience notification;
    // we report its ACTUAL delivery result (not just whether SMTP is configured)
    // so the admin isn't told "sent" when the mail server rejected it. Bounded by
    // a timeout so a hung SMTP connection can never block the response.
    let email_sent = false;
    if (isMailerConfigured()) {
      const greeting = first_name ? `Hi ${first_name},` : "Hi,";
      const body = `${greeting}

An account has been created for you on Contralyne, the AI contract review platform.

To log in for the first time:

1. Open ${config.WEB_URL}/sign-in
2. Click "Forgot password?"
3. Enter this email address: ${email}
4. Check your inbox for a verification code and enter it
5. Choose a new password
6. Sign in with your email and new password

That's it — you're in. If you have any trouble logging in, reply to this email or contact support@contralyne.com.

— The Contralyne Team`;
      try {
        await Promise.race([
          sendMail(email, "Your Contralyne account is ready", body),
          new Promise((_, rej) => setTimeout(() => rej(new Error("mail timeout")), 12000)),
        ]);
        email_sent = true;
      } catch (mailErr) {
        console.error("Welcome email failed for", email, (mailErr as Error)?.message);
      }
    }

    res.status(201).json({
      ok: true,
      email_sent, // true only if the message was actually accepted by the mail server
      user: { clerk_user_id: clerkUser.id, email, created_at: clerkUser.createdAt },
    });
  } catch (err: any) {
    const code = err?.errors?.[0]?.code ?? "";
    if (code === "form_identifier_exists" || code === "duplicate_record") {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    // Surface Clerk's detailed message instead of the generic status text
    const clerkMsg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message;
    if (clerkMsg && typeof err?.status === "number" && err.status < 500) {
      res.status(err.status).json({ error: clerkMsg });
      return;
    }
    next(err);
  }
});

// DELETE /admin/users/:userId — remove user from Clerk + hard-delete all their data
adminRouter.delete("/users/:userId", requireAdmin, async (req, res, next) => {
  try {
    const userId = req.params.userId;

    // Delete from Clerk — ignore "not found" so orphaned DB rows can still be cleaned up
    try {
      await clerk.users.deleteUser(userId);
    } catch (err: any) {
      if (err?.status !== 404) throw err;
    }

    // Delete S3 files for the user's contracts before removing DB rows
    const { data: contracts } = await db
      .from("contracts")
      .select("s3_key")
      .eq("user_id", userId);
    if (contracts && contracts.length > 0) {
      await Promise.allSettled(contracts.map((c: any) => deleteFromS3(c.s3_key)));
    }

    // Hard-delete all user data (mirrors the Clerk user.deleted webhook;
    // analyses/legal_intake/redlines cascade from contracts via FK)
    await Promise.all([
      db.from("contracts").delete().eq("user_id", userId),
      db.from("clause_library").delete().eq("user_id", userId),
      db.from("review_rules").delete().eq("user_id", userId),
      db.from("activity_logs").delete().eq("user_id", userId),
      db.from("chat_messages").delete().eq("user_id", userId),
      db.from("client_memberships").delete().eq("user_id", userId),
      db.from("tickets").delete().eq("user_id", userId),
      db.from("tasks").delete().eq("user_id", userId),
      db.from("time_entries").delete().eq("user_id", userId),
      db.from("calendar_events").delete().eq("user_id", userId),
      db.from("users").delete().eq("clerk_user_id", userId),
    ]);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Clause Library ───────────────────────────────────────────────────────────

function encodeNotes(tags: string[], jurisdiction: string | null | undefined): string {
  return JSON.stringify({ tags, jurisdiction: jurisdiction ?? null });
}

function decodeNotes(notes: string | null | undefined): { tags: string[]; jurisdiction: string | null } {
  if (!notes) return { tags: [], jurisdiction: null };
  try {
    const p = JSON.parse(notes);
    if (Array.isArray(p)) return { tags: p, jurisdiction: null };
    if (typeof p === "object" && p !== null) {
      return {
        tags: Array.isArray(p.tags) ? p.tags : [],
        jurisdiction: typeof p.jurisdiction === "string" ? p.jurisdiction : null,
      };
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

adminRouter.get("/clauses", requireAdmin, async (_req, res, next) => {
  try {
    const { data, error } = await db
      .from("clause_library")
      .select("id, title, clause_type, content, notes, contract_types, status, source, version, is_admin_managed, created_at, updated_at")
      .eq("is_admin_managed", true)
      .order("clause_type")
      .order("title");

    if (error) throw error;
    res.json({ clauses: (data ?? []).map(formatClause) });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/clauses", requireAdmin, async (req, res, next) => {
  try {
    const body = clauseSchema.parse(req.body);
    const { tags, jurisdiction, ...rest } = body;

    const { data, error } = await db
      .from("clause_library")
      .insert({
        ...rest,
        notes: encodeNotes(tags ?? [], jurisdiction),
        user_id: "admin",
        is_admin_managed: true,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ clause: formatClause(data) });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/clauses/:id", requireAdmin, async (req, res, next) => {
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
        .eq("is_admin_managed", true)
        .single();
      if (tags !== undefined || jurisdiction !== undefined) {
        const cur = decodeNotes((existing as any)?.notes);
        notesUpdate.notes = encodeNotes(
          tags !== undefined ? tags : cur.tags,
          jurisdiction !== undefined ? jurisdiction : cur.jurisdiction,
        );
      }
      // Editing clause text bumps the version — provenance stays visible to users
      if (body.content !== undefined && existing && body.content !== (existing as any).content) {
        versionUpdate = { version: (((existing as any).version as number) ?? 1) + 1 };
      }
    }

    const { data, error } = await db
      .from("clause_library")
      .update({ ...rest, ...notesUpdate, ...versionUpdate, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("is_admin_managed", true)
      .select()
      .single();

    if (error || !data) { res.status(404).json({ error: "Clause not found" }); return; }
    res.json({ clause: formatClause(data) });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/clauses/:id", requireAdmin, async (req, res, next) => {
  try {
    const { error } = await db
      .from("clause_library")
      .delete()
      .eq("id", req.params.id)
      .eq("is_admin_managed", true);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Playbooks ────────────────────────────────────────────────────────────────

adminRouter.get("/playbooks", requireAdmin, async (_req, res, next) => {
  try {
    const { data, error } = await db
      .from("review_rules")
      .select("id, title, description, is_active, original_filename, file_size, jurisdiction, is_admin_managed, created_at")
      .eq("is_admin_managed", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ rules: (data ?? []).map((r: any) => ({ ...r, name: r.title })) });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/playbooks", requireAdmin, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "A PDF or DOCX playbook file is required" });
      return;
    }

    const name = (req.body.name as string | undefined)?.trim();
    if (!name) {
      res.status(400).json({ error: "Playbook name is required" });
      return;
    }

    const VALID_JURISDICTIONS = ["us", "uk", "eu", "india"];
    const rawJurisdiction = (req.body.jurisdiction as string | undefined)?.trim().toLowerCase();
    const jurisdiction = rawJurisdiction && VALID_JURISDICTIONS.includes(rawJurisdiction) ? rawJurisdiction : null;

    let playbookText = "";
    try {
      playbookText = await extractText(req.file.buffer, req.file.mimetype);
    } catch { /* empty */ }

    if (!playbookText.trim()) {
      res.status(422).json({ error: "Could not extract text from this document." });
      return;
    }

    const { data, error } = await db
      .from("review_rules")
      .insert({
        user_id: "admin",
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

adminRouter.patch("/playbooks/:id", requireAdmin, async (req, res, next) => {
  try {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (req.body.name        !== undefined) updates.title       = String(req.body.name).trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description).trim() || null;
    if (req.body.is_active   !== undefined) updates.is_active   = Boolean(req.body.is_active);
    if (req.body.jurisdiction !== undefined) {
      const j = String(req.body.jurisdiction).trim().toLowerCase();
      updates.jurisdiction = ["us", "uk", "eu", "india"].includes(j) ? j : null;
    }

    const { data, error } = await db
      .from("review_rules")
      .update(updates)
      .eq("id", req.params.id)
      .eq("is_admin_managed", true)
      .select()
      .single();

    if (error || !data) { res.status(404).json({ error: "Playbook not found" }); return; }
    res.json({ rule: { ...(data as any), name: (data as any).title } });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/playbooks/:id", requireAdmin, async (req, res, next) => {
  try {
    const { error } = await db
      .from("review_rules")
      .delete()
      .eq("id", req.params.id)
      .eq("is_admin_managed", true);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Tickets ─────────────────────────────────────────────────────────────────

adminRouter.get("/tickets", requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    let query = db
      .from("tickets")
      .select("id, user_id, type, reference_id, reference_name, description, status, admin_notes, created_at, updated_at, users(email)")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ tickets: data ?? [] });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/tickets/:id", requireAdmin, async (req, res, next) => {
  try {
    const body = z.object({
      status: z.enum(["open", "in_progress", "resolved"]).optional(),
      admin_notes: z.string().optional(),
    }).parse(req.body);

    // Prior status + owner email needed to detect the transition to "resolved"
    const { data: before } = await db
      .from("tickets")
      .select("status, users(email)")
      .eq("id", req.params.id)
      .single();

    const { data, error } = await db
      .from("tickets")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data) { res.status(404).json({ error: "Ticket not found" }); return; }

    // Best-effort resolution email — only on the transition into "resolved"
    let email_sent = false;
    // Supabase types the to-one join as an array; runtime shape can be either
    const joinedUser = before?.users as unknown;
    const ownerEmail: string | undefined = Array.isArray(joinedUser)
      ? joinedUser[0]?.email
      : (joinedUser as { email?: string } | null)?.email;
    const justResolved = body.status === "resolved" && before?.status !== "resolved";
    if (justResolved && ownerEmail && isMailerConfigured()) {
      try {
        const subjectRef = data.reference_name ? ` — ${data.reference_name}` : "";
        await sendMail(
          ownerEmail,
          `Your Contralyne support ticket has been resolved${subjectRef}`,
          `Hi,

Good news — your support ticket on Contralyne has been resolved by our team.

Ticket details:
Type:      ${data.type}${data.reference_name ? `\nRegarding: ${data.reference_name}` : ""}
Raised on: ${new Date(data.created_at).toDateString()}

Your request:
${data.description}
${data.admin_notes ? `\nNote from our team:\n${data.admin_notes}\n` : ""}
You can log in at ${config.WEB_URL}/sign-in to continue where you left off.

If the issue isn't fully fixed, just reply to this email and we'll take another look.

— The Contralyne Team`,
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

// ─── Contracts (global read-only overview) ────────────────────────────────────

// Supabase types to-one joins as arrays; runtime shape can be either
function joinedOne<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

adminRouter.get("/contracts", requireAdmin, async (_req, res, next) => {
  try {
    const [contractsRes, usersRes] = await Promise.all([
      db
        .from("contracts")
        .select("id, user_id, client_id, filename, contract_type, status, file_size, created_at, updated_at, clients(name), analyses(risk_level, created_at)")
        .order("created_at", { ascending: false }),
      db.from("users").select("clerk_user_id, email"),
    ]);

    if (contractsRes.error) throw contractsRes.error;

    const emailByUser = new Map(
      (usersRes.data ?? []).map((u) => [u.clerk_user_id as string, u.email as string]),
    );

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

// Full history for one contract: audit trail + analysis + chat volume
adminRouter.get("/contracts/:id/history", requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id;
    const [contract, activity, analysis, chat] = await Promise.all([
      db
        .from("contracts")
        .select("id, user_id, filename, contract_type, status, file_size, mime_type, summary, error_message, created_at, updated_at, clients(name)")
        .eq("id", id)
        .single(),
      db
        .from("activity_logs")
        .select("id, action, metadata, created_at")
        .eq("contract_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("analyses")
        .select("risk_level, model, created_at")
        .eq("contract_id", id)
        .maybeSingle(),
      db.from("chat_messages").select("id", { count: "exact", head: true }).eq("contract_id", id),
    ]);

    if (contract.error || !contract.data) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

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

// ─── Platform report (CSV download of everything) ─────────────────────────────

// Excel-safe CSV cell: quote specials, neutralize formula-injection prefixes
function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

adminRouter.get("/report", requireAdmin, async (_req, res, next) => {
  try {
    const [clientsRes, usersRes, contractsRes, ticketsRes, analysesRes] = await Promise.all([
      db.from("clients").select("id, name, industry, status, created_at").order("created_at"),
      db.from("users").select("clerk_user_id, email, created_at").order("created_at"),
      db
        .from("contracts")
        .select("id, user_id, filename, contract_type, status, file_size, created_at, clients(name), analyses(risk_level)")
        .order("created_at", { ascending: false }),
      db
        .from("tickets")
        .select("type, reference_name, description, status, admin_notes, created_at, updated_at, users(email)")
        .order("created_at", { ascending: false }),
      db.from("analyses").select("risk_level"),
    ]);

    const clients = clientsRes.data ?? [];
    const users = usersRes.data ?? [];
    const contracts = contractsRes.data ?? [];
    const tickets = ticketsRes.data ?? [];
    const analyses = analysesRes.data ?? [];
    const emailByUser = new Map(users.map((u) => [u.clerk_user_id as string, u.email as string]));

    const lines: string[] = [];
    const row = (...cells: unknown[]) => lines.push(cells.map(csvCell).join(","));

    row("CONTRALYNE PLATFORM REPORT");
    row("Generated", new Date().toISOString());
    row();

    row("SUMMARY");
    row("Clients", clients.length);
    row("Users", users.length);
    row("Contracts", contracts.length);
    row("Analyzed contracts", contracts.filter((c) => c.status === "analyzed").length);
    row("High/critical risk", analyses.filter((a) => a.risk_level === "high" || a.risk_level === "critical").length);
    row("Open tickets", tickets.filter((t) => t.status === "open").length);
    row();

    row("CONTRACTS");
    row("Filename", "Client", "User", "Type", "Status", "Risk", "Size (KB)", "Uploaded");
    for (const c of contracts) {
      row(
        c.filename,
        joinedOne<{ name: string }>(c.clients)?.name ?? "",
        emailByUser.get(c.user_id as string) ?? c.user_id,
        c.contract_type,
        c.status,
        joinedOne<{ risk_level: string }>(c.analyses)?.risk_level ?? "",
        Math.round(((c.file_size as number) ?? 0) / 1024),
        (c.created_at as string).slice(0, 10),
      );
    }
    row();

    row("CLIENTS");
    row("Name", "Industry", "Status", "Created");
    for (const c of clients) row(c.name, c.industry ?? "", c.status, (c.created_at as string).slice(0, 10));
    row();

    row("USERS");
    row("Email", "Created");
    for (const u of users) row(u.email, (u.created_at as string).slice(0, 10));
    row();

    row("TICKETS");
    row("Type", "Reference", "User", "Status", "Description", "Admin notes", "Created", "Updated");
    for (const t of tickets) {
      row(
        t.type,
        t.reference_name ?? "",
        joinedOne<{ email: string }>(t.users)?.email ?? "",
        t.status,
        t.description,
        t.admin_notes ?? "",
        (t.created_at as string).slice(0, 10),
        (t.updated_at as string).slice(0, 10),
      );
    }

    const filename = `contralyne-report-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    // BOM so Excel opens it as UTF-8
    res.send("﻿" + lines.join("\r\n"));
  } catch (err) {
    next(err);
  }
});

// ─── Admins (self-management) ─────────────────────────────────────────────────

adminRouter.post("/create-first-admin", async (req, res, next) => {
  try {
    // Only allow creating the first admin when no admins exist
    const { count } = await db
      .from("admins")
      .select("id", { count: "exact", head: true });

    if ((count ?? 0) > 0) {
      res.status(403).json({ error: "Admin already exists. Use admin panel to add more." });
      return;
    }

    const { email, password, name } = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1),
    }).parse(req.body);

    const password_hash = await bcrypt.hash(password, 12);
    const { data, error } = await db
      .from("admins")
      .insert({ email: email.toLowerCase().trim(), name, password_hash })
      .select("id, email, name")
      .single();

    if (error) throw error;
    const token = signAdminToken((data as any).email);
    res.status(201).json({ token, admin: { email: (data as any).email, name: (data as any).name } });
  } catch (err) {
    next(err);
  }
});
