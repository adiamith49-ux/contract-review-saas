import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const activityRouter = Router();
activityRouter.use(requireAuth);

// GET /api/activity — paginated activity log for the dashboard
activityRouter.get("/", async (req, res, next) => {
  try {
    const { limit: rawLimit, offset: rawOffset } = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(req.query);

    const { data, error, count } = await db
      .from("activity_logs")
      .select("id, action, contract_id, metadata, created_at", { count: "exact" })
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false })
      .range(rawOffset, rawOffset + rawLimit - 1);

    if (error) throw error;
    res.json({ activity: data ?? [], total: count ?? 0 });
  } catch (err) {
    next(err);
  }
});
