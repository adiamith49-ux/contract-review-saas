import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { ContractType } from "../types.js";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveOrg } from "../middleware/org.js";
import { createClerkClient } from "@clerk/backend";
import { config } from "../config.js";
import { analyzeLimiter, chatLimiter, statusLimiter, uploadLimiter } from "../middleware/rateLimit.js";
import { analyzeContract, extractContractMeta, redlineContract, summarizeContract, summarizeChanges, extractClauseInventory, summarizeClauseDifferences } from "../services/ai.service.js";
import { exportRedlineDocx, processEdits, type ProcessedEdit } from "../services/redline.service.js";
import { logActivity } from "../services/activity.service.js";
import { chatWithContract } from "../services/chat.service.js";
import { extractText, validateFileType } from "../services/document.service.js";
import { exportToDocx, exportToPdf } from "../services/export.service.js";
import { buildS3Key, deleteFromS3, downloadFromS3, getObjectAvailability, getPresignedUrl, uploadToS3 } from "../services/storage.service.js";
import { editOriginalDocx, type DocxEdit } from "../services/docxEdit.service.js";
import { getUserEmail, isApproverForContract } from "./approvals.js";

// Vercel exposes per-invocation request context on a well-known global symbol;
// `waitUntil` from @vercel/functions reads it. We read it directly because we
// need to know whether background work is actually supported: @vercel/functions
// SILENTLY no-ops when the context is absent, which would freeze the function
// right after our 202 and wedge the contract at "processing" forever. When it's
// missing (local dev, or a runtime that doesn't provide it) we fall back to
// finishing the work inline — slower to respond, but never lost.
const SYMBOL_FOR_REQ_CONTEXT = Symbol.for("@vercel/request-context");
function getWaitUntil(): ((p: Promise<unknown>) => void) | null {
  const ctx = (globalThis as any)[SYMBOL_FOR_REQ_CONTEXT]?.get?.();
  return typeof ctx?.waitUntil === "function" ? ctx.waitUntil.bind(ctx) : null;
}

// ─── Analysis timing ──────────────────────────────────────────────────────────
// Analysis is FIRE-AND-POLL, not request/response: POST /analyze validates,
// marks the contract "processing", hands the AI work to waitUntil() and returns
// 202 in well under a second. The client then polls GET /:id/analysis-status.
// Holding the HTTP connection open for the whole generation (60-285s) is what
// made the UI look like it was buffering forever — and any proxy/browser that
// cut the idle connection first left the user with no result at all, even
// though the backend had finished.
//
// Keep ANALYSIS_TIMEOUT_MS comfortably BELOW the serverless function maxDuration
// (backend/vercel.json → 300s). The JS timeout must win the race against the
// platform's hard kill so the catch runs and marks the contract "failed"
// (retryable) instead of leaving it wedged at "processing". STALE_PROCESSING_MS
// then lets a wedged contract be re-analyzed. If you raise maxDuration on a
// Pro/Enterprise plan, raise ANALYSIS_TIMEOUT_MS to match (and see
// ANALYSIS_MAX_TOKENS in ai.service.ts).
const ANALYSIS_TIMEOUT_MS = 285_000;              // 285s (< 300s maxDuration)
const STALE_PROCESSING_MS = ANALYSIS_TIMEOUT_MS + 60_000; // treat as wedged after this

// Reject `p` if it doesn't settle within `ms`. On timeout the underlying work is
// abandoned (its result ignored); the caller handles the rejection.
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/** Fields a new version inherits from the contract it supersedes. */
interface ParentContractDefaults {
  version_number: number;
  title: string | null;
  counterparty: string | null;
  contract_type: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  owner_name: string | null;
  contract_value: number | null;
  contract_status: string | null;
}

// True when the original upload is a Word .docx (only these can be edited in place)
function isDocxSource(filename: string, mimeType?: string | null): boolean {
  return (mimeType ?? "").includes("wordprocessingml") || /\.docx$/i.test(filename);
}

