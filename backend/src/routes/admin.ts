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
    const [clients, contracts, users, tickets] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }),
      db.from("contracts").select("id", { count: "exact", head: true }),
      db.from("users").select("id", { count: "exact", head: true }),
      db.from("tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);

    res.json({
      clients: clients.count ?? 0,
      contracts: contracts.count ?? 0,
      users: users.count ?? 0,
      open_tickets: tickets.count ?? 0,
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

adminRouter.post("/users/invite", requireAdmin, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${config.WEB_URL}/sign-up`,
      ignoreExisting: true,
    });

    res.json({ ok: true, email });
  } catch (err: any) {
    if (err?.errors?.[0]?.code === "duplicate_record") {
      res.status(409).json({ error: "User with this email already exists" });
      return;
    }
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

    const clerkUser = await clerk.users.createUser({
      emailAddress: [email],
      firstName: first_name,
      lastName: last_name,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });

    await db.from("users").upsert(
      { clerk_user_id: clerkUser.id, email },
      { onConflict: "clerk_user_id" },
    );

    res.status(201).json({
      ok: true,
      user: { clerk_user_id: clerkUser.id, email, created_at: clerkUser.createdAt },
    });
  } catch (err: any) {
    const code = err?.errors?.[0]?.code ?? "";
    if (code === "form_identifier_exists" || code === "duplicate_record") {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
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
});

adminRouter.get("/clauses", requireAdmin, async (_req, res, next) => {
  try {
    const { data, error } = await db
      .from("clause_library")
      .select("id, title, clause_type, content, notes, is_admin_managed, created_at")
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
    if (tags !== undefined || jurisdiction !== undefined) {
      const { data: existing } = await db
        .from("clause_library")
        .select("notes")
        .eq("id", req.params.id)
        .eq("is_admin_managed", true)
        .single();
      const cur = decodeNotes((existing as any)?.notes);
      notesUpdate.notes = encodeNotes(
        tags !== undefined ? tags : cur.tags,
        jurisdiction !== undefined ? jurisdiction : cur.jurisdiction,
      );
    }

    const { data, error } = await db
      .from("clause_library")
      .update({ ...rest, ...notesUpdate, updated_at: new Date().toISOString() })
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
      .select("id, title, description, is_active, original_filename, file_size, is_admin_managed, created_at")
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

    const { data, error } = await db
      .from("tickets")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error || !data) { res.status(404).json({ error: "Ticket not found" }); return; }
    res.json({ ticket: data });
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
