const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface AdminUser { email: string; name: string }

export interface AdminClient {
  id: string; name: string; industry: string | null;
  notes: string | null; status: string;
  member_count: number; contract_count: number;
  created_at: string; updated_at: string;
}

export interface AdminUserRow {
  clerk_user_id: string; email: string; client_ids: string[]; created_at: string;
}

export interface AdminClause {
  id: string; title: string; clause_type: string;
  content: string; tags: string[]; jurisdiction: string | null;
  contract_types: string[]; status: "draft" | "approved"; source: string | null; version: number;
  created_at: string;
}

export interface AdminPlaybook {
  id: string; name: string; description: string | null;
  is_active: boolean; original_filename: string | null; file_size: number | null; jurisdiction: string | null; created_at: string;
}

export interface AdminTicket {
  id: string; user_id: string; type: string;
  reference_id: string | null; reference_name: string | null;
  description: string; status: string; admin_notes: string | null;
  created_at: string; updated_at: string;
  users?: { email: string } | null;
}

export interface AdminStats {
  clients: number; contracts: number; users: number; open_tickets: number;
  charts: {
    uploads_per_month:   { month: string; count: number }[];
    risk_breakdown:      { risk: string; count: number }[];
    contracts_by_status: { status: string; count: number }[];
    contracts_by_type:   { type: string; count: number }[];
    tickets_by_status:   { status: string; count: number }[];
  };
}

export interface AdminContract {
  id: string; filename: string; contract_type: string; status: string;
  file_size: number; created_at: string; updated_at: string;
  client_name: string | null; user_email: string;
  risk_level: string | null; analyzed_at: string | null;
}

export interface AdminContractHistory {
  contract: {
    id: string; filename: string; contract_type: string; status: string;
    file_size: number; mime_type: string; summary: string | null;
    error_message: string | null; created_at: string; updated_at: string;
    client_name: string | null; user_email: string;
  };
  activity: { id: string; action: string; metadata: Record<string, unknown>; created_at: string }[];
  analysis: { risk_level: string; model: string; created_at: string } | null;
  chat_count: number;
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token") ?? sessionStorage.getItem("admin_token");
}

// remember=true persists across browser restarts; false lasts for the tab session only
export function setAdminToken(token: string, remember = true) {
  clearAdminToken();
  (remember ? localStorage : sessionStorage).setItem("admin_token", token);
}

