import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { ContractType } from "../types.js";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createClerkClient } from "@clerk/backend";
import { config } from "../config.js";
import { analyzeLimiter, chatLimiter, uploadLimiter } from "../middleware/rateLimit.js";
import { analyzeContract, extractContractMeta, redlineContract, summarizeContract, summarizeChanges } from "../services/ai.service.js";
import { exportRedlineDocx, processEdits, type ProcessedEdit } from "../services/redline.service.js";
import { logActivity } from "../services/activity.service.js";
import { chatWithContract } from "../services/chat.service.js";
import { extractText, validateFileType } from "../services/document.service.js";
import { exportToDocx, exportToPdf } from "../services/export.service.js";
import { buildS3Key, deleteFromS3, downloadFromS3, getPresignedUrl, uploadToS3 } from "../services/storage.service.js";
import { editOriginalDocx, type DocxEdit } from "../services/docxEdit.service.js";

// True when the original upload is a Word .docx (only these can be edited in place)
function isDocxSource(filename: string, mimeType?: string | null): boolean {
  return (mimeType ?? "").includes("wordprocessingml") || /\.docx$/i.test(filename);
}

// Map redline edits + clause findings onto paragraph-level DOCX edits.
// Redline edits become tracked changes; remaining clause findings become comments.
function buildDocxEdits(
  redlineEdits: ProcessedEdit[] | undefined,
  clauseAnalysis: Array<{ clause?: string; finding?: string; recommendation?: string; contractText?: string; suggestedLanguage?: string }> | undefined,
): DocxEdit[] {
  const out: DocxEdit[] = [];
  for (const e of redlineEdits ?? []) {
    if (!e.original_text) continue;
    out.push({
      originalText: e.original_text,
      revisedText: e.revised_text,
      editType: e.edit_type ?? "replace",
      comment: e.rationale || e.playbook_rule || undefined,
    });
  }
  for (const c of clauseAnalysis ?? []) {
    const original = c.contractText;
    if (!original || original.length < 12) continue;
    // Skip if a redline edit already targets this text
    if ((redlineEdits ?? []).some(e => e.original_text && original.includes(e.original_text.slice(0, 30)))) continue;
    const parts = [c.finding, c.recommendation, c.suggestedLanguage ? `Suggested: ${c.suggestedLanguage}` : ""].filter(Boolean);
    if (c.suggestedLanguage) {
      out.push({ originalText: original, revisedText: c.suggestedLanguage, editType: "replace", comment: parts.join(" — ") });
    } else if (parts.length) {
      out.push({ originalText: original, editType: "replace", comment: parts.join(" — ") });
    }
  }
  return out;
}

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

const businessStatusEnum = z.enum(["draft", "submitted", "under_review", "waiting_for_business", "sent_to_counterparty", "in_negotiation", "pending_approval", "approved", "executed", "expired", "on_hold", "terminated"]);

const metaSchema = z.object({
  title: z.string().max(500).optional(),
  counterparty: z.string().max(500).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  renewal_date: z.string().optional(),
  owner_name: z.string().max(500).optional(),
  // Tolerate blank / non-numeric / NaN from the client → treat as "no value"
  contract_value: z.preprocess(
    v => { const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; },
    z.number().positive().optional(),
  ),
  contract_status: businessStatusEnum.optional(),
  governing_law: z.enum(["us", "uk", "eu", "india", "other"]).optional(),
  parent_contract_id: z.string().uuid().optional(),
});

// Ensure user exists in the users table — called on upload so every active user is always tracked.
// This is a safety net; the Clerk webhook (POST /api/webhooks/clerk) is the primary sync mechanism.
async function ensureUser(clerkUserId: string): Promise<void> {
  try {
    const { data: existing } = await db
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .single();
    if (existing) return; // already synced

    const clerkClient = createClerkClient({ secretKey: config.CLERK_SECRET_KEY });
    const user = await clerkClient.users.getUser(clerkUserId);
    const email = user.emailAddresses?.[0]?.emailAddress ?? "";
    if (!email) return; // can't insert without email

    await db.from("users").upsert(
      { clerk_user_id: clerkUserId, email },
      { onConflict: "clerk_user_id" },
    );
  } catch {
    // Non-fatal — user sync failure should never block an upload
  }
}

