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

export interface ClauseLibraryEntry {
  title: string;
  clause_type: "approved" | "fallback";
  content: string;
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
  playbookText?: string,
  clauseLibrary?: ClauseLibraryEntry[]
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

  if (clauseLibrary && clauseLibrary.length > 0) {
    const approved = clauseLibrary.filter(c => c.clause_type === "approved");
    const fallback = clauseLibrary.filter(c => c.clause_type === "fallback");

    let clauseSection = "\n\nCOMPANY CLAUSE LIBRARY — STANDARD LANGUAGE:\n";
    clauseSection += "The following are your organization's approved and fallback clause standards. ";
    clauseSection += "When reviewing the contract, compare relevant clauses against these standards. ";
    clauseSection += "Flag any clause that materially deviates from the approved language as a risk finding, and reference the company standard in your recommendation.\n";

    if (approved.length > 0) {
      clauseSection += "\nAPPROVED CLAUSES (preferred language — flag contract deviations):\n";
      for (const c of approved) {
        const entry = `\n[${c.title}]\n${c.content}\n`;
        if ((context + clauseSection + entry).length > 70000) break;
        clauseSection += entry;
      }
    }

    if (fallback.length > 0) {
      clauseSection += "\nFALLBACK CLAUSES (acceptable alternative language):\n";
      for (const c of fallback) {
        const entry = `\n[${c.title}]\n${c.content}\n`;
        if ((context + clauseSection + entry).length > 70000) break;
        clauseSection += entry;
      }
    }

    context += clauseSection;
  }

  return `${context}\n\nAnalyze this contract thoroughly. You MUST populate ALL seven output fields:

1. contractMetadata — extract key metadata from the contract text:
   - parties: ALL parties with their names (as written) and roles
   - effectiveDate, expirationDate, term, renewalTerms, noticePeriod
   - governingLaw, disputeResolution, totalValue, paymentTerms
   - Use "Not specified" for any metadata not found in the contract

2. extractedClauses — identify the KEY substantive clauses (top 6-10 most important):
   - For each clause: classify its type, copy the KEY sentence or phrase verbatim (1-3 sentences max, not the full clause), summarize in plain English, assess risk, note section reference, list issues
   - Prioritize: indemnification, limitation_of_liability, termination, ip_ownership, data_protection, governing_law, payment_terms, confidentiality
   - Keep verbatimText SHORT — the most legally significant sentence only

3. missingClauses — identify standard commercial clauses that SHOULD be in this type of contract but are missing:
   - For each missing clause: state its type, importance (critical/important/recommended), recommendation for what to add, and suggested draft language
   - Common missing clauses to check: force majeure, data protection/GDPR, insurance, audit rights, assignment restrictions, survival, entire agreement

4. riskSummary — high-level risk areas (always at least 2–4 findings). Each finding MUST include clauseRef: the specific section or clause reference (e.g. "Section 8.2", "Limitation of Liability clause"). Severity can be low/medium/high/critical.

5. clauseAnalysis — clause-by-clause risk findings (always at least 3–5 findings). Each finding MUST include:
   - contractText: the exact quote from the contract that triggered the risk finding
   - suggestedLanguage: practical replacement clause language the user can adopt directly — must be real legal text ready for insertion, not generic advice like "consider adding..." Write the actual clause text.

6. negotiationPoints — concrete leverage points with preferred and fallback positions (always at least 2–4 items)

7. ambiguityFlags — vague or undefined terms that could create disputes

Never return empty arrays for extractedClauses, riskSummary, clauseAnalysis, or negotiationPoints — every commercial contract has clauses, risks, and negotiable terms.

Be concise — keep total output under 3500 tokens.

CONTRACT TEXT:
${text.slice(0, 80000)}`;
}

// ─── Redline prompts ──────────────────────────────────────────────────────────

export const redlineSystemPrompt = `You are a senior corporate lawyer producing a contract redline markup.

Your task is to identify specific clause-level text edits that bring this contract in line with the company's review standards.

CRITICAL RULE — original_text must be VERBATIM:
- original_text must be an EXACT copy-paste from the contract. Character for character. Never paraphrase, summarize, or reword.
- Keep original_text targeted: the specific phrase or sentence to change, not the entire paragraph.
- If you cannot find the exact text in the contract, do not include that edit.

edit_type guide:
- "replace" — original_text is deleted, revised_text takes its place
- "delete" — original_text is removed entirely (revised_text must be "")
- "insert" — revised_text is inserted immediately after original_text (original_text is kept)

Produce 3–20 edits. Focus on changes with real legal impact. Omit cosmetic edits.`;

export function buildRedlinePrompt(
  text: string,
  contractType: ContractType,
  intake?: IntakeContext | null,
  playbookText?: string,
  clauseLibrary?: ClauseLibraryEntry[],
): string {
  const jurisdiction = intake?.jurisdiction ?? "us";
  let ctx = `CONTRACT TYPE: ${contractType.replace("_", " ").toUpperCase()}`;
  ctx += `\nJURISDICTION: ${jurisdiction.toUpperCase()}`;
  if (intake?.counterparty_name) ctx += `\nCOUNTERPARTY: ${intake.counterparty_name}`;
  if (intake?.deal_value) ctx += `\nDEAL VALUE: $${intake.deal_value.toLocaleString()}`;
  if (intake?.notes) ctx += `\nDEAL NOTES: ${intake.notes}`;

  if (playbookText?.trim()) {
    ctx += `\n\nCOMPANY PLAYBOOK / REVIEW RULES:\n${playbookText.slice(0, 40000)}`;
  } else {
    ctx += `\n\nNo company playbook provided. Apply best-practice standards for ${jurisdiction.toUpperCase()} commercial contracts.`;
  }

  if (clauseLibrary && clauseLibrary.length > 0) {
    const approved = clauseLibrary.filter(c => c.clause_type === "approved");
    const fallback = clauseLibrary.filter(c => c.clause_type === "fallback");
    let lib = "\n\nCOMPANY CLAUSE LIBRARY — use this language in revised_text where applicable:\n";
    if (approved.length > 0) {
      lib += "\nAPPROVED LANGUAGE (use verbatim or adapted in revised_text):\n";
      for (const c of approved) {
        const entry = `\n[${c.title}]\n${c.content}\n`;
        if (ctx.length + lib.length + entry.length > 70000) break;
        lib += entry;
      }
    }
    if (fallback.length > 0) {
      lib += "\nFALLBACK LANGUAGE (use if approved version is rejected):\n";
      for (const c of fallback) {
        const entry = `\n[${c.title}]\n${c.content}\n`;
        if (ctx.length + lib.length + entry.length > 70000) break;
        lib += entry;
      }
    }
    ctx += lib;
  }

  return `${ctx}\n\nCONTRACT TEXT — copy original_text VERBATIM from this text:\n${text.slice(0, 180000)}\n\nGenerate redline edits now. Every original_text field must be an exact verbatim substring of the contract text above. Where your clause library provides standard language, use it in revised_text.`;
}

export function buildSummaryPrompt(text: string, contractType: ContractType): string {
  return `Summarize this ${contractType.replace("_", " ")} contract in plain English. Write 3–4 short paragraphs covering: (1) what the contract is about and who the parties are, (2) the key obligations and rights of each party, (3) important dates, payment terms, and duration, (4) any immediately notable risks or unusual terms. Write for a non-lawyer business reader. Be factual and concise.

Be concise — keep total output under 3500 tokens.

CONTRACT TEXT:
${text.slice(0, 80000)}`;
}
