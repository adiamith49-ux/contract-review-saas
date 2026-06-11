import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const clausesRouter = Router();
clausesRouter.use(requireAuth);

const clauseSchema = z.object({
  title: z.string().min(1).max(200),
  clause_type: z.enum(["liability", "payment", "ip", "termination", "nda", "indemnity", "confidentiality", "governing_law", "other"]),
  content: z.string().min(1),
  notes: z.string().optional(),
});

// GET /api/clauses
clausesRouter.get("/", async (req, res, next) => {
  try {
    const { clause_type } = req.query;
    let query = db
      .from("clause_library")
      .select("id, title, clause_type, content, notes, created_at")
      .eq("user_id", req.userId)
      .order("clause_type")
      .order("title");

    if (clause_type) query = query.eq("clause_type", String(clause_type));

    const { data, error } = await query;
    if (error) throw error;
    res.json({ clauses: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/clauses
clausesRouter.post("/", async (req, res, next) => {
  try {
    const body = clauseSchema.parse(req.body);
    const { data, error } = await db
      .from("clause_library")
      .insert({ ...body, user_id: req.userId })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ clause: data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/clauses/:id
clausesRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = clauseSchema.partial().parse(req.body);
    const { data, error } = await db
      .from("clause_library")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select()
      .single();

    if (error || !data) { res.status(404).json({ error: "Clause not found" }); return; }
    res.json({ clause: data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/clauses/:id
clausesRouter.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await db
      .from("clause_library")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
