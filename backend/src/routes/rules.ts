import { Router } from "express";
import multer from "multer";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { extractText } from "../services/document.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

export const rulesRouter = Router();
rulesRouter.use(requireAuth);

// Normalize DB row → frontend shape (title → name)
function normalize(row: any) {
  return { ...row, name: row.title };
}

// GET /api/rules
rulesRouter.get("/", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("review_rules")
      .select("id, title, description, is_active, original_filename, file_size, created_at")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ rules: (data ?? []).map(normalize) });
  } catch (err) {
    next(err);
  }
});

// POST /api/rules — upload a playbook document (PDF or DOCX)
rulesRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "A PDF or DOCX playbook file is required" });
      return;
    }

    const name = (req.body.name as string | undefined)?.trim();
    if (!name) {
      res.status(400).json({ error: "Playbook name is required" });
      return;
    }

    // Extract readable text from the uploaded document
    let playbookText = "";
    try {
      playbookText = await extractText(req.file.buffer, req.file.mimetype);
    } catch {
      playbookText = "";
    }

    if (!playbookText.trim()) {
      res.status(422).json({
        error: "Could not extract text from this document. Please ensure the file contains readable text (not a scanned image-only PDF).",
      });
      return;
    }

    const { data, error } = await db
      .from("review_rules")
      .insert({
        user_id: req.userId,
        title: name,
        description: (req.body.description as string | undefined)?.trim() || null,
        is_active: req.body.is_active !== "false",
        playbook_text: playbookText,
        original_filename: req.file.originalname,
        file_size: req.file.size,
        rules: [],
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ rule: normalize(data) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/rules/:id — update metadata only (name, description, is_active)
// To replace the playbook document: delete + re-upload via POST
rulesRouter.patch("/:id", async (req, res, next) => {
  try {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (req.body.name        !== undefined) updates.title       = String(req.body.name).trim();
    if (req.body.description !== undefined) updates.description = String(req.body.description).trim() || null;
    if (req.body.is_active   !== undefined) updates.is_active   = Boolean(req.body.is_active);

    const { data, error } = await db
      .from("review_rules")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select()
      .single();

    if (error || !data) { res.status(404).json({ error: "Playbook not found" }); return; }
    res.json({ rule: normalize(data) });
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
