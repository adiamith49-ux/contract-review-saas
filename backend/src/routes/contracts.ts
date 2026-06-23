import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { ContractType } from "../types.js";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { analyzeLimiter, chatLimiter, uploadLimiter } from "../middleware/rateLimit.js";
import { analyzeContract, redlineContract, summarizeContract } from "../services/ai.service.js";
import { exportRedlineDocx, processEdits, type ProcessedEdit } from "../services/redline.service.js";
import { logActivity } from "../services/activity.service.js";
import { chatWithContract } from "../services/chat.service.js";
import { extractText, validateFileType } from "../services/document.service.js";
import { exportToDocx, exportToPdf } from "../services/export.service.js";
import { buildS3Key, deleteFromS3, getPresignedUrl, uploadToS3 } from "../services/storage.service.js";

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

const contractTypeSchema = z.enum([
  "nda", "msa", "saas", "sow", "order_form", "employment", "vendor_agreement", "other",
]);

const intakeSchema = z.object({
  counterparty_name: z.string().optional(),
  department: z.string().optional(),
  urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
  deal_value: z.coerce.number().positive().optional(),
  jurisdiction: z.enum(["us", "uk", "eu", "india", "other"]).optional(),
  renewal_date: z.string().optional(),
  business_owner: z.string().optional(),
  notes: z.string().optional(),
});

export const contractsRouter = Router();
contractsRouter.use(requireAuth);

