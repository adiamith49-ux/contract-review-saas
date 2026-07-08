import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const rulesRouter = Router();
rulesRouter.use(requireAuth);

function normalize(row: any) {
  return { ...row, name: row.title };
}

// GET /api/rules — global admin-managed playbooks (read-only for users)
rulesRouter.get("/", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("review_rules")
      .select("id, title, description, is_active, original_filename, file_size, jurisdiction, created_at")
      .eq("is_admin_managed", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ rules: (data ?? []).map(normalize) });
  } catch (err) {
    next(err);
  }
});
