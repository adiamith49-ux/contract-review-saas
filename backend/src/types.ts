export type ClientStatus = "active" | "inactive";

export interface Client {
  id: string;
  user_id: string;
  name: string;
  industry: string | null;
  notes: string | null;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
}

export type ContractType =
  | "nda"
  | "msa"
  | "saas"
  | "sow"
  | "order_form"
  | "employment"
  | "vendor_agreement"
  | "other";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ContractStatus = "uploaded" | "processing" | "analyzed" | "failed";

export interface RiskSummaryItem {
  area: string;
  risk: string;
  severity: "low" | "medium" | "high";
  recommendation: string;
}

export interface ClauseAnalysisItem {
  clause: string;
  finding: string;
  risk: RiskLevel;
  recommendation: string;
}

export interface NegotiationPoint {
  point: string;
  preferredPosition: string;
  fallbackPosition: string;
}

export interface AmbiguityFlag {
  term: string;
  location: string;
  issue: string;
  suggestion: string;
}

export interface AnalysisResult {
  riskLevel: RiskLevel;
  riskSummary: RiskSummaryItem[];
  clauseAnalysis: ClauseAnalysisItem[];
  negotiationPoints: NegotiationPoint[];
  ambiguityFlags?: AmbiguityFlag[];
}
