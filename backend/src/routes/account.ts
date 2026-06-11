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

    // Delete all user data from DB — cascade handles child rows
    await db.from("contracts").delete().eq("user_id", userId);
    await db.from("analyses").delete().eq("user_id", userId);
    await db.from("legal_intake").delete().eq("user_id", userId);
    await db.from("chat_messages").delete().eq("user_id", userId);
    await db.from("activity_logs").delete().eq("user_id", userId);
    await db.from("review_rules").delete().eq("user_id", userId);
    await db.from("clause_library").delete().eq("user_id", userId);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
