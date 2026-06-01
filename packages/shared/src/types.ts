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

export interface AnalysisResult {
  riskLevel: RiskLevel;
  riskSummary: RiskSummaryItem[];
  clauseAnalysis: ClauseAnalysisItem[];
  negotiationPoints: NegotiationPoint[];
}

export interface Contract {
  id: string;
  user_id: string;
  filename: string;
  s3_key: string;
  file_size: number;
  mime_type: string;
  contract_type: ContractType;
  status: ContractStatus;
  created_at: string;
}

export interface Analysis {
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
