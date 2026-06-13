import type {
  ContractType,
  RiskLevel,
  ContractStatus,
  RiskSummaryItem,
  ClauseAnalysisItem,
  NegotiationPoint,
  AmbiguityFlag,
} from "@/lib/types";

// ─── Clause types ─────────────────────────────────────────────────────────────

export interface Clause {
  id: string;
  user_id: string;
  title: string;
  clause_type: "approved" | "fallback";
  jurisdiction: string | null;
  content: string;
  tags: string[];
  created_at: string;
}

// ─── Review rule / Playbook types ────────────────────────────────────────────

export interface ReviewRule {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_active: boolean;
  original_filename?: string | null;
  file_size?: number | null;
  created_at: string;
}

// ─── Analytics types ──────────────────────────────────────────────────────────

export interface AnalyticsData {
  totals: {
    total: number;
    analyzed: number;
    high_risk: number;
    pending: number;
  };
  by_status: { status: ContractStatus; count: number }[];
  by_type: { contract_type: ContractType; count: number }[];
  by_risk: { risk_level: RiskLevel; count: number }[];
  uploads_per_month: { month: string; count: number }[];
  recent_activity: {
    id: string;
    action: string;
    entity_type: string;
    created_at: string;
  }[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Response types ──────────────────────────────────────────────────────────

export interface AnalysisOut {
  id: string;
  contract_id: string;
  user_id: string;
  risk_level: RiskLevel;
  risk_summary: RiskSummaryItem[];
  clause_analysis: ClauseAnalysisItem[];
  negotiation_points: NegotiationPoint[];
  ambiguity_flags?: AmbiguityFlag[];
  model: string;
  created_at: string;
}

export interface ContractListItem {
  id: string;
  filename: string;
  contract_type: ContractType;
  status: ContractStatus;
  file_size: number;
  created_at: string;
  analyses: { id: string; risk_level: RiskLevel }[];
}

export interface ContractDetail {
  id: string;
  filename: string;
  contract_type: ContractType;
  status: ContractStatus;
  file_size: number;
  s3_key: string;
  created_at: string;
  fileUrl: string;
  extracted_text?: string | null;
  summary?: string | null;
  analyses: AnalysisOut[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  token: string | null,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Contract endpoints ───────────────────────────────────────────────────────

export async function uploadContract(
  token: string | null,
  file: File,
  contractType: ContractType
): Promise<{ contract: { id: string; filename: string; contract_type: ContractType; status: ContractStatus; created_at: string } }> {
  const form = new FormData();
  form.append("file", file);
  form.append("contract_type", contractType);

  return apiFetch("/api/contracts/upload", token, { method: "POST", body: form });
}

export async function analyzeContract(
  token: string | null,
  id: string,
  selectedRuleIds?: string[]
): Promise<{ analysisId: string; status: string }> {
  return apiFetch(`/api/contracts/${id}/analyze`, token, {
    method: "POST",
    body: JSON.stringify(selectedRuleIds !== undefined ? { selectedRuleIds } : {}),
  });
}

export async function listContracts(
  token: string | null
): Promise<{ contracts: ContractListItem[] }> {
  return apiFetch("/api/contracts", token);
}

export async function getContract(
  token: string | null,
  id: string
): Promise<{ contract: ContractDetail }> {
  return apiFetch(`/api/contracts/${id}`, token);
}

export async function deleteContract(token: string | null, id: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/contracts/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete contract");
}

// ─── Export endpoints ─────────────────────────────────────────────────────────

export async function downloadExport(
  token: string | null,
  id: string,
  format: "pdf" | "docx",
  filename: string
): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/contracts/${id}/export/${format}`, { headers });
  if (!res.ok) throw new Error("Export failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/\.[^.]+$/, "")}-review.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Chat endpoints ───────────────────────────────────────────────────────────

export async function getChatHistory(
  token: string | null,
  contractId: string
): Promise<{ messages: ChatMessage[] }> {
  return apiFetch(`/api/contracts/${contractId}/chat`, token);
}

export async function sendChatMessage(
  token: string | null,
  contractId: string,
  question: string
): Promise<{ answer: string }> {
  return apiFetch(`/api/contracts/${contractId}/chat`, token, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export async function clearChatHistory(token: string | null, contractId: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/contracts/${contractId}/chat`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to clear chat");
}

// ─── Clause endpoints ─────────────────────────────────────────────────────────

export async function listClauses(token: string | null): Promise<{ clauses: Clause[] }> {
  return apiFetch("/api/clauses", token);
}

export async function createClause(
  token: string | null,
  data: Pick<Clause, "title" | "clause_type" | "jurisdiction" | "content" | "tags">
): Promise<{ clause: Clause }> {
  return apiFetch("/api/clauses", token, { method: "POST", body: JSON.stringify(data) });
}

export async function updateClause(
  token: string | null,
  id: string,
  data: Partial<Pick<Clause, "title" | "clause_type" | "jurisdiction" | "content" | "tags">>
): Promise<{ clause: Clause }> {
  return apiFetch(`/api/clauses/${id}`, token, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteClause(token: string | null, id: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/clauses/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete clause");
}

// ─── Review rule endpoints ────────────────────────────────────────────────────

export async function listRules(token: string | null): Promise<{ rules: ReviewRule[] }> {
  return apiFetch("/api/rules", token);
}

export async function createRule(
  token: string | null,
  data: { name: string; description?: string; is_active?: boolean; file: File }
): Promise<{ rule: ReviewRule }> {
  const form = new FormData();
  form.append("file", data.file);
  form.append("name", data.name);
  if (data.description) form.append("description", data.description);
  form.append("is_active", String(data.is_active ?? true));
  return apiFetch("/api/rules", token, { method: "POST", body: form });
}

export async function updateRule(
  token: string | null,
  id: string,
  data: Partial<Pick<ReviewRule, "name" | "description" | "is_active">>
): Promise<{ rule: ReviewRule }> {
  return apiFetch(`/api/rules/${id}`, token, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteRule(token: string | null, id: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/rules/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete rule");
}

// ─── Analytics endpoint ───────────────────────────────────────────────────────

export async function getAnalytics(token: string | null): Promise<AnalyticsData> {
  return apiFetch("/api/analytics", token);
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  done: boolean;
  created_at: string;
}

export async function listTasks(token: string | null): Promise<{ tasks: Task[] }> {
  return apiFetch("/api/tasks", token);
}

export async function createTask(
  token: string | null,
  data: Pick<Task, "title" | "notes" | "priority" | "due_date">
): Promise<{ task: Task }> {
  return apiFetch("/api/tasks", token, { method: "POST", body: JSON.stringify(data) });
}

export async function updateTask(
  token: string | null,
  id: string,
  data: Partial<Pick<Task, "title" | "notes" | "priority" | "due_date" | "done">>
): Promise<{ task: Task }> {
  return apiFetch(`/api/tasks/${id}`, token, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteTask(token: string | null, id: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/tasks/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete task");
}

// ─── Time entries ─────────────────────────────────────────────────────────────

export interface TimeEntry {
  id: string;
  user_id: string;
  subject: string;
  contract: string;
  date: string;
  duration: string;
  duration_mins: number;
  billable: boolean;
  category: string;
  description: string;
  created_at: string;
}

export async function listTimeEntries(token: string | null): Promise<{ entries: TimeEntry[] }> {
  return apiFetch("/api/time", token);
}

export async function createTimeEntry(
  token: string | null,
  data: Pick<TimeEntry, "subject" | "contract" | "date" | "duration" | "duration_mins" | "billable" | "category" | "description">
): Promise<{ entry: TimeEntry }> {
  return apiFetch("/api/time", token, { method: "POST", body: JSON.stringify(data) });
}

export async function deleteTimeEntry(token: string | null, id: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/time/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete time entry");
}

// ─── Calendar events ──────────────────────────────────────────────────────────

export interface CalEvent {
  id: string;
  user_id: string;
  title: string;
  date: string;
  start_hour: number;
  end_hour: number;
  color: string;
  created_at: string;
}

export async function listCalendarEvents(token: string | null): Promise<{ events: CalEvent[] }> {
  return apiFetch("/api/calendar", token);
}

export async function createCalendarEvent(
  token: string | null,
  data: Pick<CalEvent, "title" | "date" | "start_hour" | "end_hour" | "color">
): Promise<{ event: CalEvent }> {
  return apiFetch("/api/calendar", token, { method: "POST", body: JSON.stringify(data) });
}

export async function deleteCalendarEvent(token: string | null, id: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/calendar/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete event");
}
