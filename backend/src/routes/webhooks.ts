// Clerk webhook handler — keeps the users + organizations tables in sync with Clerk.
//
// Events handled:
//   user.created         → upsert row in users table
//   user.updated         → update email if changed
//   user.deleted         → delete user data (mirrors the GDPR hard-delete in account.ts)
//   organization.created → upsert row in organizations table (pending unless
//                          sales-assisted — see the onboarding_type metadata note below)
//   organization.updated → sync name
//   organization.deleted → safety-net cascade delete of every org-scoped row
//                          (mirrors user.deleted), for the case an org is
//                          removed directly from the Clerk Dashboard rather
//                          than through POST /admin/organizations/:id
//
// Setup in Clerk Dashboard → Webhooks → Add Endpoint:
//   URL: https://api.contralyne.com/api/webhooks/clerk
//   Events: user.created, user.updated, user.deleted,
//           organization.created, organization.updated, organization.deleted
//   Copy the Signing Secret → set as CLERK_WEBHOOK_SECRET env var in Vercel

import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { Webhook } from "svix";
import { db } from "../db.js";
import { config } from "../config.js";
import { deleteFromS3 } from "../services/storage.service.js";
import { cascadeDeleteOrganizationData } from "../services/organization.service.js";

export const webhooksRouter = Router();

