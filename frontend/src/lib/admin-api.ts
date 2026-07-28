// Client for /api/org/* — the per-organization admin panel (frontend/src/app/admin/**).
// Every firm gets this same panel, scoped to its own org via Clerk's org_id
// claim on the session token. Auth is Clerk (not the separate superadmin
// bcrypt/JWT system) — token is read imperatively from window.Clerk so this
// module can keep the same plain-function shape used throughout the app,
// without every call site needing to thread a token through React hooks.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

declare global {
  interface Window {
    Clerk?: { session?: { getToken: () => Promise<string | null> } | null };
  }
}

async function getClerkToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return (await window.Clerk?.session?.getToken()) ?? null;
}

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

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getClerkToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}/api/org${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Stats
export const getAdminStats = () => adminFetch<AdminStats>("/stats");

// Clients
export const listAdminClients = () =>
  adminFetch<{ clients: AdminClient[] }>("/clients");

export const createAdminClient = (data: { name: string; industry?: string; notes?: string }) =>
  adminFetch<{ client: AdminClient }>("/clients", { method: "POST", body: JSON.stringify(data) });

export const updateAdminClient = (id: string, data: Partial<AdminClient>) =>
  adminFetch<{ client: AdminClient }>(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteAdminClient = (id: string) =>
  adminFetch<void>(`/clients/${id}`, { method: "DELETE" });

// Users
export const listAdminUsers = () => adminFetch<{ users: AdminUserRow[] }>("/users");

export const getUserMemberships = (userId: string) =>
  adminFetch<{ memberships: { id: string; client_id: string; clients: AdminClient | null }[] }>(`/users/${userId}/clients`);

export const assignUserToClient = (userId: string, clientId: string) =>
  adminFetch<{ membership: unknown }>(`/users/${userId}/clients`, {
    method: "POST", body: JSON.stringify({ client_id: clientId }),
  });

export const removeUserFromClient = (userId: string, clientId: string) =>
  adminFetch<void>(`/users/${userId}/clients/${clientId}`, { method: "DELETE" });

export const deleteAdminUser = (userId: string) =>
  adminFetch<void>(`/users/${userId}`, { method: "DELETE" });

export const addUser = (data: { email: string; first_name?: string; last_name?: string }) =>
  adminFetch<{ ok: boolean; email_sent: boolean; user: { clerk_user_id: string; email: string; created_at: number } }>("/users/add", {
    method: "POST", body: JSON.stringify(data),
  });

// Clauses
export const listAdminClauses = () => adminFetch<{ clauses: AdminClause[] }>("/clauses");

export const createAdminClause = (data: Omit<AdminClause, "id" | "created_at" | "version">) =>
  adminFetch<{ clause: AdminClause }>("/clauses", { method: "POST", body: JSON.stringify(data) });

export const updateAdminClause = (id: string, data: Partial<AdminClause>) =>
  adminFetch<{ clause: AdminClause }>(`/clauses/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteAdminClause = (id: string) =>
  adminFetch<void>(`/clauses/${id}`, { method: "DELETE" });

// Playbooks
export const listAdminPlaybooks = () => adminFetch<{ rules: AdminPlaybook[] }>("/playbooks");

export const createAdminPlaybook = (data: { name: string; description?: string; is_active?: boolean; jurisdiction?: string | null; file: File }) => {
  const form = new FormData();
  form.append("file", data.file);
  form.append("name", data.name);
  if (data.description) form.append("description", data.description);
  if (data.jurisdiction) form.append("jurisdiction", data.jurisdiction);
  form.append("is_active", String(data.is_active ?? true));
  return adminFetch<{ rule: AdminPlaybook }>("/playbooks", { method: "POST", body: form });
};

export const updateAdminPlaybook = (id: string, data: Partial<AdminPlaybook>) =>
  adminFetch<{ rule: AdminPlaybook }>(`/playbooks/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteAdminPlaybook = (id: string) =>
  adminFetch<void>(`/playbooks/${id}`, { method: "DELETE" });

// Tasks (admin assigns work to users)
export interface AdminTask {
  id: string; user_id: string; user_email: string;
  title: string; notes: string;
  priority: "low" | "medium" | "high";
  due_date: string | null; done: boolean;
  contract_id: string | null; assignee: string | null;
  attachment_filename: string | null;
  attachment_mime_type: string | null;
  attachment_size: number | null;
  created_at: string;
}

export const listAdminTasks = () => adminFetch<{ tasks: AdminTask[] }>("/tasks");

export const createAdminTask = (data: {
  user_id: string; title: string; notes?: string;
  priority?: "low" | "medium" | "high"; due_date?: string | null;
  file?: File;
}) => {
  const form = new FormData();
  form.append("user_id", data.user_id);
  form.append("title", data.title);
  if (data.notes) form.append("notes", data.notes);
  form.append("priority", data.priority ?? "medium");
  if (data.due_date) form.append("due_date", data.due_date);
  if (data.file) form.append("file", data.file);
  return adminFetch<{ task: AdminTask; email_sent: boolean }>("/tasks/with-attachment", {
    method: "POST", body: form,
  });
};

export const deleteAdminTask = (id: string) =>
  adminFetch<void>(`/tasks/${id}`, { method: "DELETE" });

// Contracts (org-scoped, read-only overview)
export const listAdminContracts = () =>
  adminFetch<{ contracts: AdminContract[] }>("/contracts");

export const getAdminContractHistory = (id: string) =>
  adminFetch<AdminContractHistory>(`/contracts/${id}/history`);

// Billing (billable-work totals + Excel export)
export interface AdminBillingUser {
  user_id: string; user_email: string; entries: number; total_mins: number; total_hours: number;
  last_entry_at: string | null;
}

export const listAdminBilling = () => adminFetch<{ users: AdminBillingUser[] }>("/billing");

export async function downloadAdminBillingReport(userId?: string): Promise<void> {
  const token = await getClerkToken();
  const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
  const res = await fetch(`${API_URL}/api/org/billing/report${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Billing report download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const suffix = userId ? `-${userId}` : "-all-users";
  a.download = `contralyne-billing-report${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Per-tab formatted Excel reports (auth header required, so fetch as blob)
export async function downloadAdminReport(kind: "dashboard" | "contracts"): Promise<void> {
  const token = await getClerkToken();
  const res = await fetch(`${API_URL}/api/org/report/${kind}`, {
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
  adminFetch<{ tickets: AdminTicket[] }>(`/tickets${status ? `?status=${status}` : ""}`);

export const updateAdminTicket = (id: string, data: { status?: string; admin_notes?: string }) =>
  adminFetch<{ ticket: AdminTicket; email_sent: boolean }>(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify(data) });
