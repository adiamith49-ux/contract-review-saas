import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult, ContractType } from "../types.js";
import { config } from "../config.js";
import { buildContractPrompt, buildRedlinePrompt, buildSummaryPrompt, legalSystemPrompt, redlineSystemPrompt, type ClauseLibraryEntry } from "./prompts.js";
import type { RedlineEdit } from "./redline.service.js";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const analysisTool: Anthropic.Tool = {
  name: "analyze_contract",
  description: "Analyze a legal contract and return structured findings",
  input_schema: {
    type: "object",
    required: ["riskLevel", "riskSummary", "clauseAnalysis", "negotiationPoints"],
    properties: {
      riskLevel: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        description: "Overall risk level of the contract",
      },
      riskSummary: {
        type: "array",
        description: "High-level risk themes across the whole agreement. No item limit — cover every major risk area present.",
        items: {
          type: "object",
          required: ["area", "risk", "severity", "recommendation"],
          properties: {
            area: { type: "string" },
            risk: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            recommendation: { type: "string" },
            clauseRef: { type: "string" },
          },
        },
      },
      clauseAnalysis: {
        type: "array",
        description: "One entry per commercially significant one-sided or problematic provision, in document order. NO ITEM LIMIT — completeness matters more than brevity. Cover every section that warrants it, including schedules, riders and addenda. A heavily one-sided enterprise agreement should produce 20-40 entries.",
        items: {
          type: "object",
          required: ["clause", "finding", "risk", "recommendation"],
          properties: {
            clause: { type: "string", description: "Section reference and name, e.g. 'Section 9.2 — Service Credits'" },
            finding: { type: "string" },
            risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
            recommendation: { type: "string" },
            contractText: { type: "string" },
            suggestedLanguage: { type: "string", description: "Complete replacement clause text ready to insert into the contract. Must be full drafted legal language including the conditions, exceptions, carve-outs and mutuality a commercial lawyer would expect — not negotiation advice or a summary. For limitation of liability, draft a balanced framework (general cap, mutual consequential-loss exclusion, and carve-outs for confidentiality, IP infringement, data protection/security, fraud, gross negligence, wilful misconduct, payment obligations, and regulatory fines where appropriate) — never a bare 12-month cap." },
            playbookRule: { type: "string", description: "If this finding deviates from a company playbook rule, name the playbook and rule that was triggered (e.g. 'SaaS Playbook — Liability cap: 12 months fees'). Omit if no playbook rule applies." },
          },
        },
      },
      negotiationPoints: {
        type: "array",
        description: "Negotiation leverage points, most commercially valuable first. No item limit.",
        items: {
          type: "object",
          required: ["point", "preferredPosition", "fallbackPosition"],
          properties: {
            point: { type: "string" },
            preferredPosition: { type: "string" },
            fallbackPosition: { type: "string" },
          },
        },
      },
      ambiguityFlags: {
        type: "array",
        description: "Vague or undefined terms that gate an obligation, remedy or termination right — 'reasonable', 'material', 'best efforts', 'promptly', 'industry standard', 'satisfactory to Customer'. No item limit.",
        items: {
          type: "object",
          required: ["term", "location", "issue", "suggestion"],
          properties: {
            term: { type: "string", description: "The vague term or phrase as it appears" },
            location: { type: "string", description: "Section reference where it appears" },
            issue: { type: "string", description: "Why the ambiguity creates risk" },
            suggestion: { type: "string", description: "Concrete definition or objective standard to replace it with" },
          },
        },
      },
    },
  },
};

// ─── extractContractMeta ─────────────────────────────────────────────────────

export interface ContractMeta {
  counterparty_name?: string;
  contract_type?: string;
  start_date?: string;
  end_date?: string;
  governing_law?: string;
  contract_value?: string;
}

const extractMetaTool: Anthropic.Tool = {
  name: "extract_contract_meta",
  description: "Extract key metadata from a contract",
  input_schema: {
    type: "object",
    properties: {
      counterparty_name: { type: "string", description: "Name of the counterparty / other party" },
      contract_type: { type: "string", description: "Type of contract e.g. NDA, SaaS Agreement, Employment Agreement" },
      start_date: { type: "string", description: "Contract start or effective date in YYYY-MM-DD format if found" },
      end_date: { type: "string", description: "Contract end or expiry date in YYYY-MM-DD format if found" },
      governing_law: { type: "string", description: "Governing law / jurisdiction clause e.g. 'New York, USA' or 'England and Wales'" },
      contract_value: { type: "string", description: "The single TOTAL contract value only, as one plain number (currency symbols/commas OK, e.g. '$1,500,000'). If the contract states multiple amounts (e.g. an annual fee AND a total over the term), return ONLY the total — never combine or list more than one number. Omit this field if no total value is stated." },
    },
  },
};

