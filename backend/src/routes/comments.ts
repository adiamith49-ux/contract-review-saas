import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { logActivity } from "../services/activity.service.js";

// Matter collaboration: per-contract comments + derived team view.
// Mounted at /api/contracts alongside contractsRouter (paths don't overlap).
export const commentsRouter = Router();
commentsRouter.use(requireAuth);

// @mentions: "@Jane" or "@Jane Smith" (two words max, each starting with a letter)
export function parseMentions(body: string): string[] {
  const out = new Set<string>();
  const re = /@([A-Za-z][\w'-]*(?:\s[A-Z][\w'-]*)?)/g;
  let m;
  while ((m = re.exec(body)) !== null) out.add(m[1]);
  return [...out];
}

async function assertOwnership(contractId: string, userId: string): Promise<boolean> {
  const { data } = await db.from("contracts").select("id").eq("id", contractId).eq("user_id", userId).single();
  return !!data;
}

// GET /api/contracts/:id/comments
commentsRouter.get("/:id/comments", async (req, res, next) => {
  try {
    if (!(await assertOwnership(req.params.id, req.userId))) return res.status(404).json({ error: "Contract not found" });
    const { data, error } = await db
      .from("contract_comments")
      .select("*")
      .eq("contract_id", req.params.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json({ comments: data ?? [] });
  } catch (err) { next(err); }
});

// POST /api/contracts/:id/comments
commentsRouter.post("/:id/comments", async (req, res, next) => {
  try {
    const body = z.object({
      body: z.string().min(1).max(5000),
      visibility: z.enum(["internal", "shared"]).default("internal"),
      author_name: z.string().max(200).optional(),
    }).parse(req.body);
    if (!(await assertOwnership(req.params.id, req.userId))) return res.status(404).json({ error: "Contract not found" });

    const mentions = parseMentions(body.body);
    const { data, error } = await db
      .from("contract_comments")
      .insert({
        contract_id: req.params.id,
        user_id: req.userId,
        author_name: body.author_name?.trim() || "Team member",
        body: body.body,
        visibility: body.visibility,
        mentions,
      })
      .select()
      .single();
    if (error) throw error;

    await logActivity(req.userId, "comment.added", req.params.id, {
      visibility: body.visibility,
      mentions: mentions.length ? mentions : undefined,
    });
    res.status(201).json({ comment: data });
  } catch (err) { next(err); }
});

// DELETE /api/contracts/:id/comments/:commentId
commentsRouter.delete("/:id/comments/:commentId", async (req, res, next) => {
  try {
    const { error } = await db
      .from("contract_comments")
      .delete()
      .eq("id", req.params.commentId)
      .eq("contract_id", req.params.id)
      .eq("user_id", req.userId);
    if (error) throw error;
    await logActivity(req.userId, "comment.deleted", req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

// GET /api/contracts/:id/team — everyone involved with this matter, with roles
commentsRouter.get("/:id/team", async (req, res, next) => {
  try {
    const contractId = req.params.id;
    const { data: contract } = await db
      .from("contracts")
      .select("id, owner_name, legal_intake(business_owner, department)")
      .eq("id", contractId)
      .eq("user_id", req.userId)
      .single();
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    const [{ data: approvers }, { data: tasks }, { data: comments }] = await Promise.all([
      db.from("contract_approvals").select("approver_name, approver_email").eq("contract_id", contractId).eq("user_id", req.userId),
      db.from("tasks").select("assignee").eq("contract_id", contractId).eq("user_id", req.userId),
      db.from("contract_comments").select("author_name, mentions").eq("contract_id", contractId).eq("user_id", req.userId),
    ]);

    const team = new Map<string, { name: string; email: string | null; roles: Set<string> }>();
    const add = (name: string | null | undefined, role: string, email: string | null = null) => {
      const n = name?.trim();
      if (!n) return;
      const key = n.toLowerCase();
      const entry = team.get(key) ?? { name: n, email: null, roles: new Set<string>() };
      entry.roles.add(role);
      if (email) entry.email = email;
      team.set(key, entry);
    };

    add(contract.owner_name, "Contract Owner");
    const intake = Array.isArray(contract.legal_intake) ? contract.legal_intake[0] : contract.legal_intake;
    add(intake?.business_owner, intake?.department ? `Business Owner (${intake.department})` : "Business Owner");
    for (const a of approvers ?? []) add(a.approver_name, "Approver", a.approver_email);
    for (const t of tasks ?? []) add(t.assignee, "Task Assignee");
    for (const c of comments ?? []) {
      if (c.author_name !== "Team member") add(c.author_name, "Commenter");
      for (const m of (c.mentions as string[]) ?? []) add(m, "Mentioned");
    }

    res.json({
      team: [...team.values()].map(t => ({ name: t.name, email: t.email, roles: [...t.roles] })),
    });
  } catch (err) { next(err); }
});
