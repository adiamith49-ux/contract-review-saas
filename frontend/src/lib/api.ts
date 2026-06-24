import type {
  ContractType,
  RiskLevel,
  ContractStatus,
  RiskSummaryItem,
  ClauseAnalysisItem,
  NegotiationPoint,
  AmbiguityFlag,
  ContractMetadata,
  ExtractedClause,
  MissingClause,
} from "@/lib/types";

// ─── Client types ─────────────────────────────────────────────────────────────

export type ClientStatus = "active" | "inactive";

export interface Client {
  id: string;
  user_id: string;
  name: string;
  industry: string | null;
  notes: string | null;
  status: ClientStatus;
  contract_count: number;
  created_at: string;
  updated_at: string;
}

export async function listClients(token: string | null): Promise<{ clients: Client[] }> {
  return apiFetch("/api/clients", token);
}

export async function createClient(
  token: string | null,
  data: { name: string; industry?: string; notes?: string }
): Promise<{ client: Client }> {
  return apiFetch("/api/clients", token, { method: "POST", body: JSON.stringify(data) });
}

export async function getClient(
  token: string | null,
  id: string
): Promise<{ client: Client; contracts: ContractListItem[] }> {
  return apiFetch(`/api/clients/${id}`, token);
}

export async function updateClient(
  token: string | null,
  id: string,
  data: { name?: string; industry?: string | null; notes?: string | null; status?: ClientStatus }
): Promise<{ client: Client }> {
  return apiFetch(`/api/clients/${id}`, token, { method: "PATCH", body: JSON.stringify(data) });
}

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
  contract_metadata?: ContractMetadata;
  extracted_clauses?: ExtractedClause[];
  missing_clauses?: MissingClause[];
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
  title: string | null;
  counterparty: string | null;
  contract_type: ContractType;
  contract_status: string;
  status: ContractStatus;
  file_size: number;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  owner_name: string | null;
  contract_value: number | null;
  version_number: number;
  parent_contract_id: string | null;
  created_at: string;
  analyses: { id: string; risk_level: RiskLevel }[];
}

