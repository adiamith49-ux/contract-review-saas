import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../db.js";
import { config } from "../config.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { isMailerConfigured, sendMail } from "../services/mailer.service.js";

// Mounted at /superadmin — the platform-level tier above every organization.
// Everything org-specific (clients, users, contracts, clauses, playbooks,
// tasks, billing, tickets) now lives in org.ts, scoped by Clerk org_id and
// gated by requireOrgAdmin. This router only covers what's above any single
// org: super-admin auth, and a cross-org health/stats view.

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

// ─── Passwordless login (email one-time code) ─────────────────────────────────
// Reuses the same reset_code_hash/reset_code_expires_at columns as forgot-
// password (structurally identical: a hashed, expiring 6-digit code) but
// never touches password_hash — this is a second, independent way in, not a
// password reset. The super admin login UI uses this exclusively.

adminRouter.post("/auth/request-otp", authLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    if (!isMailerConfigured()) {
      res.status(503).json({ error: "Login email is not configured on the server. Contact your developer." });
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
        "Your Contralyne sign-in code",
        `Your Contralyne super admin sign-in code is: ${code}\n\nIt expires in 15 minutes. If you did not request this, you can ignore this email.`,
      );
    }

    // Always OK — never reveal whether an admin account exists for this email
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/auth/verify-otp", authLimiter, async (req, res, next) => {
  try {
    const { email, code } = z.object({
      email: z.string().email(),
      code: z.string().length(6),
    }).parse(req.body);

    const { data: admin } = await db
      .from("admins")
      .select("id, email, name, reset_code_hash, reset_code_expires_at")
      .eq("email", email.toLowerCase().trim())
      .single();

    const a = admin as any;
    const expired = !a?.reset_code_expires_at || new Date(a.reset_code_expires_at) < new Date();
    if (!a?.reset_code_hash || expired || !(await bcrypt.compare(code, a.reset_code_hash))) {
      res.status(400).json({ error: "Invalid or expired code" });
      return;
    }

    // One-time: clear the code so it can't be replayed, but leave password_hash untouched
    await db.from("admins").update({ reset_code_hash: null, reset_code_expires_at: null }).eq("id", a.id);

    const token = signAdminToken(a.email);
    res.json({ token, admin: { email: a.email, name: a.name } });
  } catch (err) {
    next(err);
  }
});

// ─── Stats (organization-level only — never tenant business data) ────────────
// The super admin manages the *list* of organizations, not what's inside any
// one firm's account. Counting clients/users/contracts/tickets across every
// org would leak aggregate business activity for firms this admin has no
// relationship to beyond hosting them — so this endpoint reports only facts
// about organizations themselves (count, status breakdown), same shape as
// what /superadmin/organizations already shows per-row.
adminRouter.get("/stats", requireAdmin, async (_req, res, next) => {
  try {
    const { data: orgs, error } = await db.from("organizations").select("status");
    if (error) throw error;

    const byStatus = (["pending", "active", "suspended", "deleted"] as const).map((status) => ({
      status,
      count: (orgs ?? []).filter((o) => o.status === status).length,
    }));

    res.json({
      organizations: (orgs ?? []).length,
      organizations_by_status: byStatus,
    });
  } catch (err) {
    next(err);
  }
});

// ─── System / architecture overview ────────────────────────────────────────────

adminRouter.get("/system", requireAdmin, async (_req, res, next) => {
  try {
    let dbConnected = true;
    try {
      const { error } = await db.from("users").select("id", { count: "exact", head: true });
      if (error) dbConnected = false;
    } catch { dbConnected = false; }

    const TABLES = [
      "users", "organizations", "clients", "contracts", "legal_intake", "analyses", "chat_messages",
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

// ─── Super admin self-management ──────────────────────────────────────────────

adminRouter.post("/create-first-admin", async (req, res, next) => {
  try {
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
