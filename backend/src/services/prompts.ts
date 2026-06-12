import type { ContractType } from "../types.js";

export const legalSystemPrompt = `You are a senior corporate lawyer specializing in commercial contracts, with deep expertise in US and UK commercial law.

Your primary jurisdictions are:
- United States: UCC, Delaware corporate law, applicable state commercial law, federal regulations
- United Kingdom: English contract law, Companies Act 2006, UK commercial practice, applicable English common law

Your role is to analyze contracts and provide:
- Precise identification of legal and business risks
- Clause-by-clause review highlighting unfavorable or missing terms
- Practical negotiation strategies with concrete fallback positions
- Business impact analysis for each key finding

Focus areas: liability caps, indemnification, payment terms, termination rights, IP ownership, data protection, confidentiality, governing law, dispute resolution, assignment, SLA and remedy provisions, auto-renewal, limitation of liability, representations and warranties.

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

const jurisdictionContext: Record<string, string> = {
  us: "Apply US commercial law — UCC where applicable, Delaware corporate law for entity matters, relevant state law per governing law clause. Flag any provisions that may conflict with US federal regulations.",
  uk: "Apply English contract law and UK commercial practice — Companies Act 2006 for corporate matters, relevant English common law. Flag any provisions inconsistent with UK standard commercial practice or that may be unenforceable under English law.",
  eu: "Apply EU commercial law and relevant member state law. Flag GDPR implications for any data handling provisions.",
  india: "Apply Indian Contract Act 1872, Specific Relief Act 2018, and relevant Indian commercial law. Flag jurisdiction and enforcement considerations for cross-border contracts.",
  other: "Apply general international commercial law principles. Flag any governing law and jurisdiction provisions carefully.",
};

export function buildContractPrompt(
  text: string,
  contractType: ContractType,
  intake?: IntakeContext | null,
  playbookText?: string
): string {
  const jurisdiction = intake?.jurisdiction ?? "us";
  let context = `CONTRACT TYPE: ${contractType.replace("_", " ").toUpperCase()}`;

  context += `\nJURISDICTION: ${jurisdiction.toUpperCase()} — ${jurisdictionContext[jurisdiction] ?? jurisdictionContext.other}`;

  if (intake) {
    if (intake.counterparty_name) context += `\nCOUNTERPARTY: ${intake.counterparty_name}`;
    if (intake.deal_value) context += `\nDEAL VALUE: $${intake.deal_value.toLocaleString()} — flag any liability caps or indemnities disproportionate to this value`;
    if (intake.urgency) context += `\nURGENCY: ${intake.urgency}`;
    if (intake.department) context += `\nDEPARTMENT: ${intake.department}`;
    if (intake.renewal_date) context += `\nRENEWAL DATE: ${intake.renewal_date} — flag auto-renewal clauses and required notice periods`;
    if (intake.notes) context += `\nADDITIONAL CONTEXT: ${intake.notes}`;
  }

  if (playbookText?.trim()) {
    context += `\n\nCOMPANY PLAYBOOK — REVIEW STANDARDS:\nThe following is your organization's contract review playbook. Review every clause in the contract against these standards. Flag any clause that deviates from, contradicts, or fails to meet the requirements in this playbook as a specific risk finding:\n\n${playbookText.slice(0, 60000)}`;
  }

  return `${context}\n\nAnalyze this contract. Identify all legal and business risks, unfavorable clauses, missing protections, and negotiation opportunities.\n\nCONTRACT TEXT:\n${text.slice(0, 180000)}`;
}

export function buildSummaryPrompt(text: string, contractType: ContractType): string {
  return `Summarize this ${contractType.replace("_", " ")} contract in plain English. Write 3–4 short paragraphs covering: (1) what the contract is about and who the parties are, (2) the key obligations and rights of each party, (3) important dates, payment terms, and duration, (4) any immediately notable risks or unusual terms. Write for a non-lawyer business reader. Be factual and concise.

CONTRACT TEXT:
${text.slice(0, 180000)}`;
}
