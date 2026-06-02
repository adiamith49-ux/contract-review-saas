import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { ContractType } from "@contralyn/shared";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { analyzeContract, summarizeContract } from "../services/ai.service.js";
import { logActivity } from "../services/activity.service.js";
import { chatWithContract } from "../services/chat.service.js";
import { extractText } from "../services/document.service.js";
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
contractsRouter.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "File is required (PDF or DOCX, max 10MB)" });
      return;
    }

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
      data = data.filter((c: any) => c.analyses?.[0]?.risk_level === risk_level);
    }

    res.json({ contracts: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id
contractsRouter.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("contracts")
      .select("id, filename, contract_type, status, file_size, s3_key, summary, created_at, analyses(*), legal_intake(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (error || !data) { res.status(404).json({ error: "Contract not found" }); return; }

    const fileUrl = await getPresignedUrl(data.s3_key);
    res.json({ contract: { ...data, fileUrl } });
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
contractsRouter.post("/:id/analyze", async (req, res, next) => {
  try {
    const { data: contract, error: fetchError } = await db
      .from("contracts")
      .select("id, user_id, contract_type, extracted_text, status")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (fetchError || !contract) { res.status(404).json({ error: "Contract not found" }); return; }
    if (!contract.extracted_text) { res.status(422).json({ error: "Contract text could not be extracted" }); return; }

    // Fetch intake context and active review rules in parallel
    const [intakeResult, rulesResult] = await Promise.all([
      db.from("legal_intake").select("*").eq("contract_id", contract.id).single(),
      db.from("review_rules").select("rules").eq("user_id", req.userId).eq("is_active", true),
    ]);

    const intake = intakeResult.data ?? null;
    const rules = (rulesResult.data ?? []).flatMap((r: any) => r.rules);

    await db.from("contracts").update({ status: "processing" }).eq("id", contract.id);

    const analysis = await analyzeContract(
      contract.extracted_text,
      contract.contract_type as ContractType,
      intake,
      rules
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
        model: analysis.model,
      })
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
      .select("filename, contract_type, analyses(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (error || !data || !data.analyses?.[0]) { res.status(404).json({ error: "Analysis not found" }); return; }

    const a = data.analyses[0];
    const buffer = await exportToDocx(data.filename, data.contract_type, {
      riskLevel: a.risk_level,
      riskSummary: a.risk_summary,
      clauseAnalysis: a.clause_analysis,
      negotiationPoints: a.negotiation_points,
    });

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
      .select("filename, contract_type, analyses(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (error || !data || !data.analyses?.[0]) { res.status(404).json({ error: "Analysis not found" }); return; }

    const a = data.analyses[0];
    const buffer = await exportToPdf(data.filename, data.contract_type, {
      riskLevel: a.risk_level,
      riskSummary: a.risk_summary,
      clauseAnalysis: a.clause_analysis,
      negotiationPoints: a.negotiation_points,
    });

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
contractsRouter.post("/:id/chat", async (req, res, next) => {
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

    const a = contract.analyses?.[0] ?? null;

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
