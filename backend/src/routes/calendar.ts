import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const calendarRouter = Router();
calendarRouter.use(requireAuth);

const eventSchema = z.object({
  title:      z.string().min(1).max(500),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_hour: z.number().int().min(0).max(23),
  end_hour:   z.number().int().min(0).max(23),
  color:      z.string().min(1).max(200),
});

// GET /api/calendar
calendarRouter.get("/", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("calendar_events")
      .select("*")
      .eq("user_id", req.userId)
      .order("date", { ascending: true })
      .order("start_hour", { ascending: true });
    if (error) throw error;
    res.json({ events: data ?? [] });
  } catch (err) { next(err); }
});

// POST /api/calendar
calendarRouter.post("/", async (req, res, next) => {
  try {
    const body = eventSchema.parse(req.body);
    const { data, error } = await db
      .from("calendar_events")
      .insert({ ...body, user_id: req.userId })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ event: data });
  } catch (err) { next(err); }
});

// PATCH /api/calendar/:id
calendarRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = eventSchema.partial().parse(req.body);
    const { data, error } = await db
      .from("calendar_events")
      .update(body)
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select()
      .single();
    if (error || !data) { res.status(404).json({ error: "Event not found" }); return; }
    res.json({ event: data });
  } catch (err) { next(err); }
});

// DELETE /api/calendar/:id
calendarRouter.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await db
      .from("calendar_events")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId);
    if (error) throw error;
    res.status(204).send();
  } catch (err) { next(err); }
});
