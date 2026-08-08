import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { deleteFromS3 } from "../services/storage.service.js";

export const accountRouter = Router();
accountRouter.use(requireAuth);

// DELETE /api/account — GDPR: hard-delete all user data
accountRouter.delete("/", async (req, res, next) => {
  try {
    const userId = req.userId;

    // Fetch all S3 keys before deleting DB rows
    const { data: contracts } = await db
      .from("contracts")
      .select("s3_key")
      .eq("user_id", userId);

    // Delete S3 objects in parallel (best-effort — don't block on failures)
    if (contracts && contracts.length > 0) {
      await Promise.allSettled(contracts.map((c) => deleteFromS3(c.s3_key)));
    }

    // Delete all user data from DB — cascade handles child rows.
    //
    // Every one of these MUST be checked. supabase-js resolves with { error }
    // rather than throwing, so the previous fire-and-forget calls could each
    // fail while this endpoint still returned 204 — telling a user their data
    // was erased under GDPR when some of it was still there. A deletion that
    // silently half-completes is worse than one that fails loudly.
    const tables = [
      "contracts", "analyses", "legal_intake", "chat_messages",
      "activity_logs", "review_rules", "clause_library",
    ] as const;

    const failed: string[] = [];
    for (const table of tables) {
      const { error } = await db.from(table).delete().eq("user_id", userId);
      if (error) {
        console.error(`[account.delete] ${table} delete failed for ${userId}:`, error.message, error.code ?? "");
        failed.push(table);
      }
    }

    if (failed.length > 0) {
      res.status(500).json({
        error: `Account deletion incomplete — ${failed.join(", ")} could not be erased. Nothing further was removed; please retry or contact support.`,
        code: "deletion_incomplete",
        tables: failed,
      });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
