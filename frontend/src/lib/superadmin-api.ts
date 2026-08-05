// Client for /superadmin/* — the platform-level tier above every organization.
// Auth is a separate bcrypt+JWT system (never Clerk) — see backend/adminAuth.ts.
// Scope is intentionally small: sign in, and manage the list of organizations.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface SuperAdminUser { email: string; name: string }

export interface SuperAdminStats {
  organizations: number;
  organizations_by_status: { status: "pending" | "active" | "suspended" | "deleted"; count: number }[];
}

export interface SystemInfo {
  status: "healthy" | "degraded";
  environment: string;
  services: {
    database: { provider: string; connected: boolean };
    storage:  { provider: string; bucket: string; region: string; configured: boolean };
    ai:       { provider: string; model: string; configured: boolean };
    auth:     { provider: string; configured: boolean };
    email:    { provider: string; configured: boolean };
  };
  secrets_managed_via: string;
  tables: { table: string; rows: number; ok: boolean }[];
}

export interface SuperAdminOrganization {
  id: string; clerk_org_id: string; name: string;
  status: "pending" | "active" | "suspended" | "deleted";
  onboarding_type: "self_serve" | "sales_assisted";
  approved_at: string | null; suspended_at: string | null; deleted_at: string | null;
  monthly_analysis_cap: number | null;
  contract_count: number; user_count: number;
  analyses_total: number; analyses_this_month: number;
  created_at: string;
}

export function getSuperAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("superadmin_token") ?? sessionStorage.getItem("superadmin_token");
}

export function setSuperAdminToken(token: string, remember = true) {
  clearSuperAdminToken();
  (remember ? localStorage : sessionStorage).setItem("superadmin_token", token);
}

export function clearSuperAdminToken() {
  localStorage.removeItem("superadmin_token");
  sessionStorage.removeItem("superadmin_token");
}

async function superAdminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getSuperAdminToken();
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

// Auth
export const superAdminLogin = (email: string, password: string) =>
  superAdminFetch<{ token: string; admin: SuperAdminUser }>("/superadmin/auth/login", {
    method: "POST", body: JSON.stringify({ email, password }),
  });

export const superAdminMe = () => superAdminFetch<{ email: string }>("/superadmin/auth/me");

export const superAdminForgotPassword = (email: string) =>
  superAdminFetch<{ ok: boolean }>("/superadmin/auth/forgot-password", {
    method: "POST", body: JSON.stringify({ email }),
  });

export const superAdminResetPassword = (email: string, code: string, password: string) =>
  superAdminFetch<{ token: string; admin: SuperAdminUser }>("/superadmin/auth/reset-password", {
    method: "POST", body: JSON.stringify({ email, code, password }),
  });

// Passwordless login — the login page uses this exclusively; the
// password/reset-password endpoints above stay in the API for emergency use
// but are no longer exposed in the UI.
export const requestSuperAdminOtp = (email: string) =>
  superAdminFetch<{ ok: boolean }>("/superadmin/auth/request-otp", {
    method: "POST", body: JSON.stringify({ email }),
  });

export const verifySuperAdminOtp = (email: string, code: string) =>
  superAdminFetch<{ token: string; admin: SuperAdminUser }>("/superadmin/auth/verify-otp", {
    method: "POST", body: JSON.stringify({ email, code }),
  });

// Stats + system (cross-org)
export const getSuperAdminStats = () => superAdminFetch<SuperAdminStats>("/superadmin/stats");
export const getSystemInfo = () => superAdminFetch<SystemInfo>("/superadmin/system");

// Organizations
export const listOrganizations = () =>
  superAdminFetch<{ organizations: SuperAdminOrganization[] }>("/superadmin/organizations");

export const createOrganization = (data: { name: string; admin_email: string }) =>
  superAdminFetch<{ organization: { clerk_org_id: string; name: string; status: string }; invitation: { id: string; email: string; status: string } }>(
    "/superadmin/organizations", { method: "POST", body: JSON.stringify(data) },
  );

export const approveOrganization = (id: string) =>
  superAdminFetch<{ ok: boolean }>(`/superadmin/organizations/${id}/approve`, { method: "POST" });

export const revokeOrganization = (id: string) =>
  superAdminFetch<{ ok: boolean }>(`/superadmin/organizations/${id}/revoke`, { method: "POST" });

export const restoreOrganization = (id: string) =>
  superAdminFetch<{ ok: boolean }>(`/superadmin/organizations/${id}/restore`, { method: "POST" });

export const deleteOrganization = (id: string) =>
  superAdminFetch<void>(`/superadmin/organizations/${id}`, { method: "DELETE" });

export const updateOrganizationCap = (id: string, monthly_analysis_cap: number | null) =>
  superAdminFetch<{ ok: boolean; organization: { id: string; monthly_analysis_cap: number | null } }>(
    `/superadmin/organizations/${id}/cap`, { method: "PATCH", body: JSON.stringify({ monthly_analysis_cap }) },
  );
