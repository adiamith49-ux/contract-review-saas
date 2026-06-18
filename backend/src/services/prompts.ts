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

  return `${context}\n\nAnalyze this contract thoroughly. You MUST populate ALL four output fields:\n1. riskSummary — high-level risk areas (always at least 2–4 findings)\n2. clauseAnalysis — clause-by-clause review of every substantive clause (always at least 3–5 findings; flag gaps, weak language, missing protections, and unfavorable terms)\n3. negotiationPoints — concrete leverage points with preferred and fallback positions (always at least 2–4 items; focus on terms that are negotiable in practice)\n4. ambiguityFlags — vague or undefined terms that could create disputes\n\nNever return empty arrays for riskSummary, clauseAnalysis, or negotiationPoints — every commercial contract has risks and negotiable terms.\n\nCONTRACT TEXT:\n${text.slice(0, 180000)}`;
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

CONTRACT TEXT:
${text.slice(0, 180000)}`;
}
