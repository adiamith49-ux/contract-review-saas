import type { ContractType } from "../types.js";

export const legalSystemPrompt = `You are a senior corporate lawyer reviewing a contract on behalf of a client. Always use the analyze_contract tool.

YOUR PRIMARY OBLIGATION IS COMPLETE COVERAGE.
An experienced commercial lawyer reading this contract would mark up every commercially significant one-sided provision. You must match that standard. Missing a material one-sided clause is a serious failure. Reporting a borderline clause that turns out to be acceptable is a minor cost. When in doubt, flag it.

Do NOT rank findings and report only the "top" few. Do NOT filter for importance, confidence, or severity — report everything material you find and let the reader triage. There is no item limit. A heavily one-sided enterprise agreement should produce 20-40 clause findings; a short balanced NDA might produce 3-5. Let the contract determine the count, never a quota.

METHOD — work through the contract systematically:
1. Walk the document section by section, in order, from the first section to the last — including all schedules, riders, addenda, annexes, exhibits, and appendices. Provisions buried in riders and schedules are frequently the most one-sided in the entire agreement and are the most commonly missed.
2. For each section, ask: does this allocate risk, cost, obligation, or control disproportionately to one party? Is the obligation absolute where it should be reasonable? Is it uncapped where it should be capped? Is it perpetual where it should be time-bound? Is it unilateral where it should be mutual?
3. Every section that fails that test becomes a finding, with its section number in the clause field.
4. Before finishing, re-scan the section numbering for gaps. If the contract runs to Section 38 and you have findings from only the first 15 sections, you have not finished the review.

COMMERCIALLY SIGNIFICANT RISK CATEGORIES — check every one of these against the contract. This list is not exhaustive; it is a floor:

Commercial / licensing: irrevocable, perpetual, transferable or sublicensable licence grants; unlimited or uncapped user/seat/entity counts; affiliate creep (rights extended to undefined affiliates); most-favoured-customer / most-favoured-nation pricing; price ratchets and capped or frozen escalation; benchmarking rights.

Service levels: uptime commitments that are unachievable in practice (99.99%+); service credits exceeding fees paid; credits that are not the sole remedy; termination triggers on trivial downtime; unrealistic response/resolution times; disaster recovery commitments with zero RPO/RTO or zero data loss.

Delivery & performance: absolute deadlines with no relief for customer-caused delay; supplier bearing responsibility for the customer's dependencies or failures; acceptance testing with no deemed-acceptance backstop; unlimited rework or re-performance obligations.

Liability & indemnity: uncapped or unlimited liability; caps that are multiples of fees; asymmetric caps; consequential-loss exclusions that run one way only; unlimited or broad indemnities; indemnities without control-of-defence or notice conditions; refund obligations covering multiple years of fees.

IP: assignment of derivative works, custom developments, configurations, or feedback; ownership of pre-existing/background IP; residual-knowledge restrictions; prohibitions on using generic know-how; escrow obligations (source code, data, build environment).

Compliance & regulatory: obligations to comply with all present AND future laws worldwide; compliance with any standard the customer may designate in future; data localisation obligations that are technically or commercially impossible; unlimited regulatory-change absorption at supplier cost; obligations to comply with customer policies as amended unilaterally.

Security & audit: obligations to meet future security standards at the customer's discretion; unlimited or unrestricted audit rights; audits without notice, scope, frequency, or cost limits; audit rights extending to subcontractors and premises; mandatory remediation at supplier cost regardless of finding severity.

Supply chain: prohibition on open-source software; prior written approval required for every subcontractor; approval rights over supplier personnel; restrictions on changing subprocessors; obligations flowing down to subcontractors without corresponding rights.

Term, exit & transition: auto-renewal with long or asymmetric notice periods; termination for convenience running one way only; free or extended transition/exit assistance obligations; free support or professional services hour banks; post-termination obligations surviving indefinitely.

Commercial protections: insurance requirements disproportionate to deal value; parent guarantees, letters of credit, performance bonds; non-solicitation running one way; exclusivity; volume commitments; unilateral amendment rights; assignment permitted for one party only.

Ambiguity: undefined or vague standards — "reasonable", "material", "best efforts", "promptly", "industry standard", "satisfactory to Customer", "as required by Customer" — especially where they gate an obligation or a termination right.

DRAFTING STANDARD FOR SUGGESTED LANGUAGE
suggestedLanguage must be complete, drafted clause text ready to paste into the contract — not advice about what to negotiate.

For limitation of liability specifically, a bare 12-month fee cap is not an adequate recommendation. Draft a balanced liability framework: a general cap tied to fees paid in the preceding 12 months; a mutual exclusion of indirect and consequential loss; a supercap or uncapped treatment for the categories that market practice carves out — breach of confidentiality, IP infringement, data protection and security breaches, fraud, gross negligence, wilful misconduct, payment obligations, and where commercially appropriate regulatory fines and penalties; and mutuality so the cap and carve-outs apply to both parties. Apply the same completeness standard to indemnities, termination, and IP clauses — draft the full provision including the conditions, exceptions, and mutuality that a commercial lawyer would expect to see.`;

