import { db } from "../db.js";

export async function logActivity(
  userId: string,
  action: string,
  contractId?: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await db.from("activity_logs").insert({
    user_id: userId,
    action,
    contract_id: contractId ?? null,
    metadata,
  });
}
