import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const clausesRouter = Router();
clausesRouter.use(requireAuth);

const clauseSchema = z.object({
  title: z.string().min(1).max(200),
  clause_type: z.enum(["approved", "fallback"]),
  content: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  jurisdiction: z.string().nullable().optional(),
});

// Encode tags + jurisdiction into the notes field (avoids DB migration)
function encodeNotes(tags: string[], jurisdiction: string | null | undefined): string {
  return JSON.stringify({ tags, jurisdiction: jurisdiction ?? null });
}

// Decode notes field back to tags + jurisdiction
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
  } catch {
    // legacy plain-text notes — treat as empty tags
  }
  return { tags: [], jurisdiction: null };
}

function formatClause(row: Record<string, unknown>) {
  const { tags, jurisdiction } = decodeNotes(row.notes as string | null);
  return { ...row, tags, jurisdiction, notes: undefined };
}

// GET /api/clauses
clausesRouter.get("/", async (req, res, next) => {
  try {
    const { clause_type } = req.query;
    let query = db
      .from("clause_library")
      .select("id, user_id, title, clause_type, content, notes, created_at")
      .eq("user_id", req.userId)
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

// POST /api/clauses
clausesRouter.post("/", async (req, res, next) => {
  try {
    const body = clauseSchema.parse(req.body);
    const { tags, jurisdiction, ...rest } = body;
    const { data, error } = await db
      .from("clause_library")
      .insert({ ...rest, notes: encodeNotes(tags ?? [], jurisdiction), user_id: req.userId })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ clause: formatClause(data as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/clauses/:id
clausesRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = clauseSchema.partial().parse(req.body);
    const { tags, jurisdiction, ...rest } = body;

    // If tags or jurisdiction are being updated, re-encode notes
    const notesUpdate: { notes?: string } = {};
    if (tags !== undefined || jurisdiction !== undefined) {
      // Fetch existing notes to merge fields not being updated
      const { data: existing } = await db
        .from("clause_library")
        .select("notes")
        .eq("id", req.params.id)
        .eq("user_id", req.userId)
        .single();
      const current = decodeNotes((existing as Record<string, unknown> | null)?.notes as string | null);
      notesUpdate.notes = encodeNotes(
        tags !== undefined ? tags : current.tags,
        jurisdiction !== undefined ? jurisdiction : current.jurisdiction,
      );
    }

    const { data, error } = await db
      .from("clause_library")
      .update({ ...rest, ...notesUpdate, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select()
      .single();

    if (error || !data) { res.status(404).json({ error: "Clause not found" }); return; }
    res.json({ clause: formatClause(data as Record<string, unknown>) });
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
