import type { ContractType } from "@contralyn/shared";

export const legalSystemPrompt = `You are a senior corporate lawyer specializing in commercial contracts, with deep expertise in Indian and international commercial law.

Your role is to analyze contracts and provide:
- Precise identification of legal and business risks
- Clause-by-clause review highlighting unfavorable or missing terms
- Practical negotiation strategies with concrete fallback positions
- Business impact analysis for each key finding

Focus areas: liability caps, indemnification, payment terms, termination rights, IP ownership, data protection, confidentiality, governing law, dispute resolution, assignment, SLA and remedy provisions, auto-renewal, limitation of liability.

Always call the analyze_contract tool with structured JSON findings. Never provide general legal advice — flag specific contract risks only. Append to all outputs: "AI-generated insights are for informational purposes only and do not constitute legal advice."`;

interface IntakeContext {
  counterparty_name?: string | null;
  department?: string | null;
  urgency?: string | null;
  deal_value?: number | null;
  jurisdiction?: string | null;
  renewal_date?: string | null;
  business_owner?: string | null;
  notes?: string | null;
}

interface ReviewRule {
  clause_type: string;
  requirement: string;
  severity: string;
}

export function buildContractPrompt(
  text: string,
  contractType: ContractType,
  intake?: IntakeContext | null,
  rules?: ReviewRule[]
): string {
  let context = `CONTRACT TYPE: ${contractType.replace("_", " ").toUpperCase()}`;

  if (intake) {
    if (intake.counterparty_name) context += `\nCOUNTERPARTY: ${intake.counterparty_name}`;
    if (intake.jurisdiction) context += `\nJURISDICTION: ${intake.jurisdiction.toUpperCase()} — apply ${intake.jurisdiction === "india" ? "Indian Contract Act, Companies Act, and relevant Indian commercial law" : intake.jurisdiction === "us" ? "US commercial law (UCC, applicable state law)" : intake.jurisdiction === "uk" ? "English contract law" : "applicable local law"}`;
    if (intake.deal_value) context += `\nDEAL VALUE: ${intake.deal_value} — flag any liability caps or indemnities that are disproportionate to this value`;
    if (intake.urgency) context += `\nURGENCY: ${intake.urgency}`;
    if (intake.department) context += `\nDEPARTMENT: ${intake.department}`;
    if (intake.renewal_date) context += `\nRENEWAL DATE: ${intake.renewal_date} — flag auto-renewal and notice period clauses`;
    if (intake.notes) context += `\nADDITIONAL CONTEXT: ${intake.notes}`;
  }

  if (rules && rules.length > 0) {
    context += `\n\nCOMPANY REVIEW RULES (flag any deviations as risks):\n`;
    context += rules.map((r) => `- [${r.severity.toUpperCase()}] ${r.clause_type}: ${r.requirement}`).join("\n");
  }

  return `${context}\n\nAnalyze this contract. Identify all legal and business risks, unfavorable clauses, missing protections, and negotiation opportunities. Apply the jurisdiction and company rules above where provided.\n\nCONTRACT TEXT:\n${text.slice(0, 180000)}`;
}

export function buildSummaryPrompt(text: string, contractType: ContractType): string {
  return `Summarize this ${contractType.replace("_", " ")} contract in plain English. Write 3–4 short paragraphs covering: (1) what the contract is about and who the parties are, (2) the key obligations and rights of each party, (3) important dates, payment terms, and duration, (4) any immediately notable risks or unusual terms. Write for a non-lawyer business reader. Be factual and concise.

CONTRACT TEXT:
${text.slice(0, 180000)}`;
}
