import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { logActivity } from "../services/activity.service.js";
import { isMailerConfigured, sendMail } from "../services/mailer.service.js";

export const approvalsRouter = Router();
approvalsRouter.use(requireAuth);

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalRule {
  id: string;
  name: string;
  approver_name: string;
  approver_email: string | null;
  step_order: number;
  min_value: number | null;
  risk_levels: string[];
  departments: string[];
  jurisdictions: string[];
  contract_types: string[];
  is_active: boolean;
}

export interface ApprovalContext {
  contractValue: number | null;
  riskLevel: string | null;
  department: string | null;
  jurisdiction: string | null;
  contractType: string | null;
}

// ─── Matrix evaluation (exported for tests) ──────────────────────────────────
// A rule matches when EVERY condition it specifies is met; a rule with no
// conditions always matches (unconditional approver, e.g. Legal Director).

export function evaluateRule(rule: ApprovalRule, ctx: ApprovalContext): { matched: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (rule.min_value != null) {
    if (ctx.contractValue == null || ctx.contractValue < Number(rule.min_value)) return { matched: false, reasons: [] };
    reasons.push(`value ≥ $${Number(rule.min_value).toLocaleString()}`);
  }
  if (rule.risk_levels.length > 0) {
    if (!ctx.riskLevel || !rule.risk_levels.includes(ctx.riskLevel)) return { matched: false, reasons: [] };
    reasons.push(`risk is ${ctx.riskLevel}`);
  }
  if (rule.departments.length > 0) {
    if (!ctx.department || !rule.departments.some(d => d.toLowerCase() === ctx.department!.toLowerCase())) return { matched: false, reasons: [] };
    reasons.push(`department is ${ctx.department}`);
  }
  if (rule.jurisdictions.length > 0) {
    if (!ctx.jurisdiction || !rule.jurisdictions.includes(ctx.jurisdiction)) return { matched: false, reasons: [] };
    reasons.push(`jurisdiction is ${ctx.jurisdiction.toUpperCase()}`);
  }
  if (rule.contract_types.length > 0) {
    if (!ctx.contractType || !rule.contract_types.includes(ctx.contractType)) return { matched: false, reasons: [] };
    reasons.push(`type is ${ctx.contractType}`);
  }

  if (reasons.length === 0) reasons.push("applies to all contracts");
  return { matched: true, reasons };
}

