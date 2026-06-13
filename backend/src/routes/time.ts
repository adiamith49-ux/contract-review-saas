import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const timeRouter = Router();
timeRouter.use(requireAuth);

const entrySchema = z.object({
  subject:       z.string().min(1).max(200),
  contract:      z.string().optional().default(""),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration:      z.string().min(1),
  duration_mins: z.number().int().min(1),
  billable:      z.boolean().default(true),
  category:      z.string().min(1).max(100),
  description:   z.string().optional().default(""),
});

// GET /api/time
timeRouter.get("/", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("time_entries")
      .select("*")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ entries: data ?? [] });
  } catch (err) { next(err); }
});

// POST /api/time
timeRouter.post("/", async (req, res, next) => {
  try {
    const body = entrySchema.parse(req.body);
    const { data, error } = await db
      .from("time_entries")
      .insert({ ...body, user_id: req.userId })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ entry: data });
  } catch (err) { next(err); }
});

// DELETE /api/time/:id
timeRouter.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await db
      .from("time_entries")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId);
    if (error) throw error;
    res.status(204).send();
  } catch (err) { next(err); }
});