export interface ContractDetail {
  id: string;
  filename: string;
  title: string | null;
  counterparty: string | null;
  contract_type: ContractType;
  contract_status: string;
  status: ContractStatus;
  file_size: number;
  s3_key: string;
  created_at: string;
  fileUrl: string;
  extracted_text?: string | null;
  summary?: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  owner_name: string | null;
  contract_value: number | null;
  version_number: number;
  parent_contract_id: string | null;
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

export interface UploadContractMeta {
  contractType: ContractType;
  clientId?: string;
  title?: string;
  counterparty?: string;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  ownerName?: string;
  contractValue?: number;
  contractStatus?: string;
  governingLaw?: string;
  parentContractId?: string;
}

export async function uploadContract(
  token: string | null,
  file: File,
  meta: UploadContractMeta,
): Promise<{ contract: { id: string; filename: string; title: string | null; contract_type: ContractType; status: ContractStatus; created_at: string } }> {
  const form = new FormData();
  form.append("file", file);
  form.append("contract_type", meta.contractType);
  if (meta.clientId) form.append("client_id", meta.clientId);
  if (meta.title) form.append("title", meta.title);
  if (meta.counterparty) form.append("counterparty", meta.counterparty);
  if (meta.startDate) form.append("start_date", meta.startDate);
  if (meta.endDate) form.append("end_date", meta.endDate);
  if (meta.renewalDate) form.append("renewal_date", meta.renewalDate);
  if (meta.ownerName) form.append("owner_name", meta.ownerName);
  if (meta.contractValue != null) form.append("contract_value", String(meta.contractValue));
  if (meta.contractStatus) form.append("contract_status", meta.contractStatus);
  if (meta.governingLaw) form.append("governing_law", meta.governingLaw);
  if (meta.parentContractId) form.append("parent_contract_id", meta.parentContractId);

  return apiFetch("/api/contracts/upload", token, { method: "POST", body: form });
}

export async function updateContractMetadata(
  token: string | null,
  id: string,
  data: {
    title?: string | null;
    counterparty?: string | null;
    contract_type?: ContractType;
    contract_status?: string;
    start_date?: string | null;
    end_date?: string | null;
    renewal_date?: string | null;
    owner_name?: string | null;
    contract_value?: number | null;
  }
): Promise<{ contract: ContractListItem }> {
  return apiFetch(`/api/contracts/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function analyzeContract(
  token: string | null,
  id: string,
  selectedRuleIds?: string[]
): Promise<{ status: string }> {
  // Trigger analysis — returns immediately with { status: "processing" }
  const result = await apiFetch<{ status: string }>(`/api/contracts/${id}/analyze`, token, {
    method: "POST",
    body: JSON.stringify(selectedRuleIds !== undefined ? { selectedRuleIds } : {}),
  });

  if (result.status !== "processing") return result;

  // Poll until status changes to "analyzed" or "failed"
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000)); // poll every 3s
    const contract = await apiFetch<{ contract: { status: string } }>(`/api/contracts/${id}`, token);
    if (contract.contract.status === "analyzed") return { status: "analyzed" };
    if (contract.contract.status === "failed") throw new Error("Analysis failed — please try again");
  }

  throw new Error("Analysis timed out — please refresh and try again");
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
  filename: string,
  appliedIds?: Set<string>,
): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const qs = appliedIds && appliedIds.size > 0
    ? `?applied=${Array.from(appliedIds).join(",")}`
    : "";
  const res = await fetch(`${API_URL}/api/contracts/${id}/export/${format}${qs}`, { headers });
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

// ─── Legal intake endpoints ───────────────────────────────────────────────────

export interface LegalIntake {
  counterparty_name?: string;
  department?: string;
  urgency?: "low" | "medium" | "high" | "critical";
  deal_value?: number;
  jurisdiction?: "us" | "uk" | "eu" | "india" | "other";
  renewal_date?: string;
  business_owner?: string;
  notes?: string;
}

export async function getIntake(
  token: string | null,
  contractId: string,
): Promise<{ intake: LegalIntake | null }> {
  return apiFetch(`/api/contracts/${contractId}/intake`, token);
}

export async function saveIntake(
  token: string | null,
  contractId: string,
  data: LegalIntake,
): Promise<{ intake: LegalIntake }> {
  return apiFetch(`/api/contracts/${contractId}/intake`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
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

// ─── Redline types + endpoints ────────────────────────────────────────────────

export interface RedlineEdit {
  clause_ref: string;
  original_text: string;
  revised_text: string;
  edit_type: "replace" | "insert" | "delete";
  risk: "High" | "Medium" | "Low";
  playbook_rule: string;
  rationale: string;
}

export interface LocatedEdit extends RedlineEdit {
  matched: true;
  start: number;
  end: number;
}

export interface UnmatchedEdit extends RedlineEdit {
  matched: false;
  reason: string;
}

export type ProcessedEdit = LocatedEdit | UnmatchedEdit;

export interface RedlineResult {
  edits: ProcessedEdit[];
  matched_count: number;
  unmatched_count: number;
  model: string;
}

export async function runRedline(
  token: string | null,
  contractId: string,
): Promise<RedlineResult> {
  return apiFetch(`/api/contracts/${contractId}/redline`, token, { method: "POST" });
}

export async function downloadRedlineDocx(
  token: string | null,
  contractId: string,
  filename: string,
  edits: ProcessedEdit[],
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/contracts/${contractId}/redline/export/docx`, {
    method: "POST",
    headers,
    body: JSON.stringify({ edits }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Redline export failed" }));
    throw new Error(err.error ?? "Redline export failed");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/\.[^.]+$/, "")}-redlines.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

export async function updateCalendarEvent(
  token: string | null,
  id: string,
  data: Partial<Pick<CalEvent, "title" | "date" | "start_hour" | "end_hour" | "color">>
): Promise<{ event: CalEvent }> {
  return apiFetch(`/api/calendar/${id}`, token, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteCalendarEvent(token: string | null, id: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/calendar/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete event");
}

// ─── Activity log ─────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  action: string;
  contract_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function getActivityLog(
  token: string | null,
  limit = 50,
  offset = 0,
): Promise<{ activity: ActivityEntry[]; total: number }> {
  return apiFetch(`/api/activity?limit=${limit}&offset=${offset}`, token);
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

export interface UserTicket {
  id: string; type: string; reference_id: string | null; reference_name: string | null;
  description: string; status: string; admin_notes: string | null; created_at: string;
}

export async function submitTicket(
  token: string | null,
  data: { type: "clause_change" | "playbook_change" | "other"; reference_id?: string; reference_name?: string; description: string }
): Promise<{ ticket: UserTicket }> {
  return apiFetch("/api/tickets", token, { method: "POST", body: JSON.stringify(data) });
}

export async function listMyTickets(token: string | null): Promise<{ tickets: UserTicket[] }> {
  return apiFetch("/api/tickets", token);
}

// ─── Account ──────────────────────────────────────────────────────────────────

export async function deleteAccount(token: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/account`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete account");
}

// ─── Contract summary ─────────────────────────────────────────────────────────

export async function summarizeContract(
  token: string | null,
  contractId: string,
): Promise<{ summary: string }> {
  return apiFetch(`/api/contracts/${contractId}/summarize`, token, { method: "POST" });
}
