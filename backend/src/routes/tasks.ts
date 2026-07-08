import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const taskSchema = z.object({
  title:    z.string().min(1).max(500),
  notes:    z.string().optional().default(""),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  due_date: z.string().nullable().optional(),
  done:     z.boolean().optional().default(false),
  contract_id: z.string().uuid().nullable().optional(),
  assignee: z.string().max(200).nullable().optional(),
});

// GET /api/tasks
tasksRouter.get("/", async (req, res, next) => {
  try {
    let query = db
      .from("tasks")
      .select("*")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });
    if (req.query.contract_id) query = query.eq("contract_id", String(req.query.contract_id));
    const { data, error } = await query;
    if (error) throw error;
    res.json({ tasks: data ?? [] });
  } catch (err) { next(err); }
});

// POST /api/tasks
tasksRouter.post("/", async (req, res, next) => {
  try {
    const body = taskSchema.parse(req.body);
    const { data, error } = await db
      .from("tasks")
      .insert({ ...body, user_id: req.userId })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ task: data });
  } catch (err) { next(err); }
});

// PATCH /api/tasks/:id
tasksRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = taskSchema.partial().parse(req.body);
    const { data, error } = await db
      .from("tasks")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select()
      .single();
    if (error || !data) { res.status(404).json({ error: "Task not found" }); return; }
    res.json({ task: data });
  } catch (err) { next(err); }
});

// DELETE /api/tasks/:id
tasksRouter.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await db
      .from("tasks")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId);
    if (error) throw error;
    res.status(204).send();
  } catch (err) { next(err); }
});
