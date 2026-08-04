import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveOrg } from "../middleware/org.js";
import { logActivity } from "../services/activity.service.js";

// Time-bound obligations arising from a contract — milestone payments,
// certificate submissions, board updates, periodic deliverables. Team-visible
// like comments/tasks (scoped by org_id, not locked to the creator) since
// these are usually a shared concern for whoever's working the matter.
export const obligationsRouter = Router();
obligationsRouter.use(requireAuth, requireActiveOrg);

const TYPES = ["milestone_payment", "certificate_submission", "board_update", "periodic_deliverable", "other"] as const;
const RECURRENCES = ["none", "weekly", "monthly", "quarterly", "annually"] as const;

const obligationSchema = z.object({
  contract_id: z.string().uuid(),
  type: z.enum(TYPES).default("other"),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence: z.enum(RECURRENCES).default("none"),
  reminder_days_before: z.number().int().min(0).max(60).default(7),
});

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// A row is only ever written as "pending" or "completed" — "overdue" is
// derived at read time from due_date vs today, so nothing has to sweep the
// table on a schedule just to keep status accurate.
function withEffectiveStatus<T extends { status: string; due_date: string }>(row: T): T {
  if (row.status === "pending" && row.due_date < todayISO()) {
    return { ...row, status: "overdue" };
  }
  return row;
}

function nextDueDate(dueDate: string, recurrence: string): string | null {
  const d = new Date(dueDate + "T00:00:00Z");
  switch (recurrence) {
    case "weekly": d.setUTCDate(d.getUTCDate() + 7); break;
    case "monthly": d.setUTCMonth(d.getUTCMonth() + 1); break;
    case "quarterly": d.setUTCMonth(d.getUTCMonth() + 3); break;
    case "annually": d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    default: return null;
  }
  return d.toISOString().slice(0, 10);
}

async function assertContractOwnership(contractId: string, orgId: string): Promise<boolean> {
  const { data } = await db.from("contracts").select("id").eq("id", contractId).eq("org_id", orgId).maybeSingle();
  return !!data;
}

// GET /api/obligations?contract_id=X — list, org-scoped, optionally filtered to one contract
obligationsRouter.get("/", async (req, res, next) => {
  try {
    let query = db
      .from("contract_obligations")
      .select("*, contracts(filename)")
      .eq("org_id", req.orgId!)
      .order("due_date", { ascending: true });

    const contractId = typeof req.query.contract_id === "string" ? req.query.contract_id : undefined;
    if (contractId) query = query.eq("contract_id", contractId);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ obligations: (data ?? []).map(withEffectiveStatus) });
  } catch (err) { next(err); }
});

// GET /api/obligations/upcoming?days=14 — due within N days OR already overdue, for dashboard alerts
obligationsRouter.get("/upcoming", async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);

    const { data, error } = await db
      .from("contract_obligations")
      .select("id, contract_id, type, title, due_date, status, contracts(filename)")
      .eq("org_id", req.orgId!)
      .eq("status", "pending")
      .lte("due_date", horizon.toISOString().slice(0, 10))
      .order("due_date", { ascending: true })
      .limit(20);
    if (error) throw error;
    res.json({ obligations: (data ?? []).map(withEffectiveStatus) });
  } catch (err) { next(err); }
});

// POST /api/obligations
obligationsRouter.post("/", async (req, res, next) => {
  try {
    const body = obligationSchema.parse(req.body);
    if (!(await assertContractOwnership(body.contract_id, req.orgId!))) {
      res.status(404).json({ error: "Contract not found" }); return;
    }

    const { data, error } = await db
      .from("contract_obligations")
      .insert({ ...body, user_id: req.userId, org_id: req.orgId })
      .select("*, contracts(filename)")
      .single();
    if (error) throw error;

    await logActivity(req.userId!, "obligation.created", body.contract_id, { title: body.title, type: body.type, due_date: body.due_date });
    res.status(201).json({ obligation: withEffectiveStatus(data) });
  } catch (err) { next(err); }
});

// PATCH /api/obligations/:id — edit, or mark complete. Completing a recurring
// obligation auto-creates its next occurrence so periodic deliverables never
// need re-entering by hand.
obligationsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = z.object({
      type: z.enum(TYPES).optional(),
      title: z.string().min(1).max(300).optional(),
      description: z.string().max(2000).nullable().optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      recurrence: z.enum(RECURRENCES).optional(),
      reminder_days_before: z.number().int().min(0).max(60).optional(),
      status: z.enum(["pending", "completed"]).optional(),
    }).parse(req.body);

    const { data: existing } = await db
      .from("contract_obligations")
      .select("*")
      .eq("id", req.params.id)
      .eq("org_id", req.orgId!)
      .maybeSingle();
    if (!existing) { res.status(404).json({ error: "Obligation not found" }); return; }

    const updates: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() };
    const justCompleted = body.status === "completed" && existing.status !== "completed";
    if (justCompleted) updates.completed_at = new Date().toISOString();

    const { data, error } = await db
      .from("contract_obligations")
      .update(updates)
      .eq("id", req.params.id)
      .eq("org_id", req.orgId!)
      .select("*, contracts(filename)")
      .single();
    if (error || !data) { res.status(404).json({ error: "Obligation not found" }); return; }

    let nextOccurrence = null;
    if (justCompleted && existing.recurrence !== "none") {
      const nextDate = nextDueDate(existing.due_date, existing.recurrence);
      if (nextDate) {
        const { data: created } = await db
          .from("contract_obligations")
          .insert({
            contract_id: existing.contract_id,
            user_id: existing.user_id,
            org_id: existing.org_id,
            type: existing.type,
            title: existing.title,
            description: existing.description,
            due_date: nextDate,
            recurrence: existing.recurrence,
            reminder_days_before: existing.reminder_days_before,
          })
          .select("*, contracts(filename)")
          .single();
        nextOccurrence = created ? withEffectiveStatus(created) : null;
      }
    }

    if (justCompleted) await logActivity(req.userId!, "obligation.completed", existing.contract_id, { title: existing.title });

    res.json({ obligation: withEffectiveStatus(data), next_occurrence: nextOccurrence });
  } catch (err) { next(err); }
});

// DELETE /api/obligations/:id
obligationsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await db.from("contract_obligations").delete().eq("id", req.params.id).eq("org_id", req.orgId!);
    if (error) throw error;
    res.status(204).send();
  } catch (err) { next(err); }
});
