import { db } from "../db.js";

/** Returns all client IDs the given Clerk user is assigned to, within their organization. */
export async function getUserClientIds(userId: string, orgId: string): Promise<string[]> {
  const { data } = await db
    .from("client_memberships")
    .select("client_id")
    .eq("user_id", userId)
    .eq("org_id", orgId);
  return (data ?? []).map((r: any) => r.client_id as string);
}

/** Returns true if the user is a member of the given client, within their organization. */
export async function userHasClientAccess(userId: string, clientId: string, orgId: string): Promise<boolean> {
  const { data } = await db
    .from("client_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("org_id", orgId)
    .maybeSingle();
  return !!data;
}