export async function extractContractMeta(text: string): Promise<ContractMeta> {
  const response = await anthropic.messages.create({
    model: config.AI_MODEL,
    max_tokens: 512,
    system: "You are a contract metadata extractor. Extract only what is explicitly stated in the contract. Do not infer or guess.",
    tools: [extractMetaTool],
    tool_choice: { type: "tool", name: "extract_contract_meta" },
    messages: [{ role: "user", content: text.slice(0, 20000) }],
  });

  const toolUse = response.content.find(b => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return {};
  return (toolUse.input as ContractMeta) ?? {};
}

// ─── Analysis ────────────────────────────────────────────────────────────────

interface IntakeContext {
  counterparty_name?: string | null;
  department?: string | null;
  urgency?: string | null;
  deal_value?: number | null;
  jurisdiction?: string | null;
  renewal_date?: string | null;
  notes?: string | null;
}

export async function analyzeContract(
  text: string,
  contractType: ContractType,
  intake?: IntakeContext | null,
  playbookText?: string,
  clauseLibrary?: ClauseLibraryEntry[]
): Promise<AnalysisResult & { model: string }> {
  // Use streaming to reduce wall-clock time — tokens arrive incrementally
  // instead of waiting for the full response to be computed.
  //
  // ANALYSIS_MAX_TOKENS is the biggest single knob on wall-clock time: at ~70-90
  // output tok/s, generation time ≈ max_tokens / speed. It must be small enough
  // that a thorough analysis finishes inside the serverless function budget (see
  // ANALYSIS_TIMEOUT_MS in contracts.ts and maxDuration in vercel.json). 20k
  // covers ~25-30 findings-with-drafted-clauses in ~4 min. If you raise the
  // function maxDuration to 800s (Vercel Pro/Enterprise), you can safely bump
  // this back toward 32000 for the most exhaustive contracts.
  const stream = anthropic.messages.stream({
    model: config.AI_MODEL,
    max_tokens: 20000,
    system: [{ type: "text", text: legalSystemPrompt }],
    tools: [analysisTool],
    tool_choice: { type: "tool", name: "analyze_contract" },
    messages: [{ role: "user", content: buildContractPrompt(text, contractType, intake, playbookText, clauseLibrary) }],
  });

  const response = await stream.finalMessage();

  // If the model hit the token ceiling, the tool-call JSON is truncated and its
  // parsed input is partial/garbage. Fail loudly (retryable) instead of saving a
  // broken analysis — the caller marks the contract "failed", not stuck.
  if (response.stop_reason === "max_tokens") {
    throw new Error("Analysis output exceeded the token limit (contract too large/complex for a single pass). Try again, or split the document.");
  }

  const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
  if (!toolUse) throw new Error("AI did not return structured analysis");

  return { ...(toolUse.input as AnalysisResult), model: config.AI_MODEL };
}

// ─── Redline tool ─────────────────────────────────────────────────────────────

const redlineTool: Anthropic.Tool = {
  name: "generate_redlines",
  description: "Generate clause-level redline edits for a contract",
  input_schema: {
    type: "object",
    required: ["edits"],
    properties: {
      edits: {
        type: "array",
        description: "List of clause-level edits. original_text must be verbatim from the contract.",
        items: {
          type: "object",
          required: ["clause_ref", "original_text", "revised_text", "edit_type", "risk", "rationale"],
          properties: {
            clause_ref:   { type: "string", description: "Section reference, e.g. 'Section 8.2' or 'Indemnification'" },
            original_text: { type: "string", description: "EXACT verbatim substring from the contract to change" },
            revised_text:  { type: "string", description: "Replacement text (empty string for deletions)" },
            edit_type:    { type: "string", enum: ["replace", "insert", "delete"] },
            risk:         { type: "string", enum: ["High", "Medium", "Low"] },
            playbook_rule: { type: "string", description: "Which review rule or standard triggered this edit" },
            rationale:    { type: "string", description: "Why this change is legally important" },
          },
        },
      },
    },
  },
};

export async function redlineContract(
  text: string,
  contractType: ContractType,
  intake?: IntakeContext | null,
  playbookText?: string,
  clauseLibrary?: ClauseLibraryEntry[],
): Promise<{ edits: RedlineEdit[]; model: string }> {
  const prompt = buildRedlinePrompt(text, contractType, intake, playbookText, clauseLibrary);

  // Retry up to 2 times if AI returns 0 edits (non-deterministic)
  for (let attempt = 1; attempt <= 2; attempt++) {
    const edits = await _callRedlineAI(prompt);
    console.log(`[redline] attempt ${attempt}: ${edits.length} edits`);
    if (edits.length > 0) {
      return { edits, model: config.AI_MODEL };
    }
  }

  // Return empty if both attempts fail
  return { edits: [], model: config.AI_MODEL };
}

async function _callRedlineAI(prompt: string): Promise<RedlineEdit[]> {
  // 25-50 edits will not fit in 4096 tokens — truncated JSON parses to zero
  // edits and silently burns the retry loop. Stream so the larger cap is safe.
  const stream = anthropic.messages.stream({
    model: config.AI_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: redlineSystemPrompt }],
    tools: [redlineTool],
    tool_choice: { type: "tool", name: "generate_redlines" },
    messages: [{ role: "user", content: prompt }],
  });

  const response = await stream.finalMessage();

  const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
  if (!toolUse) return [];

  const input = toolUse.input as Record<string, unknown>;
  let edits = input.edits as RedlineEdit[] | string | undefined;

  // AI sometimes returns edits as a JSON string
  if (typeof edits === "string") {
    try { edits = JSON.parse(edits); } catch { edits = []; }
  }

  if (!edits || !Array.isArray(edits)) return [];

  return edits;
}