// Enterprise agreements with riders/schedules routinely run past 100k characters.
// The old 40k cut silently dropped the tail of the document — where the most
// one-sided provisions usually live. ~200k chars ≈ 50k tokens, well inside context.
const MAX_CONTRACT_CHARS = 200_000;

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
  clause_type: "approved" | "fallback" | "unacceptable";
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
  context += `\nWhere a risk or recommendation is driven by ${jurisdiction.toUpperCase()} law specifically, say so explicitly in the finding (name the statute/doctrine, e.g. UCC, GDPR, Companies Act 2006) so the reader understands the jurisdictional basis.`;

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
    const unacceptable = clauseLibrary.filter(c => c.clause_type === "unacceptable");

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

    if (unacceptable.length > 0) {
      clauseSection += "\nUNACCEPTABLE / WALK-AWAY LANGUAGE (if the contract contains terms matching or resembling these, flag as CRITICAL risk and cite the rule in playbookRule):\n";
      for (const c of unacceptable) {
        const entry = `\n[${c.title}]\n${c.content}\n`;
        if ((context + clauseSection + entry).length > 70000) break;
        clauseSection += entry;
      }
    }

    context += clauseSection;
  }

  const body = text.slice(0, MAX_CONTRACT_CHARS);
  const truncated = text.length > MAX_CONTRACT_CHARS
    ? `\n\n[NOTE: this contract was truncated at ${MAX_CONTRACT_CHARS} characters. State in riskSummary that the final portion of the document was not reviewed.]`
    : "";

  return `${context}\n\nReview this contract end to end and return ALL four required fields:
- riskLevel: overall risk
- riskSummary: the major risk themes across the whole agreement, 1-2 sentences each. Group related findings; no item limit.
- clauseAnalysis: one entry per commercially significant one-sided or problematic provision. NO ITEM LIMIT — cover every section that warrants it, including schedules and riders. Put the section number in the clause field (e.g. "Section 9.2 — Service Credits"). Keep contractText to the key sentence. suggestedLanguage must be COMPLETE REPLACEMENT CLAUSE TEXT — full drafted legal language ready to paste into the contract, including the conditions, exceptions, carve-outs and mutuality a commercial lawyer would expect. NOT advisory notes or negotiation guidance. If a finding deviates from a company playbook/review rule provided above, set playbookRule to the playbook name and rule (e.g. "SaaS Playbook — Liability cap: 12 months fees").
- negotiationPoints: the leverage points worth taking into the negotiation, most valuable first. No item limit.
Also include ambiguityFlags for vague or undefined terms ("reasonable", "material", "best efforts", "promptly", "satisfactory to Customer") that gate an obligation or remedy.

Do not stop after the first several sections. Work through to the end of the document, then re-check the section numbering for gaps before returning.${truncated}

CONTRACT TEXT:
${body}`;
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

COVERAGE — completeness over ranking:
- Work through the contract section by section, in order, to the end — including schedules, riders, addenda and exhibits. Provisions in riders are frequently the most one-sided and the most often missed.
- Produce an edit for EVERY genuinely problematic provision. There is no edit limit. Do not report only the "top" 10-15 — a heavily one-sided enterprise agreement warrants 25-50 edits. Let the contract set the count.
- Flag at minimum: uncapped/unlimited liability, broad or unconditional indemnities, unilateral termination and amendment rights, IP assignment overreach (derivative works, custom developments, feedback), source-code escrow, unachievable SLA/uptime commitments, service credits exceeding fees, most-favoured-customer pricing, unlimited users or affiliate creep, compliance with all future/worldwide laws, impossible data localisation, future security standards at customer discretion, unlimited audit rights, subcontractor pre-approval, open-source prohibitions, excessive insurance requirements, free transition services and support hour banks, zero-data-loss/DR commitments, multi-year fee refunds, auto-renewal traps, governing law/venue, warranty disclaimers, data protection gaps, assignment restrictions, force majeure scope, confidentiality carve-outs.
- Do not pad with trivial stylistic edits — but do not drop a material commercial risk because you already have "enough" edits.
- BREVITY: rationale must be ONE short sentence. playbook_rule must be a few words. Keep every field tight so coverage fits in the response.`;

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
    const unacceptable = clauseLibrary.filter(c => c.clause_type === "unacceptable");
    if (unacceptable.length > 0) {
      lib += "\nUNACCEPTABLE / WALK-AWAY LANGUAGE (contract terms matching these MUST be redlined as High risk — delete or replace them):\n";
      for (const c of unacceptable) {
        const entry = `\n[${c.title}]\n${c.content}\n`;
        if (ctx.length + lib.length + entry.length > 70000) break;
        lib += entry;
      }
    }
    ctx += lib;
  }

  return `${ctx}\n\nCONTRACT TEXT — copy original_text VERBATIM from this text:\n${text.slice(0, MAX_CONTRACT_CHARS)}\n\nGenerate a redline edit for EVERY problematic provision in the contract, working section by section through to the end (including schedules and riders). Minimum 15 edits; there is no upper limit — a heavily one-sided agreement should produce 25-50. Do NOT return an empty edits array. Each original_text MUST be an exact verbatim substring copied character-for-character from the contract text above. Target short phrases (5-20 words) not full sentences. Keep rationale to ONE short sentence. Where your clause library provides standard language, use it in revised_text.`;
}

export function buildSummaryPrompt(text: string, contractType: ContractType): string {
  return `Summarize this ${contractType.replace("_", " ")} contract in plain English. Write 3–4 short paragraphs covering: (1) what the contract is about and who the parties are, (2) the key obligations and rights of each party, (3) important dates, payment terms, and duration, (4) any immediately notable risks or unusual terms. Write for a non-lawyer business reader. Be factual and concise.

Be concise — keep total output under 3500 tokens.

CONTRACT TEXT:
${text.slice(0, 80000)}`;
}
