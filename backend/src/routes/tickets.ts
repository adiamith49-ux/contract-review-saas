import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

const createSchema = z.object({
  type: z.enum(["clause_change", "playbook_change", "other"]),
  reference_id: z.string().uuid().optional(),
  reference_name: z.string().max(200).optional(),
  description: z.string().min(1).max(2000),
});

// GET /api/tickets — user's own tickets
ticketsRouter.get("/", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("tickets")
      .select("id, type, reference_id, reference_name, description, status, admin_notes, created_at, updated_at")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ tickets: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/tickets — submit a change request
ticketsRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);

    const { data, error } = await db
      .from("tickets")
      .insert({ ...body, user_id: req.userId })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ ticket: data });
  } catch (err) {
    next(err);
  }
});
