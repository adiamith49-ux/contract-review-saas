import type {
  ContractType,
  RiskLevel,
  ContractStatus,
  RiskSummaryItem,
  ClauseAnalysisItem,
  NegotiationPoint,
} from "@contralyn/shared";

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
  id: string
): Promise<{ analysisId: string; status: string }> {
  return apiFetch(`/api/contracts/${id}/analyze`, token, { method: "POST" });
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