export function clearAdminToken() {
  localStorage.removeItem("admin_token");
  sessionStorage.removeItem("admin_token");
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
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
export const adminLogin = (email: string, password: string) =>
  adminFetch<{ token: string; admin: AdminUser }>("/admin/auth/login", {
    method: "POST", body: JSON.stringify({ email, password }),
  });

export const adminMe = () => adminFetch<{ email: string }>("/admin/auth/me");

export const adminForgotPassword = (email: string) =>
  adminFetch<{ ok: boolean }>("/admin/auth/forgot-password", {
    method: "POST", body: JSON.stringify({ email }),
  });

export const adminResetPassword = (email: string, code: string, password: string) =>
  adminFetch<{ token: string; admin: AdminUser }>("/admin/auth/reset-password", {
    method: "POST", body: JSON.stringify({ email, code, password }),
  });

// Stats
export const getAdminStats = () => adminFetch<AdminStats>("/admin/stats");

// Clients
export const listAdminClients = () =>
  adminFetch<{ clients: AdminClient[] }>("/admin/clients");

export const createAdminClient = (data: { name: string; industry?: string; notes?: string }) =>
  adminFetch<{ client: AdminClient }>("/admin/clients", { method: "POST", body: JSON.stringify(data) });

export const updateAdminClient = (id: string, data: Partial<AdminClient>) =>
  adminFetch<{ client: AdminClient }>(`/admin/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteAdminClient = (id: string) =>
  adminFetch<void>(`/admin/clients/${id}`, { method: "DELETE" });

// Users
export const listAdminUsers = () => adminFetch<{ users: AdminUserRow[] }>("/admin/users");

export const getUserMemberships = (userId: string) =>
  adminFetch<{ memberships: { id: string; client_id: string; clients: AdminClient | null }[] }>(`/admin/users/${userId}/clients`);

export const assignUserToClient = (userId: string, clientId: string) =>
  adminFetch<{ membership: unknown }>(`/admin/users/${userId}/clients`, {
    method: "POST", body: JSON.stringify({ client_id: clientId }),
  });

export const removeUserFromClient = (userId: string, clientId: string) =>
  adminFetch<void>(`/admin/users/${userId}/clients/${clientId}`, { method: "DELETE" });

export const deleteAdminUser = (userId: string) =>
  adminFetch<void>(`/admin/users/${userId}`, { method: "DELETE" });

export const addUser = (data: { email: string; first_name?: string; last_name?: string }) =>
  adminFetch<{ ok: boolean; email_sent: boolean; user: { clerk_user_id: string; email: string; created_at: number } }>("/admin/users/add", {
    method: "POST", body: JSON.stringify(data),
  });

// Clauses
export const listAdminClauses = () => adminFetch<{ clauses: AdminClause[] }>("/admin/clauses");

export const createAdminClause = (data: Omit<AdminClause, "id" | "created_at" | "version">) =>
  adminFetch<{ clause: AdminClause }>("/admin/clauses", { method: "POST", body: JSON.stringify(data) });

export const updateAdminClause = (id: string, data: Partial<AdminClause>) =>
  adminFetch<{ clause: AdminClause }>(`/admin/clauses/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteAdminClause = (id: string) =>
  adminFetch<void>(`/admin/clauses/${id}`, { method: "DELETE" });

// Playbooks
export const listAdminPlaybooks = () => adminFetch<{ rules: AdminPlaybook[] }>("/admin/playbooks");

export const createAdminPlaybook = (data: { name: string; description?: string; is_active?: boolean; jurisdiction?: string | null; file: File }) => {
  const form = new FormData();
  form.append("file", data.file);
  form.append("name", data.name);
  if (data.description) form.append("description", data.description);
  if (data.jurisdiction) form.append("jurisdiction", data.jurisdiction);
  form.append("is_active", String(data.is_active ?? true));
  return adminFetch<{ rule: AdminPlaybook }>("/admin/playbooks", { method: "POST", body: form });
};

export const updateAdminPlaybook = (id: string, data: Partial<AdminPlaybook>) =>
  adminFetch<{ rule: AdminPlaybook }>(`/admin/playbooks/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteAdminPlaybook = (id: string) =>
  adminFetch<void>(`/admin/playbooks/${id}`, { method: "DELETE" });

// Contracts (global read-only overview)
export const listAdminContracts = () =>
  adminFetch<{ contracts: AdminContract[] }>("/admin/contracts");

export const getAdminContractHistory = (id: string) =>
  adminFetch<AdminContractHistory>(`/admin/contracts/${id}/history`);

// Per-tab formatted Excel reports (auth header required, so fetch as blob)
export async function downloadAdminReport(kind: "dashboard" | "contracts"): Promise<void> {
  const token = getAdminToken();
  const res = await fetch(`${API_URL}/admin/report/${kind}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Report download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contralyne-${kind}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Tickets
export const listAdminTickets = (status?: string) =>
  adminFetch<{ tickets: AdminTicket[] }>(`/admin/tickets${status ? `?status=${status}` : ""}`);

export const updateAdminTicket = (id: string, data: { status?: string; admin_notes?: string }) =>
  adminFetch<{ ticket: AdminTicket; email_sent: boolean }>(`/admin/tickets/${id}`, { method: "PATCH", body: JSON.stringify(data) });

// System / architecture overview
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

export const getSystemInfo = () => adminFetch<SystemInfo>("/admin/system");
