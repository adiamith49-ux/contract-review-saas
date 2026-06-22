import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const clausesRouter = Router();
clausesRouter.use(requireAuth);

function decodeNotes(notes: string | null | undefined): { tags: string[]; jurisdiction: string | null } {
  if (!notes) return { tags: [], jurisdiction: null };
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed)) return { tags: parsed, jurisdiction: null };
    if (typeof parsed === "object" && parsed !== null) {
      return {
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        jurisdiction: typeof parsed.jurisdiction === "string" ? parsed.jurisdiction : null,
      };
    }
  } catch { /* empty */ }
  return { tags: [], jurisdiction: null };
}

function formatClause(row: Record<string, unknown>) {
  const { tags, jurisdiction } = decodeNotes(row.notes as string | null);
  return { ...row, tags, jurisdiction, notes: undefined };
}

// GET /api/clauses — global admin-managed library (read-only for users)
clausesRouter.get("/", async (req, res, next) => {
  try {
    const { clause_type } = req.query;
    let query = db
      .from("clause_library")
      .select("id, title, clause_type, content, notes, created_at")
      .eq("is_admin_managed", true)
      .order("clause_type")
      .order("title");

    if (clause_type) query = query.eq("clause_type", String(clause_type));

    const { data, error } = await query;
    if (error) throw error;
    res.json({ clauses: (data ?? []).map(formatClause) });
  } catch (err) {
    next(err);
  }
});