// POST /api/contracts/extract-meta — extract intake fields from a file without saving
contractsRouter.post("/extract-meta", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    const text = await extractText(req.file.buffer, req.file.mimetype);
    const meta = await extractContractMeta(text);
    res.json(meta);
  } catch (err) {
    next(err);
  }
});

// POST /api/contracts/upload
contractsRouter.post("/upload", uploadLimiter, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "File is required (PDF or DOCX, max 10MB)" });
      return;
    }

    await validateFileType(req.file.buffer, req.file.mimetype);

    // Ensure uploading user is registered in the users table
    void ensureUser(req.userId);

    const contractType = contractTypeSchema.default("other").parse(req.body.contract_type);
    const clientId: string | undefined = req.body.client_id || undefined;
    const meta = metaSchema.parse(req.body);

    // Determine version number if uploading a new version of an existing contract
    let versionNumber = 1;
    if (meta.parent_contract_id) {
      const { data: existing } = await db
        .from("contracts")
        .select("version_number")
        .eq("parent_contract_id", meta.parent_contract_id)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();
      // Also check the parent itself
      const { data: parent } = await db.from("contracts").select("version_number").eq("id", meta.parent_contract_id).single();
      const maxVersion = Math.max(existing?.version_number ?? 1, parent?.version_number ?? 1);
      versionNumber = maxVersion + 1;
    }

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
        title: meta.title ?? null,
        counterparty: meta.counterparty ?? null,
        start_date: meta.start_date ?? null,
        end_date: meta.end_date ?? null,
        renewal_date: meta.renewal_date ?? null,
        owner_name: meta.owner_name ?? null,
        contract_value: meta.contract_value ?? null,
        contract_status: meta.contract_status ?? "draft",
        version_number: versionNumber,
        parent_contract_id: meta.parent_contract_id ?? null,
      })
      .select("id, filename, title, contract_type, status, created_at")
      .single();

    if (error) throw error;

    // Auto-populate legal_intake from metadata so AI analysis is pre-contextualized
    if (meta.counterparty || meta.renewal_date || meta.contract_value || meta.governing_law || meta.owner_name) {
      await db.from("legal_intake").upsert({
        contract_id: fileId,
        user_id: req.userId,
        counterparty_name: meta.counterparty ?? null,
        renewal_date: meta.renewal_date ?? null,
        deal_value: meta.contract_value ?? null,
        jurisdiction: meta.governing_law ?? "us",
        business_owner: meta.owner_name ?? null,
      });
    }

    await logActivity(req.userId, "contract.uploaded", fileId, {
      filename: req.file.originalname,
      contract_type: contractType,
      counterparty: meta.counterparty,
      version_number: versionNumber,
    });

    res.status(201).json({ contract: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts — with search + filter
contractsRouter.get("/", async (req, res, next) => {
  try {
    const { status, contract_type, risk_level, search, from, to, counterparty, owner_name, contract_status, lifecycle, jurisdiction } = req.query;

    let query = db
      .from("contracts")
      .select("id, filename, title, counterparty, contract_type, contract_status, status, file_size, start_date, end_date, renewal_date, owner_name, contract_value, version_number, parent_contract_id, created_at, analyses(id, risk_level), legal_intake(jurisdiction)")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", String(status));
    if (contract_type) query = query.eq("contract_type", String(contract_type));
    if (contract_status) query = query.eq("contract_status", String(contract_status));
    if (counterparty) query = query.ilike("counterparty", `%${String(counterparty)}%`);
    if (owner_name) query = query.ilike("owner_name", `%${String(owner_name)}%`);
    if (from) query = query.gte("created_at", String(from));
    if (to) query = query.lte("created_at", String(to));
    if (search) {
      const s = String(search);
      query = query.or(`filename.ilike.%${s}%,title.ilike.%${s}%,counterparty.ilike.%${s}%`);
    }

    // Lifecycle filter: computed from dates server-side
    const today = new Date().toISOString().split("T")[0];
    const in90Days = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
    if (lifecycle === "expired") {
      query = query.lt("end_date", today);
    } else if (lifecycle === "renewal_due") {
      query = query.gte("renewal_date", today).lte("renewal_date", in90Days);
    } else if (lifecycle === "active") {
      query = query.eq("contract_status", "executed").or(`end_date.is.null,end_date.gte.${today}`);
    }

    let { data, error } = await query;
    if (error) throw error;

    // risk_level filter: post-filter (joined table)
    if (risk_level && data) {
      data = data.filter((c: any) => {
        const a = Array.isArray(c.analyses) ? c.analyses[0] : c.analyses;
        return a?.risk_level === risk_level;
      });
    }

    // jurisdiction filter: post-filter (joined legal_intake)
    if (jurisdiction && data) {
      data = data.filter((c: any) => {
        const li = Array.isArray(c.legal_intake) ? c.legal_intake[0] : c.legal_intake;
        return li?.jurisdiction === jurisdiction;
      });
    }

    const contracts = (data ?? []).map((c: any) => {
      const li = Array.isArray(c.legal_intake) ? c.legal_intake[0] : c.legal_intake;
      return {
        ...c,
        jurisdiction: li?.jurisdiction ?? null,
        legal_intake: undefined,
        analyses: c.analyses
          ? (Array.isArray(c.analyses) ? c.analyses : [c.analyses])
          : [],
      };
    });

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
      .select("id, filename, title, counterparty, contract_type, contract_status, status, file_size, s3_key, summary, extracted_text, start_date, end_date, renewal_date, owner_name, contract_value, version_number, parent_contract_id, created_at, analyses(*), legal_intake(*)")
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
      .upsert({ ...body, contract_id: req.params.id, user_id: req.userId }, { onConflict: "contract_id" })
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
// Synchronous — uses Anthropic streaming to complete within 60s.
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
    if (contract.status === "processing") { res.status(409).json({ error: "Analysis already in progress for this contract" }); return; }

    const { selectedRuleIds } = z.object({
      selectedRuleIds: z.array(z.string().uuid()).optional(),
    }).parse(req.body ?? {});

    const [intakeResult, clauseResult] = await Promise.all([
      db.from("legal_intake").select("*").eq("contract_id", contract.id).single(),
      db.from("clause_library").select("title, clause_type, content").eq("status", "approved").or(`user_id.eq.${req.userId},is_admin_managed.eq.true`),
    ]);
    const intake = intakeResult.data ?? null;
    const clauseLibrary = (clauseResult.data ?? []) as Array<{ title: string; clause_type: "approved" | "fallback" | "unacceptable"; content: string }>;

    let playbookText: string | undefined;
    const selectFields = "title, playbook_text, rules, jurisdiction";
    // Playbooks are admin-managed (user_id = "admin") but selectable by any user
    const ownerFilter = `user_id.eq.${req.userId},is_admin_managed.eq.true`;
    let ruleRows: any[] = [];

    if (selectedRuleIds === undefined) {
      // Auto-select: only playbooks matching the contract's jurisdiction (or jurisdiction-agnostic ones)
      const contractJurisdiction = intake?.jurisdiction ?? null;
      const r = await db.from("review_rules").select(selectFields).or(ownerFilter).eq("is_active", true);
      ruleRows = (r.data ?? []).filter((row: any) =>
        !row.jurisdiction || (contractJurisdiction && row.jurisdiction === contractJurisdiction)
      );
    } else if (selectedRuleIds.length > 0) {
      // Explicit selection is honoured as-is (user deliberately chose these playbooks)
      const r = await db.from("review_rules").select(selectFields).or(ownerFilter).eq("is_active", true).in("id", selectedRuleIds);
      ruleRows = r.data ?? [];
    }

    const playbookParts = ruleRows.map((row: any) => {
      const header = row.title ? `PLAYBOOK: ${row.title}\n` : "";
      if (row.playbook_text?.trim()) return header + (row.playbook_text as string);
      const legacyRules = row.rules as Array<{ clause_type: string; requirement: string; severity: string }> | null;
      if (legacyRules?.length) {
        return header + legacyRules.map(r => `[${(r.severity ?? "medium").toUpperCase()}] ${r.clause_type}: ${r.requirement}`).join("\n");
      }
      return null;
    }).filter((t): t is string => Boolean(t));

    if (playbookParts.length > 0) {
      playbookText = playbookParts.join("\n\n---\n\n");
    }

    const { error: processingErr } = await db.from("contracts").update({ status: "processing" }).eq("id", contract.id);
    if (processingErr) throw processingErr;

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
        playbooks_used: ruleRows.map((r: any) => r.title).filter(Boolean),
      }, { onConflict: "contract_id" })
      .select("id")
      .single();

    if (saveError) throw saveError;

    const { error: analyzedErr } = await db.from("contracts").update({ status: "analyzed" }).eq("id", contract.id);
    if (analyzedErr) throw analyzedErr;

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
    // Fetch contract + analysis + cached redline edits in parallel
    const [{ data, error }, { data: redlineData }] = await Promise.all([
      db.from("contracts")
        .select("filename, contract_type, summary, created_at, extracted_text, s3_key, mime_type, analyses(*)")
        .eq("id", req.params.id)
        .eq("user_id", req.userId)
        .single(),
      db.from("redlines")
        .select("edits")
        .eq("contract_id", req.params.id)
        .eq("user_id", req.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const a = Array.isArray(data?.analyses) ? data.analyses[0] : data?.analyses;
    if (error || !data || !a) { res.status(404).json({ error: "Analysis not found" }); return; }

    const appliedParam = typeof req.query.applied === "string" ? req.query.applied : "";
    const appliedIds = appliedParam ? new Set(appliedParam.split(",").map(s => s.trim())) : undefined;

    // Pass cached redline edits so the export includes proper tracked changes
    const redlineEdits = Array.isArray(redlineData?.edits) ? redlineData.edits as ProcessedEdit[] : undefined;

    let buffer: Buffer | undefined;

    // Preferred path: edit the ORIGINAL .docx in place so all source formatting
    // (tables, styles, numbering) is preserved. Falls back to the rebuilt export
    // if the source isn't a .docx or nothing could be placed.
    if (isDocxSource(data.filename, data.mime_type) && data.s3_key) {
      try {
        const original = await downloadFromS3(data.s3_key);
        const docxEdits = buildDocxEdits(redlineEdits, a.clause_analysis);
        const { buffer: edited, applied } = editOriginalDocx(original, docxEdits);
        if (applied > 0) buffer = edited;
      } catch (e) {
        console.error("[export/docx] in-place edit failed, falling back to rebuild:", (e as Error)?.message);
      }
    }

    if (!buffer) {
      buffer = await exportToDocx(data.filename, data.contract_type, {
        riskLevel: a.risk_level,
        riskSummary: a.risk_summary,
        clauseAnalysis: a.clause_analysis,
        negotiationPoints: a.negotiation_points,
      }, data.summary ?? undefined, data.created_at, data.extracted_text ?? undefined, appliedIds, redlineEdits);
    }

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

// PATCH /api/contracts/:id — update metadata
contractsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = z.object({
      filename: z.string().min(1).max(255).optional(),
      contract_type: contractTypeSchema.optional(),
      title: z.string().max(500).optional().nullable(),
      counterparty: z.string().max(500).optional().nullable(),
      start_date: z.string().optional().nullable(),
      end_date: z.string().optional().nullable(),
      renewal_date: z.string().optional().nullable(),
      owner_name: z.string().max(500).optional().nullable(),
      contract_value: z.coerce.number().positive().optional().nullable(),
      contract_status: businessStatusEnum.optional(),
    }).parse(req.body);

    if (Object.keys(body).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const { data, error } = await db
      .from("contracts")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select("id, filename, title, counterparty, contract_type, contract_status, status, start_date, end_date, renewal_date, owner_name, contract_value, updated_at")
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
      db.from("review_rules").select("title, playbook_text, rules").or(`user_id.eq.${req.userId},is_admin_managed.eq.true`).eq("is_active", true),
      db.from("clause_library").select("title, clause_type, content").eq("status", "approved").or(`user_id.eq.${req.userId},is_admin_managed.eq.true`),
    ]);

    const playbookParts = (ruleRows ?? []).map((row: any) => {
      const header = row.title ? `PLAYBOOK: ${row.title}\n` : "";
      if (row.playbook_text?.trim()) return header + (row.playbook_text as string);
      const legacyRules = row.rules as Array<{ clause_type: string; requirement: string; severity: string }> | null;
      if (legacyRules?.length) {
        return header + legacyRules.map(r => `[${(r.severity ?? "medium").toUpperCase()}] ${r.clause_type}: ${r.requirement}`).join("\n");
      }
      return null;
    }).filter((t: unknown): t is string => Boolean(t));

    const playbookText = playbookParts.length > 0 ? playbookParts.join("\n\n---\n\n") : undefined;
    const clauseLibrary = (clauseRows ?? []).map((r: any) => ({
      title: r.title as string,
      clause_type: r.clause_type as "approved" | "fallback" | "unacceptable",
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

    console.log("[redline-route] AI returned", edits.length, "edits");
    if (edits.length > 0) {
      console.log("[redline-route] first edit original_text (100):", edits[0]?.original_text?.slice(0, 100));
    }
    console.log("[redline-route] source text length:", contract.extracted_text.length);
    const processedEdits = processEdits(contract.extracted_text, edits);
    const matched_count = processedEdits.filter(e => e.matched).length;
    const unmatched_count = processedEdits.filter(e => !e.matched).length;
    console.log("[redline-route] placed:", matched_count, "unplaced:", unmatched_count);

    // Cache result — delete old then insert new (no unique constraint needed)
    try {
      await db.from("redlines")
        .delete()
        .eq("contract_id", req.params.id)
        .eq("user_id", req.userId);
      await db.from("redlines").insert({
        contract_id: req.params.id,
        user_id: req.userId,
        edits: processedEdits,
        matched_count,
        unmatched_count,
        model,
      });
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
      .select("filename, extracted_text, s3_key, mime_type")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();

    if (error || !contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    let buffer: Buffer | undefined;

    // Preferred: apply the redline as tracked changes onto the ORIGINAL .docx,
    // preserving all source formatting. Fall back to the rebuilt redline doc.
    if (isDocxSource(contract.filename, contract.mime_type) && contract.s3_key) {
      try {
        const original = await downloadFromS3(contract.s3_key);
        const docxEdits = buildDocxEdits(edits, undefined);
        const { buffer: edited, applied } = editOriginalDocx(original, docxEdits);
        if (applied > 0) buffer = edited;
      } catch (e) {
        console.error("[redline/export/docx] in-place edit failed, falling back:", (e as Error)?.message);
      }
    }

    if (!buffer) {
      try {
        buffer = await exportRedlineDocx(contract.filename, contract.extracted_text ?? "", edits);
      } catch (docxErr) {
        console.error("[redline/export/docx] exportRedlineDocx threw:", (docxErr as Error)?.stack ?? docxErr);
        throw docxErr;
      }
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

// GET /api/contracts/:id/versions — all versions in this contract's family
contractsRouter.get("/:id/versions", async (req, res, next) => {
  try {
    const { data: self, error: sErr } = await db
      .from("contracts")
      .select("id, parent_contract_id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();
    if (sErr || !self) { res.status(404).json({ error: "Contract not found" }); return; }

    // Family root: the parent if this is a child, else itself
    const rootId = self.parent_contract_id ?? self.id;
    const { data, error } = await db
      .from("contracts")
      .select("id, filename, title, version_number, contract_status, status, owner_name, created_at, parent_contract_id")
      .eq("user_id", req.userId)
      .or(`id.eq.${rootId},parent_contract_id.eq.${rootId}`)
      .order("version_number", { ascending: true });
    if (error) throw error;

    res.json({ versions: data ?? [], root_id: rootId });
  } catch (err) {
    next(err);
  }
});

// POST /api/contracts/:id/compare  { against: <otherContractId> }
// Diffs :id (base/prior) against `against` (compared/new), stores + returns the comparison.
contractsRouter.post("/:id/compare", async (req, res, next) => {
  try {
    const { against } = z.object({ against: z.string().uuid() }).parse(req.body ?? {});
    if (against === req.params.id) { res.status(400).json({ error: "Choose two different versions to compare" }); return; }

    const { data: rows, error } = await db
      .from("contracts")
      .select("id, filename, title, contract_type, version_number, extracted_text")
      .eq("user_id", req.userId)
      .in("id", [req.params.id, against]);
    if (error) throw error;

    const base = rows?.find(r => r.id === req.params.id);
    const compared = rows?.find(r => r.id === against);
    if (!base || !compared) { res.status(404).json({ error: "One or both versions not found" }); return; }
    if (!base.extracted_text || !compared.extracted_text) {
      res.status(422).json({ error: "Both versions need extracted text to compare" }); return;
    }

    const { diffContracts } = await import("../services/compare.service.js");
    const diff = diffContracts(base.extracted_text, compared.extracted_text);

    // Build a compact diff transcript for the AI (skip unchanged blocks)
    const diffText = diff.blocks
      .filter(b => b.type !== "unchanged")
      .map(b => {
        if (b.type === "added") return `ADDED: ${b.compared}`;
        if (b.type === "deleted") return `DELETED: ${b.base}`;
        return `MODIFIED:\n  was: ${b.base}\n  now: ${b.compared}`;
      })
      .join("\n\n");

    let summary: string | null = null;
    let keyChanges: unknown[] = [];
    let model = "";
    if (diffText.trim()) {
      try {
        const cs = await summarizeChanges(diffText, base.contract_type as ContractType);
        summary = cs.summary;
        keyChanges = cs.keyChanges;
        model = cs.model;
      } catch {
        summary = "Automated change summary unavailable — showing the structural diff below.";
      }
    } else {
      summary = "No substantive text differences detected between these two versions.";
    }

    const { data: saved, error: saveErr } = await db
      .from("contract_comparisons")
      .insert({
        user_id: req.userId,
        base_contract_id: base.id,
        compared_contract_id: compared.id,
        diff: diff.blocks,
        added_count: diff.added,
        deleted_count: diff.deleted,
        modified_count: diff.modified,
        summary,
        key_changes: keyChanges,
        model,
      })
      .select()
      .single();
    if (saveErr) throw saveErr;

    await logActivity(req.userId, "contract.compared", base.id, {
      compared_contract_id: compared.id,
      added: diff.added, deleted: diff.deleted, modified: diff.modified,
    });

    res.json({ comparison: saved });
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id/comparisons — stored comparisons for this contract
contractsRouter.get("/:id/comparisons", async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("contract_comparisons")
      .select("*")
      .eq("user_id", req.userId)
      .or(`base_contract_id.eq.${req.params.id},compared_contract_id.eq.${req.params.id}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ comparisons: data ?? [] });
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