// Map redline edits + clause findings onto paragraph-level DOCX edits.
// Redline edits become tracked changes; remaining clause findings become comments.
function buildDocxEdits(
  redlineEdits: ProcessedEdit[] | undefined,
  clauseAnalysis: Array<{ clause?: string; finding?: string; recommendation?: string; contractText?: string; suggestedLanguage?: string }> | undefined,
  appliedIds?: Set<string>,
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
  for (const [i, c] of (clauseAnalysis ?? []).entries()) {
    // When the caller sent an applied-set, only those findings are exported —
    // otherwise picking three clauses in the review panel still produced a
    // document annotated with all seventy.
    if (appliedIds && !appliedIds.has(`c-${i}`)) continue;
    const original = c.contractText || c.clause;
    if (!original || original.length < 12) continue;
    // Skip if a redline edit already targets this text
    if ((redlineEdits ?? []).some(e => e.original_text && original.includes(e.original_text.slice(0, 30)))) continue;
    // Review findings are paraphrased (not verbatim) → anchor as a COMMENT only,
    // never a tracked deletion, so a fuzzy match can't remove the wrong text.
    // The suggested language rides inside the comment (mirrors the review UI).
    const parts = [c.finding, c.recommendation, c.suggestedLanguage ? `Suggested language: ${c.suggestedLanguage}` : ""].filter(Boolean);
    if (parts.length) out.push({ originalText: original, editType: "replace", comment: parts.join(" — ") });
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
contractsRouter.use(requireAuth, requireActiveOrg);

const businessStatusEnum = z.enum(["draft", "submitted", "under_review", "waiting_for_business", "sent_to_counterparty", "in_negotiation", "pending_approval", "approved", "executed", "expired", "on_hold", "terminated"]);

const metaSchema = z.object({
  title: z.string().max(500).optional(),
  counterparty: z.string().max(500).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  renewal_date: z.string().optional(),
  owner_name: z.string().max(500).optional(),
  // Tolerate blank / non-numeric / NaN from the client → treat as "no value".
  // The AI is told to return a single total, but if it (or a client) ever
  // sends a string with more than one number (e.g. "$500,000/yr, $1,500,000
  // total"), stripping all non-digits would concatenate them into garbage
  // (5000001500000) — so pick the largest individual number-group instead.
  contract_value: z.preprocess(
    v => {
      if (typeof v !== "string") { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; }
      const matches = v.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
      const nums = matches.map(m => Number(m.replace(/,/g, ""))).filter(n => Number.isFinite(n) && n > 0);
      return nums.length > 0 ? Math.max(...nums) : undefined;
    },
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

    const meta = metaSchema.parse(req.body);

    // A new version of an existing contract is the SAME matter: same
    // counterparty, same client, same deal. Re-asking for all of it (and
    // defaulting the client to whichever happened to be first in the list)
    // was how a version could end up filed under the wrong client. Anything
    // the caller does not send is inherited from the parent, so uploading a
    // counterparty redline needs nothing but the file.
    let parent: ParentContractDefaults | null = null;

    let versionNumber = 1;
    if (meta.parent_contract_id) {
      const { data: parentRow } = await db
        .from("contracts")
        .select("version_number, title, counterparty, contract_type, start_date, end_date, renewal_date, owner_name, contract_value, contract_status")
        .eq("id", meta.parent_contract_id)
        .eq("org_id", req.orgId!)
        .single();
      parent = (parentRow as ParentContractDefaults | null) ?? null;

      const { data: existing } = await db
        .from("contracts")
        .select("version_number")
        .eq("parent_contract_id", meta.parent_contract_id)
        .eq("org_id", req.orgId!)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();
      const maxVersion = Math.max(existing?.version_number ?? 1, parent?.version_number ?? 1);
      versionNumber = maxVersion + 1;
    }

    const contractType = req.body.contract_type
      ? contractTypeSchema.parse(req.body.contract_type)
      : contractTypeSchema.default("other").parse(parent?.contract_type ?? undefined);

    const inherit = <T>(sent: T | undefined | null, fromParent: T | null | undefined): T | null =>
      (sent ?? fromParent ?? null) as T | null;

    const fileId = randomUUID();
    const s3Key = buildS3Key(req.userId, fileId, req.file.originalname);

    // Extraction and storage are the two steps that fail on a *specific file* rather
    // than on a bug. Tag each failure so the user is told which one broke and what to
    // do about it — an anonymous 500 here is indistinguishable from the app being down,
    // and gives support nothing to act on.
    const [extractedText] = await Promise.all([
      extractText(req.file.buffer, req.file.mimetype).catch((err: unknown) => {
        const cause = err instanceof Error ? err.message : String(err);
        console.error(`upload: text extraction failed for ${req.file?.originalname} (${req.file?.mimetype}): ${cause}`);
        throw Object.assign(
          new Error(
            "Could not read text from this file. It may be password-protected, corrupted, " +
            "or saved in an unsupported format. Try re-saving it as a standard PDF or DOCX.",
          ),
          { status: 422 },
        );
      }),
      uploadToS3({ buffer: req.file.buffer, key: s3Key, mimeType: req.file.mimetype }).catch((err: unknown) => {
        const cause = err instanceof Error ? err.message : String(err);
        // AWS error *names* (AccessDenied, InvalidAccessKeyId, NoSuchBucket,
        // ExpiredToken…) are the whole diagnosis and carry no key material, so
        // include the name in the response. The message can echo request detail,
        // so it stays in the logs only.
        const awsCode = err instanceof Error ? err.name : "UnknownError";
        console.error(`upload: S3 put failed for key ${s3Key}: ${awsCode}: ${cause}`);
        throw Object.assign(
          new Error(`File storage is unavailable (${awsCode}). Please try again in a moment.`),
          { status: 502, expose: true },
        );
      }),
    ]);

    const { data, error } = await db
      .from("contracts")
      .insert({
        id: fileId,
        user_id: req.userId,
        org_id: req.orgId,
        filename: req.file.originalname,
        s3_key: s3Key,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        contract_type: contractType,
        status: "uploaded",
        extracted_text: extractedText,
        title: inherit(meta.title, parent?.title),
        counterparty: inherit(meta.counterparty, parent?.counterparty),
        start_date: inherit(meta.start_date, parent?.start_date),
        end_date: inherit(meta.end_date, parent?.end_date),
        renewal_date: inherit(meta.renewal_date, parent?.renewal_date),
        owner_name: inherit(meta.owner_name, parent?.owner_name),
        contract_value: inherit(meta.contract_value, parent?.contract_value),
        contract_status: meta.contract_status ?? parent?.contract_status ?? "draft",
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
        org_id: req.orgId,
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
      .eq("org_id", req.orgId!)
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
    const selectCols = "id, filename, title, counterparty, contract_type, contract_status, status, error_message, file_size, s3_key, summary, extracted_text, start_date, end_date, renewal_date, owner_name, contract_value, version_number, parent_contract_id, created_at, analyses(*), legal_intake(*)";

    let { data, error } = await db
      .from("contracts")
      .select(selectCols)
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .eq("org_id", req.orgId!)
      .single();

    if (error || !data) {
      // Not the owner — allow read access if this user is a named approver
      // on the contract's approval chain (matched by email, not a membership
      // table), but still scoped to the caller's own organization — an
      // approver can never read a contract belonging to a different org.
      const email = await getUserEmail(req.userId);
      if (email && await isApproverForContract(email, req.params.id)) {
        ({ data, error } = await db.from("contracts").select(selectCols).eq("id", req.params.id).eq("org_id", req.orgId!).single());
      }
    }

    if (error || !data) { res.status(404).json({ error: "Contract not found" }); return; }

    // Only hand back a URL that will actually resolve. Checking costs one HEAD,
    // bounded here so a slow or unreachable S3 degrades the page instead of
    // hanging it — a timeout is reported as "unavailable" (retryable), never as
    // "missing", which would wrongly tell the user their document is gone.
    const fileStatus = await withTimeout(
      getObjectAvailability(data.s3_key),
      3_000,
      "s3 availability check timed out",
    ).catch(() => "unavailable" as const);
    const fileUrl = fileStatus === "available" ? await getPresignedUrl(data.s3_key) : null;
    // Supabase returns analyses as a single object (not array) when contract_id has UNIQUE constraint.
    // Normalize to array so the frontend type AnalysisOut[] stays correct.
    const analyses = data.analyses
      ? (Array.isArray(data.analyses) ? data.analyses : [data.analyses])
      : [];
    res.json({ contract: { ...data, analyses, fileUrl, fileStatus } });
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
      .eq("org_id", req.orgId!)
      .single();

    if (!contract) { res.status(404).json({ error: "Contract not found" }); return; }

    const { data, error } = await db
      .from("legal_intake")
      .upsert({ ...body, contract_id: req.params.id, user_id: req.userId, org_id: req.orgId }, { onConflict: "contract_id" })
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
      .eq("org_id", req.orgId!)
      .single();

    if (error) { res.json({ intake: null }); return; }
    res.json({ intake: data });
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id/analysis-status
// Cheap polling target for a running analysis. Deliberately does NOT select
// extracted_text or the analysis payload — the client polls this every few
// seconds and only needs to know when to re-fetch the full contract.
contractsRouter.get("/:id/analysis-status", statusLimiter, async (req, res, next) => {
  try {
    const { data, error } = await db
      .from("contracts")
      .select("id, status, error_message, updated_at")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .eq("org_id", req.orgId!)
      .single();

    if (error || !data) { res.status(404).json({ error: "Contract not found" }); return; }

    // A "processing" row older than the wedge threshold means the function was
    // hard-killed mid-run and no catch ever fired. Report it as failed so the
    // client stops polling and offers a retry instead of spinning forever.
    let status = data.status as string;
    let errorMessage = data.error_message as string | null;
    if (status === "processing") {
      const startedMs = data.updated_at ? Date.parse(data.updated_at) : 0;
      if (Date.now() - startedMs >= STALE_PROCESSING_MS) {
        status = "failed";
        errorMessage = errorMessage ?? "Analysis stopped unexpectedly. Please try again.";
      }
    }

    res.json({ status, errorMessage, startedAt: data.updated_at });
  } catch (err) {
    next(err);
  }
});

// Runs the AI analysis and writes the result. Called in the background via
// waitUntil() — it owns the contract's terminal status, so every path must end
// with the row at "analyzed" or "failed", never left at "processing".
async function runAnalysis(opts: {
  userId: string;
  orgId: string;
  contractId: string;
  text: string;
  contractType: ContractType;
  intake: any;
  playbookText?: string;
  clauseLibrary: Array<{ title: string; clause_type: "approved" | "fallback" | "unacceptable"; content: string }>;
  playbooksUsed: string[];
}): Promise<void> {
  try {
    // Hard timeout so a slow run fails cleanly (→ status "failed", retryable)
    // rather than being hard-killed by the platform and left stuck "processing".
    // Fire before maxDuration (see vercel.json) so this catch still runs.
    const analysis = await withTimeout(
      analyzeContract(
        opts.text,
        opts.contractType,
        opts.intake,
        opts.playbookText,
        opts.clauseLibrary.length > 0 ? opts.clauseLibrary : undefined
      ),
      ANALYSIS_TIMEOUT_MS,
      "Analysis timed out — the contract is too large or complex to review in a single pass. Try again, or split the document."
    );

    const { data: saved, error: saveError } = await db
      .from("analyses")
      .upsert({
        contract_id: opts.contractId,
        user_id: opts.userId,
        org_id: opts.orgId,
        risk_level: analysis.riskLevel,
        risk_summary: analysis.riskSummary,
        clause_analysis: analysis.clauseAnalysis,
        negotiation_points: analysis.negotiationPoints,
        ambiguity_flags: analysis.ambiguityFlags ?? [],
        model: analysis.model,
        playbooks_used: opts.playbooksUsed,
      }, { onConflict: "contract_id" })
      .select("id")
      .single();

    if (saveError) throw saveError;

    const { error: analyzedErr } = await db.from("contracts")
      .update({ status: "analyzed", error_message: null })
      .eq("id", opts.contractId);
    if (analyzedErr) throw analyzedErr;

    await logActivity(opts.userId, "contract.analyzed", opts.contractId, {
      risk_level: analysis.riskLevel,
      analysis_id: saved.id,
    });
  } catch (err) {
    // Nobody is holding the response any more, so the only way the user learns
    // this failed is the row itself — record the reason for the status poll.
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error(`[analyze] contract ${opts.contractId} failed:`, err);
    await db.from("contracts")
      .update({ status: "failed", error_message: message })
      .eq("id", opts.contractId);
  }
}

// POST /api/contracts/:id/analyze
// Returns 202 immediately; the AI run continues in the background (waitUntil).
// Poll GET /:id/analysis-status for completion.
contractsRouter.post("/:id/analyze", analyzeLimiter, async (req, res, next) => {
  try {
    const { data: contract, error: fetchError } = await db
      .from("contracts")
      .select("id, user_id, contract_type, extracted_text, status, updated_at")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .eq("org_id", req.orgId!)
      .single();

    if (fetchError || !contract) { res.status(404).json({ error: "Contract not found" }); return; }
    if (!contract.extracted_text) { res.status(422).json({ error: "Contract text could not be extracted" }); return; }
    // Block a genuine in-flight analysis, but recover a WEDGED one: if the
    // serverless function was hard-killed mid-analysis (exceeded maxDuration),
    // the catch below never ran and status is stuck at "processing" forever.
    // Treat processing older than the timeout+grace as stale and allow re-run.
    if (contract.status === "processing") {
      const startedMs = contract.updated_at ? Date.parse(contract.updated_at) : 0;
      if (Date.now() - startedMs < STALE_PROCESSING_MS) {
        res.status(409).json({ error: "Analysis already in progress for this contract" }); return;
      }
      // else: previous run wedged — fall through and re-analyze
    }

    // Per-org monthly analysis cap — set by the super admin, NULL = unlimited.
    // Counts completed analyses this calendar month (successful runs only —
    // a failed run never inserts an `analyses` row, so it never counts against
    // the org's quota). Checked before doing any real work so a capped org
    // fails fast instead of burning an AI call it can't afford.
    const { data: orgRow } = await db
      .from("organizations")
      .select("monthly_analysis_cap")
      .eq("clerk_org_id", req.orgId!)
      .maybeSingle();
    const cap = orgRow?.monthly_analysis_cap ?? null;
    if (cap !== null) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count: usedThisMonth } = await db
        .from("analyses")
        .select("id", { count: "exact", head: true })
        .eq("org_id", req.orgId!)
        .gte("created_at", monthStart.toISOString());
      if ((usedThisMonth ?? 0) >= cap) {
        res.status(403).json({
          error: "Your organization has reached its monthly analysis limit. Contact your admin to raise it.",
          code: "monthly_analysis_cap_exceeded",
          cap,
          used: usedThisMonth ?? 0,
        });
        return;
      }
    }

    const { selectedRuleIds } = z.object({
      selectedRuleIds: z.array(z.string().uuid()).optional(),
    }).parse(req.body ?? {});

    const [intakeResult, clauseResult] = await Promise.all([
      db.from("legal_intake").select("*").eq("contract_id", contract.id).eq("org_id", req.orgId!).single(),
      db.from("clause_library").select("title, clause_type, content").eq("status", "approved").eq("org_id", req.orgId!).or(`user_id.eq.${req.userId},is_admin_managed.eq.true`),
    ]);
    const intake = intakeResult.data ?? null;
    const clauseLibrary = (clauseResult.data ?? []) as Array<{ title: string; clause_type: "approved" | "fallback" | "unacceptable"; content: string }>;

    let playbookText: string | undefined;
    const selectFields = "title, playbook_text, rules, jurisdiction";
    // Playbooks are admin-managed within the org (user_id = "admin") but selectable by any org member
    const ownerFilter = `user_id.eq.${req.userId},is_admin_managed.eq.true`;
    let ruleRows: any[] = [];

    if (selectedRuleIds === undefined) {
      // Auto-select: only playbooks matching the contract's jurisdiction (or jurisdiction-agnostic ones)
      const contractJurisdiction = intake?.jurisdiction ?? null;
      const r = await db.from("review_rules").select(selectFields).eq("org_id", req.orgId!).or(ownerFilter).eq("is_active", true);
      ruleRows = (r.data ?? []).filter((row: any) =>
        !row.jurisdiction || (contractJurisdiction && row.jurisdiction === contractJurisdiction)
      );
    } else if (selectedRuleIds.length > 0) {
      // Explicit selection is honoured as-is (user deliberately chose these playbooks)
      const r = await db.from("review_rules").select(selectFields).eq("org_id", req.orgId!).or(ownerFilter).eq("is_active", true).in("id", selectedRuleIds);
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

    // Stamp updated_at so the stale-processing recovery above can measure age.
    // Clear any error from a previous failed run so the poll can't read it as
    // the outcome of this one.
    const { error: processingErr } = await db.from("contracts")
      .update({ status: "processing", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", contract.id);
    if (processingErr) throw processingErr;

    // Detach the AI run from this request where the platform supports it: the
    // instance stays alive until the promise settles (up to maxDuration) with no
    // client connection held open. runAnalysis never rejects — it records its
    // own terminal status, which the client reads via /analysis-status.
    const job = runAnalysis({
      userId: req.userId!,
      orgId: req.orgId!,
      contractId: contract.id,
      text: contract.extracted_text,
      contractType: contract.contract_type as ContractType,
      intake,
      playbookText,
      clauseLibrary,
      playbooksUsed: ruleRows.map((r: any) => r.title).filter(Boolean),
    });

    const waitUntil = getWaitUntil();
    if (waitUntil) {
      waitUntil(job);
    } else {
      // No background support — finish before responding, or the process may be
      // torn down mid-analysis. The client polls either way, so the only
      // difference it sees is how long this call takes to return.
      await job;
    }

    res.status(202).json({ status: "processing" });
  } catch (err) {
    await db.from("contracts")
      .update({ status: "failed", error_message: err instanceof Error ? err.message : "Analysis failed" })
      .eq("id", req.params.id);
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
      .eq("org_id", req.orgId!)
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
        .eq("org_id", req.orgId!)
        .single(),
      db.from("redlines")
        .select("edits")
        .eq("contract_id", req.params.id)
        .eq("user_id", req.userId)
        .eq("org_id", req.orgId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const a = Array.isArray(data?.analyses) ? data.analyses[0] : data?.analyses;
    if (error || !data || !a) { res.status(404).json({ error: "Analysis not found" }); return; }

    const appliedParam = typeof req.query.applied === "string" ? req.query.applied : "";
    const appliedIds = appliedParam ? new Set(appliedParam.split(",").map(s => s.trim())) : undefined;
    const reviewer = typeof req.query.reviewer === "string" ? req.query.reviewer : undefined;

    // Pass cached redline edits so the export includes proper tracked changes
    const redlineEdits = Array.isArray(redlineData?.edits) ? redlineData.edits as ProcessedEdit[] : undefined;

    let buffer: Buffer | undefined;

    // Preferred path: edit the ORIGINAL .docx in place so all source formatting
    // (tables, styles, headers/footers, numbering) is preserved. Only falls back
    // to the rebuilt export when the source isn't a .docx or the file is corrupt —
    // never because findings couldn't be anchored (those become title comments).
    if (isDocxSource(data.filename, data.mime_type) && data.s3_key) {
      try {
        const original = await downloadFromS3(data.s3_key);
        const docxEdits = buildDocxEdits(redlineEdits, a.clause_analysis, appliedIds);
        const { buffer: edited } = editOriginalDocx(original, docxEdits, reviewer);
        buffer = edited;
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
      }, data.summary ?? undefined, data.created_at, data.extracted_text ?? undefined, appliedIds, redlineEdits, reviewer);
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
      .eq("org_id", req.orgId!)
      .single();

    const a = Array.isArray(data?.analyses) ? data.analyses[0] : data?.analyses;
    if (error || !data || !a) { res.status(404).json({ error: "Analysis not found" }); return; }

    const appliedParam = typeof req.query.applied === "string" ? req.query.applied : "";
    const appliedIds = appliedParam ? new Set(appliedParam.split(",").map(s => s.trim())) : undefined;
    const reviewer = typeof req.query.reviewer === "string" ? req.query.reviewer : undefined;

    const buffer = await exportToPdf(data.filename, data.contract_type, {
      riskLevel: a.risk_level,
      riskSummary: a.risk_summary,
      clauseAnalysis: a.clause_analysis,
      negotiationPoints: a.negotiation_points,
    }, data.summary ?? undefined, data.created_at, data.extracted_text ?? undefined, appliedIds, reviewer);

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
      .eq("org_id", req.orgId!)
      .single();

    if (contractError || !contract) { res.status(404).json({ error: "Contract not found" }); return; }
    if (!contract.extracted_text) { res.status(422).json({ error: "Contract text not available" }); return; }

    const { data: history } = await db
      .from("chat_messages")
      .select("role, content")
      .eq("contract_id", req.params.id)
      .eq("user_id", req.userId)
      .eq("org_id", req.orgId!)
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
      { contract_id: req.params.id, user_id: req.userId, org_id: req.orgId, role: "user", content: question },
      { contract_id: req.params.id, user_id: req.userId, org_id: req.orgId, role: "assistant", content: answer },
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
      .eq("org_id", req.orgId!)
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
      .eq("user_id", req.userId)
      .eq("org_id", req.orgId!);

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
      .eq("org_id", req.orgId!)
      .select("id, filename, title, counterparty, contract_type, contract_status, status, start_date, end_date, renewal_date, owner_name, contract_value, updated_at")
      .single();

    if (error || !data) { res.status(404).json({ error: "Contract not found" }); return; }

    await logActivity(req.userId, "contract.updated", req.params.id, body as Record<string, unknown>);
    res.json({ contract: data });
  } catch (err) {
    next(err);
  }
});

const redlineEditInputSchema = z.object({
  clause_ref: z.string(),
  original_text: z.string(),
  revised_text: z.string(),
  edit_type: z.enum(["replace", "insert", "delete"]),
  risk: z.enum(["High", "Medium", "Low"]),
  playbook_rule: z.string(),
  rationale: z.string(),
});

// POST /api/contracts/:id/redline
// If the caller supplies `edits` (the findings the user applied in the Review
// panel), redline ONLY those — no AI call. Omitting `edits` runs the AI over
// the whole contract (used by older clients / direct API callers).
contractsRouter.post("/:id/redline", analyzeLimiter, async (req, res, next) => {
  try {
    const { data: contract, error } = await db
      .from("contracts")
      .select("extracted_text, contract_type, legal_intake(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .eq("org_id", req.orgId!)
      .single();

    if (error || !contract) { res.status(404).json({ error: "Contract not found" }); return; }
    if (!contract.extracted_text) { res.status(422).json({ error: "Contract text not extracted yet" }); return; }

    const suppliedEdits = z.array(redlineEditInputSchema).safeParse(req.body?.edits);

    let edits: ReturnType<typeof redlineEditInputSchema.parse>[];
    let model: string;

    if (suppliedEdits.success && suppliedEdits.data.length > 0) {
      edits = suppliedEdits.data;
      model = "user-applied";
    } else {
      // Fetch active playbook rules + clause library in parallel
      const [{ data: ruleRows }, { data: clauseRows }] = await Promise.all([
        db.from("review_rules").select("title, playbook_text, rules").eq("org_id", req.orgId!).or(`user_id.eq.${req.userId},is_admin_managed.eq.true`).eq("is_active", true),
        db.from("clause_library").select("title, clause_type, content").eq("status", "approved").eq("org_id", req.orgId!).or(`user_id.eq.${req.userId},is_admin_managed.eq.true`),
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

      const aiResult = await redlineContract(
        contract.extracted_text,
        contract.contract_type as ContractType,
        intake,
        playbookText,
        clauseLibrary.length > 0 ? clauseLibrary : undefined,
      );
      edits = aiResult.edits;
      model = aiResult.model;
    }

    console.log(`[redline-route] ${model === "user-applied" ? "using applied" : "AI returned"}`, edits.length, "edits");
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
        .eq("user_id", req.userId)
        .eq("org_id", req.orgId!);
      await db.from("redlines").insert({
        contract_id: req.params.id,
        user_id: req.userId,
        org_id: req.orgId,
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
      .eq("org_id", req.orgId!)
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
    const reviewer = typeof req.body?.reviewer === "string" ? req.body.reviewer : undefined;

    const { data: contract, error } = await db
      .from("contracts")
      .select("filename, extracted_text, s3_key, mime_type")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .eq("org_id", req.orgId!)
      .single();

    if (error || !contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    let buffer: Buffer | undefined;

    // Preferred: apply the redline as tracked changes onto the ORIGINAL .docx,
    // preserving all source formatting. Only fall back to the rebuilt redline
    // doc when the source isn't a .docx or the file is corrupt.
    if (isDocxSource(contract.filename, contract.mime_type) && contract.s3_key) {
      try {
        const original = await downloadFromS3(contract.s3_key);
        const docxEdits = buildDocxEdits(edits, undefined);
        const { buffer: edited } = editOriginalDocx(original, docxEdits, reviewer);
        buffer = edited;
      } catch (e) {
        console.error("[redline/export/docx] in-place edit failed, falling back:", (e as Error)?.message);
      }
    }

    if (!buffer) {
      try {
        buffer = await exportRedlineDocx(contract.filename, contract.extracted_text ?? "", edits, reviewer);
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
      .eq("org_id", req.orgId!)
      .single();
    if (sErr || !self) { res.status(404).json({ error: "Contract not found" }); return; }

    // Family root: the parent if this is a child, else itself
    const rootId = self.parent_contract_id ?? self.id;
    const { data, error } = await db
      .from("contracts")
      .select("id, filename, title, version_number, contract_status, status, owner_name, created_at, parent_contract_id")
      .eq("user_id", req.userId)
      .eq("org_id", req.orgId!)
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
      .eq("org_id", req.orgId!)
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

    // ─── Clause-level comparison ─────────────────────────────────────────────
    // The text diff says which characters moved; this says which CLAUSES
    // deviate, match, or went missing — the three buckets a reviewer filters
    // on. Stored in `key_changes` (jsonb, already unconstrained) so this needs
    // no migration; a dedicated table is the cleaner home once this settles.
    // Best-effort: a failure here must not cost the user the text diff.
    let clauseResults: import("../services/clauseCompare.service.js").ClauseComparison[] = [];
    let clauseError: string | null = null;
    try {
      const { alignClauses } = await import("../services/clauseCompare.service.js");
      const [baseClauses, comparedClauses] = await Promise.all([
        extractClauseInventory(base.extracted_text, base.contract_type as ContractType),
        extractClauseInventory(compared.extracted_text, compared.contract_type as ContractType),
      ]);
      clauseResults = alignClauses(baseClauses, comparedClauses);
      // Only deviating pairs cost an AI call; identical and missing need none.
      const deviations = clauseResults.filter(c => c.status === "deviation");
      if (deviations.length > 0) {
        const explained = await summarizeClauseDifferences(deviations, base.contract_type as ContractType);
        const byKey = new Map(explained.map(e => [`${e.clauseType}|${e.baseSection ?? ""}`, e]));
        clauseResults = clauseResults.map(c =>
          c.status === "deviation" ? byKey.get(`${c.clauseType}|${c.baseSection ?? ""}`) ?? c : c);
      }
    } catch (e) {
      clauseError = (e as Error)?.message ?? String(e);
      console.error("[compare] clause comparison failed:", (e as Error)?.stack ?? e);
    }

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
    let summaryError: string | null = null;
    if (diffText.trim()) {
      try {
        const cs = await summarizeChanges(diffText, base.contract_type as ContractType);
        summary = cs.summary;
        keyChanges = cs.keyChanges;
        model = cs.model;
      } catch (e) {
        // A bare `catch {}` here hid a real, repeatable summarization failure
        // behind a generic message — the diff still rendered, so the outage
        // looked like a quirk rather than a bug. Log it, and carry the reason
        // out to the caller (not persisted) so it is diagnosable without
        // server-log access.
        summaryError = (e as Error)?.message ?? String(e);
        console.error("[compare] summarizeChanges failed:", (e as Error)?.stack ?? e);
        // Distinguish "the AI provider refused us" from "nothing changed". The
        // generic line sent people hunting for a diff bug when the real cause
        // was an exhausted Anthropic credit balance.
        const provider = /credit balance|quota|rate.?limit|429|invalid_request_error/i.test(summaryError)
          ? " The AI service rejected the request (billing or rate limit) — check the Anthropic account."
          : "";
        summary = `Automated change summary unavailable.${provider} The structural diff below is complete and unaffected.`;
      }
    } else {
      summary = "No substantive text differences detected between these two versions.";
    }

    const { data: saved, error: saveErr } = await db
      .from("contract_comparisons")
      .insert({
        user_id: req.userId,
        org_id: req.orgId,
        base_contract_id: base.id,
        compared_contract_id: compared.id,
        diff: diff.blocks,
        added_count: diff.added,
        deleted_count: diff.deleted,
        modified_count: diff.modified,
        summary,
        key_changes: clauseResults.length > 0 ? clauseResults : keyChanges,
        model,
      })
      .select()
      .single();
    if (saveErr) throw saveErr;

    await logActivity(req.userId, "contract.compared", base.id, {
      compared_contract_id: compared.id,
      added: diff.added, deleted: diff.deleted, modified: diff.modified,
    });

    res.json({
      comparison: saved,
      ...(summaryError ? { summary_error: summaryError } : {}),
      ...(clauseError ? { clause_error: clauseError } : {}),
    });
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
      .eq("org_id", req.orgId!)
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
      .eq("org_id", req.orgId!)
      .single();

    if (error || !data) { res.status(404).json({ error: "Contract not found" }); return; }

    await Promise.all([
      deleteFromS3(data.s3_key),
      db.from("contracts").delete().eq("id", req.params.id).eq("org_id", req.orgId!),
    ]);

    await logActivity(req.userId, "contract.deleted", null, { contract_id: req.params.id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
