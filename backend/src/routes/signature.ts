import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { downloadFromS3 } from "../services/storage.service.js";
import { logActivity } from "../services/activity.service.js";
import {
  isDocuSignConfigured, createAndSendEnvelope, getEnvelopeStatus,
  type SignatureParty,
} from "../services/docusign.service.js";

// DocuSign e-signature — submitted once a contract's approval chain completes.
// Mounted at /api/contracts alongside contractsRouter (paths don't overlap).
export const signatureRouter = Router();
signatureRouter.use(requireAuth);

const partySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
});

const submitSchema = z.object({
  parties: z.array(partySchema).min(2, "At least two signing parties are required"),
});

// POST /api/contracts/:id/signature — send a new envelope
signatureRouter.post("/:id/signature", async (req, res, next) => {
  try {
    if (!isDocuSignConfigured()) {
      res.status(503).json({ error: "DocuSign is not configured on the server. Contact your developer." });
      return;
    }

    const body = submitSchema.parse(req.body);

    const { data: contract, error } = await db
      .from("contracts")
      .select("id, filename, title, contract_status, s3_key, mime_type")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .single();
    if (error || !contract) { res.status(404).json({ error: "Contract not found" }); return; }

    if (contract.contract_status !== "approved") {
      res.status(409).json({ error: "This contract must complete its approval chain before it can be sent for signature" });
      return;
    }

    const documentBuffer = await downloadFromS3(contract.s3_key);
    const documentName = contract.title || contract.filename;

    const { envelopeId, status } = await createAndSendEnvelope({
      documentBuffer,
      documentName,
      mimeType: contract.mime_type,
      parties: body.parties,
    });

    const parties = body.parties.map((p: SignatureParty, i: number) => ({
      name: p.name,
      email: p.email,
      routing_order: i + 1,
      status: "sent",
      signed_at: null,
    }));

    const { data: request, error: insertErr } = await db
      .from("signature_requests")
      .insert({
        contract_id: req.params.id,
        user_id: req.userId,
        status,
        docusign_envelope_id: envelopeId,
        parties,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    await logActivity(req.userId, "signature.requested", req.params.id, {
      envelope_id: envelopeId,
      parties: body.parties.map((p: SignatureParty) => p.email),
    });

    res.status(201).json({ request });
  } catch (err: any) {
    // Surface DocuSign's own error text instead of a generic 500 where possible.
    // docusign-esign rejects REST errors as raw axios errors — the parsed JSON
    // body lives at err.response.data, not err.response.body (that remap only
    // happens on the success path — see docusign.service.ts's getAuthenticatedApiClient).
    const dsMessage = err?.response?.data?.message ?? err?.message;
    if (err?.response?.data) { res.status(502).json({ error: `DocuSign error: ${dsMessage ?? "request failed"}` }); return; }
    next(err);
  }
});

// GET /api/contracts/:id/signature — latest request + live per-party status
signatureRouter.get("/:id/signature", async (req, res, next) => {
  try {
    const { data: contract } = await db
      .from("contracts")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .maybeSingle();
    if (!contract) { res.status(404).json({ error: "Contract not found" }); return; }

    const { data: request, error } = await db
      .from("signature_requests")
      .select("*")
      .eq("contract_id", req.params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!request) { res.json({ request: null }); return; }

    // Best-effort live refresh — DocuSign is the source of truth for status,
    // but a transient API hiccup shouldn't hide the last-known state from the user.
    if (isDocuSignConfigured() && request.docusign_envelope_id && request.status !== "completed" && request.status !== "voided") {
      try {
        const live = await getEnvelopeStatus(request.docusign_envelope_id);
        const parties = live.recipients.map((r) => ({
          name: r.name, email: r.email, routing_order: r.routing_order,
          status: r.status, signed_at: r.signed_at,
        }));
        const { data: updated } = await db
          .from("signature_requests")
          .update({ status: live.status, parties, updated_at: new Date().toISOString() })
          .eq("id", request.id)
          .select()
          .single();
        res.json({ request: updated ?? request });
        return;
      } catch (err) {
        console.error("[signature] live status refresh failed for", request.docusign_envelope_id, err);
      }
    }

    res.json({ request });
  } catch (err) { next(err); }
});
