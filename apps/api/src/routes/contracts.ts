import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { ContractType } from "@contralyn/shared";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { analyzeContract } from "../services/ai.service.js";
import { extractText } from "../services/document.service.js";
import { exportToDocx, exportToPdf } from "../services/export.service.js";
import {
  buildS3Key,
  deleteFromS3,
  getPresignedUrl,
  uploadToS3,
} from "../services/storage.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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
    res.status(201).json({ contract: data });
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

    if (fetchError || !contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    if (!contract.extracted_text) {
      res.status(422).json({ error: "Contract text could not be extracted" });
      return;
    }

    await db.from("contracts").update({ status: "processing" }).eq("id", contract.id);

    const analysis = await analyzeContract(
      contract.extracted_text,
      contract.contract_type as ContractType
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

    res.json({ analysisId: saved.id, status: "analyzed" });
  } catch (err) {
    await db.from("contracts").update({ status: "failed" }).eq("id", req.params.id);
    next(err);
  }
});

// GET /api/contracts
contractsRouter.get("/", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("contracts")
      .select("id, filename, contract_type, status, file_size, created_at, analyses(id, risk_level)")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
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
      .select("id, filename, contract_type, status, file_size, s3_key, created_at, analyses(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    const fileUrl = await getPresignedUrl(data.s3_key);
    res.json({ contract: { ...data, fileUrl } });
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

    if (error || !data || !data.analyses?.[0]) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    const analysis = data.analyses[0];
    const buffer = await exportToDocx(data.filename, data.contract_type, {
      riskLevel: analysis.risk_level,
      riskSummary: analysis.risk_summary,
      clauseAnalysis: analysis.clause_analysis,
      negotiationPoints: analysis.negotiation_points,
    });

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

    if (error || !data || !data.analyses?.[0]) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    const analysis = data.analyses[0];
    const buffer = await exportToPdf(data.filename, data.contract_type, {
      riskLevel: analysis.risk_level,
      riskSummary: analysis.risk_summary,
      clauseAnalysis: analysis.clause_analysis,
      negotiationPoints: analysis.negotiation_points,
    });

    const baseName = data.filename.replace(/\.[^.]+$/, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}-review.pdf"`);
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

    if (error || !data) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    await Promise.all([
      deleteFromS3(data.s3_key),
      db.from("contracts").delete().eq("id", req.params.id),
    ]);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