export function buildChain(rules: ApprovalRule[], ctx: ApprovalContext) {
  const steps: { rule: ApprovalRule; reasons: string[] }[] = [];
  for (const rule of rules) {
    const { matched, reasons } = evaluateRule(rule, ctx);
    if (matched) steps.push({ rule, reasons });
  }
  // Dedupe by approver (name+email), keeping the earliest step_order
  steps.sort((a, b) => a.rule.step_order - b.rule.step_order);
  const seen = new Set<string>();
  return steps.filter(s => {
    const key = `${s.rule.approver_name.toLowerCase()}|${(s.rule.approver_email ?? "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const jsonArray = z.array(z.string()).default([]);

const ruleSchema = z.object({
  name: z.string().min(1).max(200),
  approver_name: z.string().min(1).max(200),
  approver_email: z.string().email().nullable().optional(),
  step_order: z.number().int().min(1).max(50).default(1),
  min_value: z.number().nonnegative().nullable().optional(),
  risk_levels: jsonArray,
  departments: jsonArray,
  jurisdictions: jsonArray,
  contract_types: jsonArray,
  is_active: z.boolean().default(true),
});

function notifyApprover(step: { approver_name: string; approver_email: string | null }, contractName: string, contractId: string) {
  if (!isMailerConfigured() || !step.approver_email) return;
  const url = `${config.WEB_URL}/contracts/${contractId}`;
  sendMail(
    step.approver_email,
    `Approval requested: ${contractName}`,
    `Hi ${step.approver_name},\n\nThe contract "${contractName}" is pending your approval on Contralyne.\n\nReview it here: ${url}\n\nThis has also been added to your task list: ${config.WEB_URL}/tasks\n\n— Contralyne`,
  ).catch(() => { /* notification failure must not block the approval flow */ });
}

// If the approver is a registered user, drop the approval on their task list too.
// Best-effort: an unknown email (external approver) or a DB hiccup must not block the flow.
async function assignApproverTask(step: { approver_name: string; approver_email: string | null }, contractName: string, contractId: string) {
  try {
    if (!step.approver_email) return;
    const { data: approver } = await db
      .from("users")
      .select("clerk_user_id")
      .ilike("email", step.approver_email)
      .maybeSingle();
    if (!approver) return;
    await db.from("tasks").insert({
      user_id: approver.clerk_user_id,
      title: `Approve contract: ${contractName}`,
      notes: `Your approval is requested for "${contractName}". Open the contract to approve, reject, or request changes.`,
      priority: "high",
      contract_id: contractId,
      assignee: "Approval Workflow",
    });
  } catch (err) {
    console.error("Failed to create approver task for", step.approver_email, err);
  }
}

// ─── Matrix CRUD ──────────────────────────────────────────────────────────────

// GET /api/approvals/rules
approvalsRouter.get("/rules", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("approval_rules")
      .select("*")
      .eq("user_id", req.userId)
      .order("step_order")
      .order("created_at");
    if (error) throw error;
    res.json({ rules: data ?? [] });
  } catch (err) { next(err); }
});

// POST /api/approvals/rules
approvalsRouter.post("/rules", async (req, res, next) => {
  try {
    const body = ruleSchema.parse(req.body);
    const { data, error } = await db
      .from("approval_rules")
      .insert({ ...body, user_id: req.userId })
      .select()
      .single();
    if (error) throw error;
    await logActivity(req.userId, "approval.rule_created", null, { rule_id: data.id, name: body.name });
    res.status(201).json({ rule: data });
  } catch (err) { next(err); }
});

// PATCH /api/approvals/rules/:id
approvalsRouter.patch("/rules/:id", async (req, res, next) => {
  try {
    const body = ruleSchema.partial().parse(req.body);
    const { data, error } = await db
      .from("approval_rules")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Rule not found" });
    res.json({ rule: data });
  } catch (err) { next(err); }
});

// DELETE /api/approvals/rules/:id
approvalsRouter.delete("/rules/:id", async (req, res, next) => {
  try {
    const { error } = await db
      .from("approval_rules")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId);
    if (error) throw error;
    await logActivity(req.userId, "approval.rule_deleted", null, { rule_id: req.params.id });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ─── Submit contract for approval ─────────────────────────────────────────────

// POST /api/approvals/contracts/:contractId/submit
approvalsRouter.post("/contracts/:contractId/submit", async (req, res, next) => {
  try {
    const contractId = req.params.contractId;

    const { data: contract, error: cErr } = await db
      .from("contracts")
      .select("id, filename, title, contract_type, contract_value, contract_status, analyses(risk_level), legal_intake(department, jurisdiction, deal_value)")
      .eq("id", contractId)
      .eq("user_id", req.userId)
      .single();
    if (cErr || !contract) return res.status(404).json({ error: "Contract not found" });
    if (contract.contract_status === "pending_approval") {
      return res.status(409).json({ error: "Contract is already pending approval" });
    }

    const { data: ruleRows, error: rErr } = await db
      .from("approval_rules")
      .select("*")
      .eq("user_id", req.userId)
      .eq("is_active", true);
    if (rErr) throw rErr;
    const rules = (ruleRows ?? []) as ApprovalRule[];
    if (rules.length === 0) {
      return res.status(400).json({ error: "No active approval rules. Set up your approval matrix first." });
    }

    const analysis = Array.isArray(contract.analyses) ? contract.analyses[0] : contract.analyses;
    const intake = Array.isArray(contract.legal_intake) ? contract.legal_intake[0] : contract.legal_intake;
    const ctx: ApprovalContext = {
      contractValue: contract.contract_value ?? intake?.deal_value ?? null,
      riskLevel: analysis?.risk_level ?? null,
      department: intake?.department ?? null,
      jurisdiction: intake?.jurisdiction ?? null,
      contractType: contract.contract_type ?? null,
    };

    const chain = buildChain(rules, ctx);
    if (chain.length === 0) {
      return res.status(400).json({ error: "No approval rule matched this contract. Add a catch-all rule or adjust conditions." });
    }

    // New round = previous max + 1
    const { data: prev } = await db
      .from("contract_approvals")
      .select("round")
      .eq("contract_id", contractId)
      .order("round", { ascending: false })
      .limit(1);
    const round = (prev?.[0]?.round ?? 0) + 1;

    const rows = chain.map((s, i) => ({
      contract_id: contractId,
      user_id: req.userId,
      round,
      step_order: i + 1,
      approver_name: s.rule.approver_name,
      approver_email: s.rule.approver_email,
      rule_name: s.rule.name,
      matched_reason: s.reasons.join("; "),
      status: "pending",
    }));

    const { data: steps, error: sErr } = await db.from("contract_approvals").insert(rows).select();
    if (sErr) throw sErr;

    await db.from("contracts").update({ contract_status: "pending_approval", updated_at: new Date().toISOString() }).eq("id", contractId).eq("user_id", req.userId);

    await logActivity(req.userId, "approval.submitted", contractId, {
      round,
      approvers: chain.map(s => s.rule.approver_name),
    });

    notifyApprover(chain[0].rule, contract.title || contract.filename, contractId);
    await assignApproverTask(chain[0].rule, contract.title || contract.filename, contractId);

    res.status(201).json({ round, steps: steps ?? [] });
  } catch (err) { next(err); }
});

// ─── Approval chain + history ─────────────────────────────────────────────────

// GET /api/approvals/contracts/:contractId
approvalsRouter.get("/contracts/:contractId", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("contract_approvals")
      .select("*")
      .eq("contract_id", req.params.contractId)
      .eq("user_id", req.userId)
      .order("round", { ascending: false })
      .order("step_order");
    if (error) throw error;

    const all = data ?? [];
    const currentRound = all.length > 0 ? all[0].round : 0;
    const current = all.filter(s => s.round === currentRound);
    const pendingWith = current.find(s => s.status === "pending") ?? null;

    res.json({
      current_round: currentRound,
      chain: current,
      pending_with: pendingWith,
      history: all,
    });
  } catch (err) { next(err); }
});

// ─── Record a decision ────────────────────────────────────────────────────────

const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  comment: z.string().max(2000).optional().default(""),
}).refine(
  d => d.decision === "approved" || d.comment.trim().length > 0,
  { message: "A comment is required when rejecting or requesting changes" },
);

// POST /api/approvals/steps/:stepId/decide
approvalsRouter.post("/steps/:stepId/decide", async (req, res, next) => {
  try {
    const { decision, comment } = decisionSchema.parse(req.body);

    const { data: step, error: sErr } = await db
      .from("contract_approvals")
      .select("*")
      .eq("id", req.params.stepId)
      .eq("user_id", req.userId)
      .single();
    if (sErr || !step) return res.status(404).json({ error: "Approval step not found" });
    if (step.status !== "pending") return res.status(409).json({ error: "This step has already been decided" });

    // Sequential chain: only the earliest pending step in the round is actionable
    const { data: chain, error: cErr } = await db
      .from("contract_approvals")
      .select("*")
      .eq("contract_id", step.contract_id)
      .eq("round", step.round)
      .order("step_order");
    if (cErr) throw cErr;
    const firstPending = (chain ?? []).find(s => s.status === "pending");
    if (!firstPending || firstPending.id !== step.id) {
      return res.status(409).json({ error: `Approval is currently pending with ${firstPending?.approver_name ?? "another approver"}` });
    }

    const { error: uErr } = await db
      .from("contract_approvals")
      .update({ status: decision, comment: comment.trim() || null, decided_at: new Date().toISOString() })
      .eq("id", step.id);
    if (uErr) throw uErr;

    const remaining = (chain ?? []).filter(s => s.status === "pending" && s.id !== step.id);
    let newContractStatus: string | null = null;

    if (decision === "approved") {
      if (remaining.length === 0) {
        newContractStatus = "approved"; // chain complete → signature ready
      } else {
        const next = remaining[0];
        const { data: c } = await db.from("contracts").select("filename, title").eq("id", step.contract_id).single();
        notifyApprover(next, c?.title || c?.filename || "a contract", step.contract_id);
        await assignApproverTask(next, c?.title || c?.filename || "a contract", step.contract_id);
      }
    } else {
      // Reject / changes requested: void the rest of the chain
      if (remaining.length > 0) {
        await db.from("contract_approvals").update({ status: "skipped" }).in("id", remaining.map(s => s.id));
      }
      newContractStatus = decision === "rejected" ? "on_hold" : "in_negotiation";
    }

    if (newContractStatus) {
      await db.from("contracts").update({ contract_status: newContractStatus, updated_at: new Date().toISOString() }).eq("id", step.contract_id).eq("user_id", req.userId);
    }

    await logActivity(req.userId, `approval.${decision}`, step.contract_id, {
      approver: step.approver_name,
      round: step.round,
      step: step.step_order,
      comment: comment.trim() || undefined,
    });

    res.json({ status: decision, contract_status: newContractStatus, chain_complete: decision === "approved" && remaining.length === 0 });
  } catch (err) { next(err); }
});
