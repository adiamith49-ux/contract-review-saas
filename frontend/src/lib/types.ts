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

export type ContractBusinessStatus =
  | "draft"
  | "under_review"
  | "executed"
  | "expired"
  | "on_hold"
  | "terminated";

export type ContractLifecycle = "active" | "expired" | "renewal_due";

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
