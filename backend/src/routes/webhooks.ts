// Clerk webhook handler — keeps the users table in sync with Clerk.
//
// Events handled:
//   user.created  → upsert row in users table
//   user.updated  → update email if changed
//   user.deleted  → delete user data (mirrors the GDPR hard-delete in account.ts)
//
// Setup in Clerk Dashboard → Webhooks → Add Endpoint:
//   URL: https://api.contralyne.com/api/webhooks/clerk
//   Events: user.created, user.updated, user.deleted
//   Copy the Signing Secret → set as CLERK_WEBHOOK_SECRET env var in Vercel

import { Router, type Request, type Response } from "express";
import { Webhook } from "svix";
import { db } from "../db.js";
import { config } from "../config.js";
import { deleteFromS3 } from "../services/storage.service.js";

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

        await db.from("users").upsert(
          { clerk_user_id: clerkUserId, email },
          { onConflict: "clerk_user_id" },
        );

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
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[webhook/clerk] error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  },
);
