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
  severity: "low" | "medium" | "high" | "critical";
  recommendation: string;
  clauseRef?: string;
}

export interface ClauseAnalysisItem {
  clause: string;
  finding: string;
  risk: RiskLevel;
  recommendation: string;
  contractText?: string;
  suggestedLanguage?: string;
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

export interface ContractParty {
  name: string;
  role: string;
}

export interface ContractMetadata {
  parties: ContractParty[];
  effectiveDate: string;
  expirationDate?: string;
  term?: string;
  renewalTerms?: string;
  noticePeriod?: string;
  governingLaw: string;
  disputeResolution?: string;
  totalValue?: string;
  paymentTerms?: string;
}

export interface ExtractedClause {
  clauseType: string;
  title: string;
  verbatimText: string;
  summary: string;
  risk: RiskLevel;
  section: string;
  issues?: string[];
}

export interface MissingClause {
  clauseType: string;
  importance: "critical" | "important" | "recommended";
  recommendation: string;
  suggestedLanguage?: string;
}

export interface AnalysisResult {
  riskLevel: RiskLevel;
  contractMetadata?: ContractMetadata;
  extractedClauses?: ExtractedClause[];
  missingClauses?: MissingClause[];
  riskSummary: RiskSummaryItem[];
  clauseAnalysis: ClauseAnalysisItem[];
  negotiationPoints: NegotiationPoint[];
  ambiguityFlags?: AmbiguityFlag[];
}