// POST /api/contracts/upload
contractsRouter.post("/upload", uploadLimiter, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "File is required (PDF or DOCX, max 10MB)" });
      return;
    }

    await validateFileType(req.file.buffer, req.file.mimetype);

    const contractType = contractTypeSchema.default("other").parse(req.body.contract_type);

    const fileId = randomUUID();
    const s3Key = buildS3Key(req.userId, fileId, req.file.originalname);

    const [extractedText] = await Promise.all([
      extractText(req.file.buffer, req.file.mimetype),
      uploadToS3({ buffer: req.file.buffer, key: s3Key, mimeType: req.file.mimetype }),
    ]);

    const { data, error } = await db
      .from("contracts")
      .insert({
        id: fileId,
        user_id: req.userId,
        filename: req.file.originalname,
        s3_key: s3Key,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        contract_type: contractType,
        status: "uploaded",
        extracted_text: extractedText,
      })
      .select("id, filename, contract_type, status, created_at")
      .single();

    if (error) throw error;

    await logActivity(req.userId, "contract.uploaded", fileId, {
      filename: req.file.originalname,
      contract_type: contractType,
    });

    res.status(201).json({ contract: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts — with search + filter
contractsRouter.get("/", async (req, res, next) => {
  try {
    const { status, contract_type, risk_level, search, from, to } = req.query;

    let query = db
      .from("contracts")
      .select("id, filename, contract_type, status, file_size, created_at, analyses(id, risk_level)")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", String(status));
    if (contract_type) query = query.eq("contract_type", String(contract_type));
    if (search) query = query.ilike("filename", `%${search}%`);
    if (from) query = query.gte("created_at", String(from));
    if (to) query = query.lte("created_at", String(to));

    // risk_level filter requires post-filtering since it's on the joined table
    let { data, error } = await query;
    if (error) throw error;

    if (risk_level && data) {
      data = data.filter((c: any) => {
        const a = Array.isArray(c.analyses) ? c.analyses[0] : c.analyses;
        return a?.risk_level === risk_level;
      });
    }

    // Normalize analyses to always be an array for consistent frontend types
    const contracts = (data ?? []).map((c: any) => ({
      ...c,
      analyses: c.analyses
        ? (Array.isArray(c.analyses) ? c.analyses : [c.analyses])
        : [],
    }));

    res.json({ contracts });
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id
contractsRouter.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("contracts")
      .select("id, filename, contract_type, status, file_size, s3_key, summary, extracted_text, created_at, analyses(*), legal_intake(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (error || !data) { res.status(404).json({ error: "Contract not found" }); return; }

    const fileUrl = await getPresignedUrl(data.s3_key);
    // Supabase returns analyses as a single object (not array) when contract_id has UNIQUE constraint.
    // Normalize to array so the frontend type AnalysisOut[] stays correct.
    const analyses = data.analyses
      ? (Array.isArray(data.analyses) ? data.analyses : [data.analyses])
      : [];
    res.json({ contract: { ...data, analyses, fileUrl } });
  } catch (err) {
    next(err);
  }
});

// POST /api/contracts/:id/intake — save legal intake form
contractsRouter.post("/:id/intake", async (req, res, next) => {
  try {
    const body = intakeSchema.parse(req.body);

    const { data: contract } = await db
      .from("contracts")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (!contract) { res.status(404).json({ error: "Contract not found" }); return; }

    const { data, error } = await db
      .from("legal_intake")
      .upsert({ ...body, contract_id: req.params.id, user_id: req.userId })
      .select()
      .single();

    if (error) throw error;

    await logActivity(req.userId, "contract.intake_saved", req.params.id);
    res.json({ intake: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id/intake
contractsRouter.get("/:id/intake", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("legal_intake")
      .select("*")
      .eq("contract_id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (error) { res.json({ intake: null }); return; }
    res.json({ intake: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/contracts/:id/analyze
contractsRouter.post("/:id/analyze", analyzeLimiter, async (req, res, next) => {
  try {
    const { data: contract, error: fetchError } = await db
      .from("contracts")
      .select("id, user_id, contract_type, extracted_text, status")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (fetchError || !contract) { res.status(404).json({ error: "Contract not found" }); return; }
    if (!contract.extracted_text) { res.status(422).json({ error: "Contract text could not be extracted" }); return; }

    // selectedRuleIds from body: string[] = use those specific rules,
    // empty array = standard review (no rules), undefined = all active rules
    const { selectedRuleIds } = req.body as { selectedRuleIds?: string[] };

    const [intakeResult, clauseResult] = await Promise.all([
      db.from("legal_intake").select("*").eq("contract_id", contract.id).single(),
      db.from("clause_library").select("title, clause_type, content").eq("user_id", req.userId),
    ]);
    const intake = intakeResult.data ?? null;
    const clauseLibrary = (clauseResult.data ?? []) as Array<{ title: string; clause_type: "approved" | "fallback"; content: string }>;

    // Build combined playbook text from selected (or all active) review rules
    let playbookText: string | undefined;
    const selectFields = "playbook_text, rules";
    let ruleRows: any[] = [];

    if (selectedRuleIds === undefined) {
      const r = await db.from("review_rules").select(selectFields).eq("user_id", req.userId).eq("is_active", true);
      ruleRows = r.data ?? [];
    } else if (selectedRuleIds.length > 0) {
      const r = await db.from("review_rules").select(selectFields).eq("user_id", req.userId).in("id", selectedRuleIds);
      ruleRows = r.data ?? [];
    }

    const playbookParts = ruleRows.map((row: any) => {
      // New document-based playbooks
      if (row.playbook_text?.trim()) return row.playbook_text as string;
      // Backward compat: old text-form rules stored as JSONB
      const legacyRules = row.rules as Array<{ clause_type: string; requirement: string; severity: string }> | null;
      if (legacyRules?.length) {
        return legacyRules.map(r => `[${(r.severity ?? "medium").toUpperCase()}] ${r.clause_type}: ${r.requirement}`).join("\n");
      }
      return null;
    }).filter((t): t is string => Boolean(t));

    if (playbookParts.length > 0) {
      playbookText = playbookParts.join("\n\n---\n\n");
    }

    await db.from("contracts").update({ status: "processing" }).eq("id", contract.id);

    const analysis = await analyzeContract(
      contract.extracted_text,
      contract.contract_type as ContractType,
      intake,
      playbookText,
      clauseLibrary.length > 0 ? clauseLibrary : undefined
    );

    const { data: saved, error: saveError } = await db
      .from("analyses")
      .upsert({
        contract_id: contract.id,
        user_id: req.userId,
        risk_level: analysis.riskLevel,
        risk_summary: analysis.riskSummary,
        clause_analysis: analysis.clauseAnalysis,
        negotiation_points: analysis.negotiationPoints,
        ambiguity_flags: analysis.ambiguityFlags ?? [],
        model: analysis.model,
      }, { onConflict: "contract_id" })
      .select("id")
      .single();

    if (saveError) throw saveError;

    await db.from("contracts").update({ status: "analyzed" }).eq("id", contract.id);

    await logActivity(req.userId, "contract.analyzed", contract.id, {
      risk_level: analysis.riskLevel,
      analysis_id: saved.id,
    });

    res.json({ analysisId: saved.id, status: "analyzed", riskLevel: analysis.riskLevel });
  } catch (err) {
    await db.from("contracts").update({ status: "failed" }).eq("id", req.params.id);
    next(err);
  }
});

// POST /api/contracts/:id/summarize
contractsRouter.post("/:id/summarize", async (req, res, next) => {
  try {
    const { data: contract, error } = await db
      .from("contracts")
      .select("id, contract_type, extracted_text, summary")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (error || !contract) { res.status(404).json({ error: "Contract not found" }); return; }
    if (!contract.extracted_text) { res.status(422).json({ error: "Contract text not available" }); return; }

    // Return cached summary if it exists
    if (contract.summary) { res.json({ summary: contract.summary }); return; }

    const summary = await summarizeContract(
      contract.extracted_text,
      contract.contract_type as ContractType
    );

    await db.from("contracts").update({ summary }).eq("id", contract.id);
    await logActivity(req.userId, "contract.summarized", contract.id);

    res.json({ summary });
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id/export/docx
contractsRouter.get("/:id/export/docx", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("contracts")
      .select("filename, contract_type, summary, created_at, extracted_text, analyses(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    const a = Array.isArray(data?.analyses) ? data.analyses[0] : data?.analyses;
    if (error || !data || !a) { res.status(404).json({ error: "Analysis not found" }); return; }

    const appliedParam = typeof req.query.applied === "string" ? req.query.applied : "";
    const appliedIds = appliedParam ? new Set(appliedParam.split(",").map(s => s.trim())) : undefined;

    const buffer = await exportToDocx(data.filename, data.contract_type, {
      riskLevel: a.risk_level,
      riskSummary: a.risk_summary,
      clauseAnalysis: a.clause_analysis,
      negotiationPoints: a.negotiation_points,
    }, data.summary ?? undefined, data.created_at, data.extracted_text ?? undefined, appliedIds);

    await logActivity(req.userId, "contract.exported", req.params.id, { format: "docx" });

    const baseName = data.filename.replace(/\.[^.]+$/, "");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}-review.docx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id/export/pdf
contractsRouter.get("/:id/export/pdf", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("contracts")
      .select("filename, contract_type, summary, created_at, extracted_text, analyses(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    const a = Array.isArray(data?.analyses) ? data.analyses[0] : data?.analyses;
    if (error || !data || !a) { res.status(404).json({ error: "Analysis not found" }); return; }

    const appliedParam = typeof req.query.applied === "string" ? req.query.applied : "";
    const appliedIds = appliedParam ? new Set(appliedParam.split(",").map(s => s.trim())) : undefined;

    const buffer = await exportToPdf(data.filename, data.contract_type, {
      riskLevel: a.risk_level,
      riskSummary: a.risk_summary,
      clauseAnalysis: a.clause_analysis,
      negotiationPoints: a.negotiation_points,
    }, data.summary ?? undefined, data.created_at, data.extracted_text ?? undefined, appliedIds);

    await logActivity(req.userId, "contract.exported", req.params.id, { format: "pdf" });

    const baseName = data.filename.replace(/\.[^.]+$/, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}-review.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// POST /api/contracts/:id/chat
contractsRouter.post("/:id/chat", chatLimiter, async (req, res, next) => {
  try {
    const { question } = z.object({ question: z.string().min(1).max(2000) }).parse(req.body);

    const { data: contract, error: contractError } = await db
      .from("contracts")
      .select("extracted_text, contract_type, analyses(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (contractError || !contract) { res.status(404).json({ error: "Contract not found" }); return; }
    if (!contract.extracted_text) { res.status(422).json({ error: "Contract text not available" }); return; }

    const { data: history } = await db
      .from("chat_messages")
      .select("role, content")
      .eq("contract_id", req.params.id)
      .eq("user_id", req.userId)
      .order("created_at", { ascending: true })
      .limit(20);

    const a = (Array.isArray(contract.analyses) ? contract.analyses[0] : contract.analyses) ?? null;

    const answer = await chatWithContract({
      contractText: contract.extracted_text,
      contractType: contract.contract_type,
      analysis: a ? {
        riskLevel: a.risk_level,
        riskSummary: a.risk_summary,
        clauseAnalysis: a.clause_analysis,
        negotiationPoints: a.negotiation_points,
      } : null,
      history: (history ?? []) as { role: "user" | "assistant"; content: string }[],
      question,
    });

    await db.from("chat_messages").insert([
      { contract_id: req.params.id, user_id: req.userId, role: "user", content: question },
      { contract_id: req.params.id, user_id: req.userId, role: "assistant", content: answer },
    ]);

    res.json({ answer });
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id/chat
contractsRouter.get("/:id/chat", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("contract_id", req.params.id)
      .eq("user_id", req.userId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ messages: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/contracts/:id/chat
contractsRouter.delete("/:id/chat", async (req, res, next) => {
  try {
    const { error } = await db
      .from("chat_messages")
      .delete()
      .eq("contract_id", req.params.id)
      .eq("user_id", req.userId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// PATCH /api/contracts/:id — update filename or contract_type
contractsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = z.object({
      filename: z.string().min(1).max(255).optional(),
      contract_type: contractTypeSchema.optional(),
    }).parse(req.body);

    if (Object.keys(body).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const { data, error } = await db
      .from("contracts")
      .update(body)
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select("id, filename, contract_type, status, updated_at")
      .single();

    if (error || !data) { res.status(404).json({ error: "Contract not found" }); return; }

    await logActivity(req.userId, "contract.updated", req.params.id, body as Record<string, unknown>);
    res.json({ contract: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/contracts/:id/redline
contractsRouter.post("/:id/redline", analyzeLimiter, async (req, res, next) => {
  try {
    const { data: contract, error } = await db
      .from("contracts")
      .select("extracted_text, contract_type, legal_intake(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (error || !contract) { res.status(404).json({ error: "Contract not found" }); return; }
    if (!contract.extracted_text) { res.status(422).json({ error: "Contract text not extracted yet" }); return; }

    // Fetch active playbook rules + clause library in parallel
    const [{ data: ruleRows }, { data: clauseRows }] = await Promise.all([
      db.from("review_rules").select("title, playbook_text, rules").eq("user_id", req.userId).eq("is_active", true),
      db.from("clause_library").select("title, clause_type, content").eq("user_id", req.userId),
    ]);

    const playbookParts = (ruleRows ?? []).map((row: any) => {
      if (row.playbook_text?.trim()) return row.playbook_text as string;
      const legacyRules = row.rules as Array<{ clause_type: string; requirement: string; severity: string }> | null;
      if (legacyRules?.length) {
        return legacyRules.map(r => `[${(r.severity ?? "medium").toUpperCase()}] ${r.clause_type}: ${r.requirement}`).join("\n");
      }
      return null;
    }).filter((t: unknown): t is string => Boolean(t));

    const playbookText = playbookParts.length > 0 ? playbookParts.join("\n\n---\n\n") : undefined;
    const clauseLibrary = (clauseRows ?? []).map((r: any) => ({
      title: r.title as string,
      clause_type: r.clause_type as "approved" | "fallback",
      content: r.content as string,
    }));
    const intake = Array.isArray(contract.legal_intake) ? contract.legal_intake[0] : (contract.legal_intake ?? null);

    const { edits, model } = await redlineContract(
      contract.extracted_text,
      contract.contract_type as ContractType,
      intake,
      playbookText,
      clauseLibrary.length > 0 ? clauseLibrary : undefined,
    );

    console.log("[diag] source head:", JSON.stringify(contract.extracted_text.slice(0, 200)));
    const processedEdits = processEdits(contract.extracted_text, edits);
    const matched_count = processedEdits.filter(e => e.matched).length;
    const unmatched_count = processedEdits.filter(e => !e.matched).length;
    console.log("[diag] placed:", matched_count, "unplaced:", unmatched_count);

    // Cache result (best-effort — skip silently if redlines table not created yet)
    try {
      await db.from("redlines").upsert({
        contract_id: req.params.id,
        user_id: req.userId,
        edits: processedEdits,
        matched_count,
        unmatched_count,
        model,
      }, { onConflict: "contract_id" });
    } catch {
      // table may not exist yet — non-fatal
    }

    await logActivity(req.userId, "contract.redlined", req.params.id, { matched_count, unmatched_count });
    res.json({ edits: processedEdits, matched_count, unmatched_count, model });
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id/redline — fetch cached result
contractsRouter.get("/:id/redline", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("redlines")
      .select("edits, matched_count, unmatched_count, model, created_at")
      .eq("contract_id", req.params.id)
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) { res.status(404).json({ error: "No redlines found" }); return; }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/contracts/:id/redline/export/docx
// Accepts { edits } in the request body — no DB dependency.
// Produces a valid DOCX even when edits array is empty or all edits are unplaced.
contractsRouter.post("/:id/redline/export/docx", async (req, res, next) => {
  try {
    const edits = Array.isArray(req.body?.edits) ? (req.body.edits as ProcessedEdit[]) : [];

    const { data: contract, error } = await db
      .from("contracts")
      .select("filename, extracted_text")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (error || !contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = await exportRedlineDocx(
        contract.filename,
        contract.extracted_text ?? "",
        edits,
      );
    } catch (docxErr) {
      console.error("[redline/export/docx] exportRedlineDocx threw:", (docxErr as Error)?.stack ?? docxErr);
      throw docxErr;
    }

    await logActivity(req.userId, "contract.exported", req.params.id, { format: "redline-docx" });

    const baseName = contract.filename.replace(/\.[^.]+$/, "");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}-redlines.docx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/contracts/:id
contractsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("contracts")
      .select("s3_key")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (error || !data) { res.status(404).json({ error: "Contract not found" }); return; }

    await Promise.all([
      deleteFromS3(data.s3_key),
      db.from("contracts").delete().eq("id", req.params.id),
    ]);

    await logActivity(req.userId, "contract.deleted", null, { contract_id: req.params.id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
