const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type OrgStatus = "no_organization" | "pending" | "active" | "suspended" | "deleted";

export interface OrgMe {
  name: string | null;
  status: OrgStatus;
  role: string | null;
}

async function orgFetch<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Used by OrgGate (every route under (dashboard)) and /admin/layout.tsx to
// resolve the caller's organization status + role before rendering anything.
export const getOrgMe = (token: string | null) => orgFetch<OrgMe>("/api/org/me", token);