// Must use raw body for svix signature verification — do NOT apply express.json() before this route.
webhooksRouter.post(
  "/clerk",
  // Read raw body
  (req, res, next) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => { (req as any).rawBody = data; next(); });
  },
  async (req: Request, res: Response) => {
    const secret = config.CLERK_WEBHOOK_SECRET;

    if (!secret) {
      // Webhook secret not configured — skip verification in dev, reject in prod
      if (config.NODE_ENV === "production") {
        res.status(500).json({ error: "CLERK_WEBHOOK_SECRET not configured" });
        return;
      }
    }

    // Verify signature
    if (secret) {
      const wh = new Webhook(secret);
      try {
        wh.verify((req as any).rawBody, {
          "svix-id":        req.headers["svix-id"] as string,
          "svix-timestamp": req.headers["svix-timestamp"] as string,
          "svix-signature": req.headers["svix-signature"] as string,
        });
      } catch {
        res.status(400).json({ error: "Invalid webhook signature" });
        return;
      }
    }

    let payload: any;
    try {
      payload = JSON.parse((req as any).rawBody);
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    const { type, data } = payload;
    const clerkUserId: string = data?.id;
    const email: string =
      data?.email_addresses?.[0]?.email_address ?? data?.primary_email_address ?? "";

    try {
      if (type === "user.created" || type === "user.updated") {
        if (!clerkUserId || !email) {
          res.status(200).json({ skipped: "missing id or email" });
          return;
        }

        const { error: e0 } = await db.from("users").upsert(
          { clerk_user_id: clerkUserId, email },
          { onConflict: "clerk_user_id" },
        );
        if (e0) console.error("[webhooks] db write failed:", e0.message, e0.code ?? "");

      } else if (type === "user.deleted") {
        if (!clerkUserId) {
          res.status(200).json({ skipped: "missing id" });
          return;
        }

        // Fetch all S3 keys for this user's contracts before deleting
        const { data: contracts } = await db
          .from("contracts")
          .select("s3_key")
          .eq("user_id", clerkUserId);

        // Delete S3 files
        if (contracts && contracts.length > 0) {
          await Promise.allSettled(contracts.map(c => deleteFromS3(c.s3_key)));
        }

        // Hard-delete all user data (cascades via FK or explicit deletes)
        await Promise.all([
          db.from("contracts").delete().eq("user_id", clerkUserId),
          db.from("clause_library").delete().eq("user_id", clerkUserId),
          db.from("review_rules").delete().eq("user_id", clerkUserId),
          db.from("activity_logs").delete().eq("user_id", clerkUserId),
          db.from("chat_messages").delete().eq("user_id", clerkUserId),
          db.from("users").delete().eq("clerk_user_id", clerkUserId),
        ]);

      } else if (type === "organization.created") {
        const clerkOrgId: string = data?.id;
        const name: string = data?.name ?? "";
        if (!clerkOrgId || !name) {
          res.status(200).json({ skipped: "missing id or name" });
          return;
        }

        // The metadata flag IS the entire approval-gate mechanism: only
        // POST /admin/organizations sets onboarding_type: "sales_assisted"
        // (pre-vetted by the super admin, goes live immediately). An org
        // created client-side via <CreateOrganization/> never sets it, so
        // it defaults to self_serve → pending until approved.
        const onboardingType = data?.public_metadata?.onboarding_type === "sales_assisted"
          ? "sales_assisted" : "self_serve";
        const status = onboardingType === "sales_assisted" ? "active" : "pending";

        const { error: e1 } = await db.from("organizations").upsert(
          {
            clerk_org_id: clerkOrgId,
            name,
            status,
            onboarding_type: onboardingType,
            ...(status === "active"
              ? { approved_at: new Date().toISOString(), approved_by: "system:sales-assisted" }
              : {}),
          },
          { onConflict: "clerk_org_id", ignoreDuplicates: true },
        );
        if (e1) console.error("[webhooks] db write failed:", e1.message, e1.code ?? "");

      } else if (type === "organization.updated") {
        const clerkOrgId: string = data?.id;
        const name: string = data?.name ?? "";
        if (!clerkOrgId || !name) {
          res.status(200).json({ skipped: "missing id or name" });
          return;
        }
        const { error: e2 } = await db.from("organizations").update({ name, updated_at: new Date().toISOString() }).eq("clerk_org_id", clerkOrgId);
        if (e2) console.error("[webhooks] db write failed:", e2.message, e2.code ?? "");

      } else if (type === "organization.deleted") {
        const clerkOrgId: string = data?.id;
        if (!clerkOrgId) {
          res.status(200).json({ skipped: "missing id" });
          return;
        }

        // Idempotent safety net: if POST /admin/organizations/:id/delete already
        // ran this cascade, this re-runs against already-empty tables — harmless.
        await cascadeDeleteOrganizationData(clerkOrgId);

        // Keep the organizations row itself (marked, not removed) — a minimal
        // audit trail of "this firm existed and was deleted", holding zero
        // contract content or PII beyond a name.
        const { error: e3 } = await db.from("organizations")
          .update({ status: "deleted", deleted_at: new Date().toISOString() })
          .eq("clerk_org_id", clerkOrgId);
        if (e3) console.error("[webhooks] db write failed:", e3.message, e3.code ?? "");
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[webhook/clerk] error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  },
);

// DocuSign Connect webhook — reconciles envelope/recipient status as signers
// act, so the app doesn't rely solely on-demand polling in GET .../signature.
// Setup in DocuSign Admin → Connect → Add Configuration:
//   URL: https://api.contralyne.com/api/webhooks/docusign
//   Events: Envelope Sent, Delivered, Completed, Declined, Voided
//   Include HMAC signature, secret → DOCUSIGN_WEBHOOK_SECRET env var
webhooksRouter.post(
  "/docusign",
  (req, res, next) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => { (req as any).rawBody = data; next(); });
  },
  async (req: Request, res: Response) => {
    const secret = config.DOCUSIGN_WEBHOOK_SECRET;

    if (secret) {
      const signature = req.headers["x-docusign-signature-1"] as string | undefined;
      const expected = crypto.createHmac("sha256", secret).update((req as any).rawBody).digest("base64");
      if (!signature || signature !== expected) {
        res.status(400).json({ error: "Invalid webhook signature" });
        return;
      }
    } else if (config.NODE_ENV === "production") {
      res.status(500).json({ error: "DOCUSIGN_WEBHOOK_SECRET not configured" });
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse((req as any).rawBody);
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    try {
      const envelopeId: string | undefined = payload?.data?.envelopeId ?? payload?.envelopeId;
      const status: string | undefined = payload?.data?.envelopeSummary?.status ?? payload?.status;
      if (!envelopeId || !status) {
        res.status(200).json({ skipped: "missing envelopeId or status" });
        return;
      }

      const recipients = payload?.data?.envelopeSummary?.recipients?.signers as any[] | undefined;
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (recipients) {
        updates.parties = recipients.map(r => ({
          name: r.name, email: r.email, routing_order: Number(r.routingOrder ?? 1),
          status: r.status, signed_at: r.signedDateTime ?? null,
        }));
      }

      const { error: e4 } = await db.from("signature_requests").update(updates).eq("docusign_envelope_id", envelopeId);
      if (e4) console.error("[webhooks] db write failed:", e4.message, e4.code ?? "");

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[webhook/docusign] error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  },
);
