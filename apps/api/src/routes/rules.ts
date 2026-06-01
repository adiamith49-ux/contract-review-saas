import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const rulesRouter = Router();
rulesRouter.use(requireAuth);

const ruleItemSchema = z.object({
  clause_type: z.string().min(1),
  requirement: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

const ruleSetSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  rules: z.array(ruleItemSchema).min(1),
});

// GET /api/rules
rulesRouter.get("/", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("review_rules")
      .select("id, title, description, is_active, rules, created_at")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ rules: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/rules
rulesRouter.post("/", async (req, res, next) => {
  try {
    const body = ruleSetSchema.parse(req.body);
    const { data, error } = await db
      .from("review_rules")
      .insert({ ...body, user_id: req.userId })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ ruleSet: data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/rules/:id
rulesRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = ruleSetSchema.partial().parse(req.body);
    const { data, error } = await db
      .from("review_rules")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select()
      .single();

    if (error || !data) { res.status(404).json({ error: "Rule set not found" }); return; }
    res.json({ ruleSet: data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/rules/:id
rulesRouter.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await db
      .from("review_rules")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