export interface ChangeSummary {
  summary: string;
  keyChanges: { type: "added" | "deleted" | "modified"; clause: string; detail: string; impact: "low" | "medium" | "high" }[];
  model: string;
}

const changesTool: Anthropic.Tool = {
  name: "summarize_changes",
  description: "Summarize the substantive differences between two contract drafts",
  input_schema: {
    type: "object",
    required: ["summary", "keyChanges"],
    properties: {
      summary: { type: "string", description: "2-4 sentence plain-English summary of what changed between the prior version and the new version, from the reviewing party's perspective." },
      keyChanges: {
        type: "array",
        description: "The most substantive changes (max 10). Ignore pure formatting/whitespace.",
        items: {
          type: "object",
          required: ["type", "clause", "detail", "impact"],
          properties: {
            type:   { type: "string", enum: ["added", "deleted", "modified"] },
            clause: { type: "string", description: "Clause/section name or topic affected" },
            detail: { type: "string", description: "What specifically changed" },
            impact: { type: "string", enum: ["low", "medium", "high"], description: "Risk impact of this change on the reviewing party" },
          },
        },
      },
    },
  },
};

// AI summary of what changed between two drafts. `diffText` is a compact
// pre-computed diff so the model focuses on classifying substance, not re-diffing.
export async function summarizeChanges(diffText: string, contractType: ContractType): Promise<ChangeSummary> {
  const response = await anthropic.messages.create({
    model: config.AI_MODEL,
    max_tokens: 2048,
    system: [{ type: "text", text: legalSystemPrompt }],
    tools: [changesTool],
    tool_choice: { type: "tool", name: "summarize_changes" },
    messages: [{
      role: "user",
      content: `Two drafts of a ${contractType.toUpperCase()} contract were compared. Below is a paragraph-level diff (ADDED = only in the new version, DELETED = only in the prior version, MODIFIED = reworded between versions). Summarize the substantive legal changes and their impact on the reviewing party. Ignore formatting-only changes.\n\n${diffText.slice(0, 40000)}`,
    }],
  });

  const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
  if (!toolUse) throw new Error("AI did not return a change summary");
  const input = toolUse.input as { summary: string; keyChanges: ChangeSummary["keyChanges"] };
  return { summary: input.summary, keyChanges: input.keyChanges ?? [], model: config.AI_MODEL };
}

export async function summarizeContract(
  text: string,
  contractType: ContractType
): Promise<string> {
  const stream = anthropic.messages.stream({
    model: config.AI_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: legalSystemPrompt }],
    messages: [{ role: "user", content: buildSummaryPrompt(text, contractType) }],
  });

  const response = await stream.finalMessage();

  const textBlock = response.content.find((c): c is Anthropic.TextBlock => c.type === "text");
  if (!textBlock) throw new Error("AI did not return summary");

  return textBlock.text;
}
