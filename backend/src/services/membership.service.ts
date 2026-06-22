import { db } from "../db.js";

/** Returns all client IDs the given Clerk user is assigned to. */
export async function getUserClientIds(userId: string): Promise<string[]> {
  const { data } = await db
    .from("client_memberships")
    .select("client_id")
    .eq("user_id", userId);
  return (data ?? []).map((r: any) => r.client_id as string);
}

/** Returns true if the user is a member of the given client. */
export async function userHasClientAccess(userId: string, clientId: string): Promise<boolean> {
  const { data } = await db
    .from("client_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .single();
  return !!data;
}
