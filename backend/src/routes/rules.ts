import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const rulesRouter = Router();
rulesRouter.use(requireAuth);

const ruleItemSchema = z.object({
  clause_type:  z.string().min(1),
  requirement:  z.string().min(1),
  severity:     z.enum(["low", "medium", "high", "critical"]),
});

// Full schema (multi-rule playbook, used by direct API callers)
const ruleSetSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().optional(),
  is_active:   z.boolean().optional(),
  rules:       z.array(ruleItemSchema).min(1),
});

// Simple schema (single-rule, used by the frontend form)
// Frontend sends: { name, description, severity, is_active }
// We map name → title and wrap it into a rules array automatically.
const simpleRuleSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().optional(),
  severity:    z.enum(["low", "medium", "high", "critical"]).optional(),
  is_active:   z.boolean().optional(),
});

function normaliseBody(raw: unknown): z.infer<typeof ruleSetSchema> {
  // Try full schema first
  const full = ruleSetSchema.safeParse(raw);
  if (full.success) return full.data;

  // Fall back to simple schema
  const simple = simpleRuleSchema.parse(raw); // throws ZodError on failure (caught by route handler)
  return {
    title:       simple.name,
    description: simple.description,
    is_active:   simple.is_active,
    rules: [
      {
        clause_type:  simple.name,
        requirement:  simple.description ?? simple.name,
        severity:     simple.severity ?? "medium",
      },
    ],
  };
}

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
    const body = normaliseBody(req.body);
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
    // Accept partial of either schema
    let body: Partial<z.infer<typeof ruleSetSchema>>;
    const full = ruleSetSchema.partial().safeParse(req.body);
    if (full.success) {
      body = full.data;
    } else {
      const simple = simpleRuleSchema.partial().parse(req.body);
      body = {
        ...(simple.name        !== undefined ? { title: simple.name } : {}),
        ...(simple.description !== undefined ? { description: simple.description } : {}),
        ...(simple.is_active   !== undefined ? { is_active: simple.is_active } : {}),
        // If name or description changed, rebuild the single-rule rules array
        ...(simple.name !== undefined || simple.description !== undefined
          ? {
              rules: [{
                clause_type: simple.name ?? "",
                requirement: simple.description ?? simple.name ?? "",
                severity:    simple.severity ?? "medium",
              }],
            }
          : {}),
      };
    }

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
