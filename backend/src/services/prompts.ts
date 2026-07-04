import type { ContractType } from "../types.js";

export const legalSystemPrompt = `You are a senior corporate lawyer. Analyze contracts for risks, unfavorable clauses, and negotiation leverage. Focus on: liability, indemnification, termination, IP, data protection, payment terms, governing law. Be concise. Always use the analyze_contract tool.`;

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

  return `${context}\n\nAnalyze this contract. Return ALL four fields:
- riskLevel: overall risk
- riskSummary: 3 items max, 1-2 sentences each
- clauseAnalysis: 5 items max, keep contractText to 1 sentence, suggestedLanguage must be COMPLETE REPLACEMENT CLAUSE TEXT — full drafted legal language ready to copy into the contract (e.g. "Each party's total aggregate liability shall not exceed the fees paid in the 12 months preceding the claim, except for gross negligence, fraud, or willful misconduct."). NOT advisory notes or negotiation guidance.
- negotiationPoints: 3 items max, 1 sentence each field

CONTRACT TEXT:
${text.slice(0, 40000)}`;
}

// ─── Redline prompts ──────────────────────────────────────────────────────────

export const redlineSystemPrompt = `You are a senior corporate lawyer producing a comprehensive contract redline markup, similar to a Word tracked-changes document comparing two contract versions.

Your task: review EVERY clause in the contract and produce edits for ALL problematic language — missing protections, one-sided terms, vague obligations, risky definitions, and deviations from market-standard positions.

CRITICAL RULE — original_text must be VERBATIM:
- original_text must be an EXACT character-for-character copy from the contract text provided. Copy-paste directly.
- Include all punctuation, capitalisation, and spacing exactly as it appears.
- Never paraphrase, abbreviate, or reword the original text.
- If you cannot find the exact substring, do not include that edit.

GRANULARITY — target the smallest meaningful unit:
- Edit individual words or short phrases, NOT entire sentences or paragraphs.
- For a sentence where only one word needs changing, original_text should be just that word plus 2-3 surrounding words for uniqueness.
- GOOD original_text: "solely at Provider's discretion" (targeted phrase)
- BAD original_text: "Provider may terminate this Agreement at any time solely at Provider's discretion upon 30 days written notice." (entire sentence when only "solely at Provider's discretion" needs changing)
- Multiple problems in one clause = multiple separate edits, each targeting the specific phrase.

edit_type guide:
- "replace" — original_text is deleted, revised_text takes its place. Keep original_text as SHORT as possible.
- "delete" — original_text is removed entirely (revised_text must be "")
- "insert" — revised_text is inserted immediately after original_text (original_text is kept)

COVERAGE — prioritise impact:
- Review every section of the contract, but only produce edits for genuinely problematic language.
- Flag: unlimited liability, broad indemnities, unilateral termination rights, IP assignment overreach, non-compete scope, auto-renewal traps, governing law/venue issues, warranty disclaimers, limitation of liability caps, data protection gaps, assignment restrictions, force majeure scope, confidentiality carve-outs.
- Produce the 10–15 HIGHEST-IMPACT edits, ordered by risk (High first). Do not pad with trivial stylistic edits.
- BREVITY: rationale must be ONE short sentence. playbook_rule must be a few words. Speed matters — keep every field tight.`;

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

  return `${ctx}\n\nCONTRACT TEXT — copy original_text VERBATIM from this text:\n${text.slice(0, 40000)}\n\nYou MUST generate between 10 and 15 redline edits covering the highest-impact problematic clauses. Do NOT return an empty edits array. Each original_text MUST be an exact verbatim substring copied character-for-character from the contract text above. Target short phrases (5-20 words) not full sentences. Keep rationale to ONE short sentence. Where your clause library provides standard language, use it in revised_text.`;
}

export function buildSummaryPrompt(text: string, contractType: ContractType): string {
  return `Summarize this ${contractType.replace("_", " ")} contract in plain English. Write 3–4 short paragraphs covering: (1) what the contract is about and who the parties are, (2) the key obligations and rights of each party, (3) important dates, payment terms, and duration, (4) any immediately notable risks or unusual terms. Write for a non-lawyer business reader. Be factual and concise.

Be concise — keep total output under 3500 tokens.

CONTRACT TEXT:
${text.slice(0, 80000)}`;
}
