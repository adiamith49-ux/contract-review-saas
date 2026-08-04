import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult, ContractType } from "../types.js";
import { config } from "../config.js";
import { buildAnalysisSystemPrompt, buildContractPrompt, buildRedlinePrompt, buildSummaryPrompt, legalSystemPrompt, redlineSystemPrompt, type ClauseLibraryEntry, type SegmentContext } from "./prompts.js";
import type { RedlineEdit } from "./redline.service.js";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

// The tool schema is the third place the output budget has to be stated. The
// model reads the schema descriptions as instructions, so a schema promising
// "NO ITEM LIMIT ... 20-40 entries" will override a bounded system prompt and
// run the response past max_tokens. maxItems === null means no cap.
function buildAnalysisTool(maxItems: number | null): Anthropic.Tool {
  const clauseDescription = maxItems === null
    ? "One entry per commercially significant one-sided or problematic provision, in document order. NO ITEM LIMIT — completeness matters more than brevity. Cover every section that warrants it, including schedules, riders and addenda. A heavily one-sided enterprise agreement should produce 20-40 entries."
    : `One entry per commercially significant one-sided or problematic provision, in document order. HARD MAXIMUM ${maxItems} ENTRIES — report only the ${maxItems} most damaging and most one-sided provisions. Exceeding ${maxItems} truncates the response and loses the entire review.`;

  const languageDescription = maxItems === null
    ? "Complete replacement clause text ready to insert into the contract. Must be full drafted legal language including the conditions, exceptions, carve-outs and mutuality a commercial lawyer would expect — not negotiation advice or a summary. For limitation of liability, draft a balanced framework (general cap, mutual consequential-loss exclusion, and carve-outs for confidentiality, IP infringement, data protection/security, fraud, gross negligence, wilful misconduct, payment obligations, and regulatory fines where appropriate) — never a bare 12-month cap."
    : "Replacement clause text ready to insert into the contract — real drafted language, not negotiation advice. Keep it to the essential operative sentences plus the one or two carve-outs that matter most: about 60 words, hard ceiling 120.";

  const listLimit = maxItems === null ? "No item limit." : "At most 6 entries.";

  return {
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
          description: `High-level risk themes across the agreement. ${listLimit}`,
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
          description: clauseDescription,
          items: {
            type: "object",
            required: ["clause", "finding", "risk", "recommendation"],
            properties: {
              clause: { type: "string", description: "Section reference and name, e.g. 'Section 9.2 — Service Credits'" },
              finding: { type: "string" },
              risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
              recommendation: { type: "string" },
              contractText: {
                type: "string",
                description: "The clause language being flagged, copied VERBATIM character-for-character from the contract text — same wording, punctuation, capitalisation and spacing. Never paraphrase, summarise, tidy up or re-quote from memory: this string is matched back against the source to anchor the redline, and a paraphrase cannot be placed. One or two key sentences is the right length.",
              },
              suggestedLanguage: { type: "string", description: languageDescription },
              playbookRule: { type: "string", description: "If this finding deviates from a company playbook rule, name the playbook and rule that was triggered (e.g. 'SaaS Playbook — Liability cap: 12 months fees'). Omit if no playbook rule applies." },
            },
          },
        },
        negotiationPoints: {
          type: "array",
          description: `Negotiation leverage points, most commercially valuable first. ${listLimit}`,
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
          description: `Vague or undefined terms that gate an obligation, remedy or termination right — 'reasonable', 'material', 'best efforts', 'promptly', 'industry standard', 'satisfactory to Customer'. ${listLimit}`,
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
}

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

// ─── Output budgeting ────────────────────────────────────────────────────────
// Analysis wall-clock time is dominated by output tokens (~70-90 tok/s), and the
// response MUST finish inside both max_tokens and the serverless function's max
// duration. Overrunning max_tokens is not a partial result — the tool-call JSON
// is cut mid-object and the whole review is lost. So the number of findings we
// ask for is derived from the budget rather than being a fixed cap.

// riskSummary + negotiationPoints + ambiguityFlags + JSON scaffolding.
const ANALYSIS_OVERHEAD_TOKENS = 2000;
// A concise finding with a ~60-word suggestedLanguage, measured against live runs.
const TOKENS_PER_FINDING = 520;
// At or above this budget there is room for uncapped findings at full drafted length.
const UNCAPPED_BUDGET_TOKENS = 16000;
// Slice size for segmented review. Small enough that one slice's findings fit
// the per-call budget comfortably.
const SEGMENT_CHARS = 28_000;
// Segments run concurrently, so wall-clock ≈ one segment per wave. Bounded to
// stay well inside API rate limits.
const SEGMENT_CONCURRENCY = 5;

function findingBudget(maxTokens: number): number | null {
  if (maxTokens >= UNCAPPED_BUDGET_TOKENS) return null;
  return Math.max(4, Math.floor((maxTokens - ANALYSIS_OVERHEAD_TOKENS) / TOKENS_PER_FINDING));
}

// Split at paragraph boundaries so a slice rarely starts mid-clause.
function splitIntoSegments(text: string, size: number): string[] {
  if (text.length <= size) return [text];

  const segments: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + size);
    if (end < text.length) {
      const window = text.slice(start, end);
      const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"));
      // Only honour the break if it isn't so early that it shrinks the slice badly.
      if (breakAt > size * 0.6) end = start + breakAt;
    }
    segments.push(text.slice(start, end));
    start = end;
  }
  return segments;
}

// ─── Truncated-response salvage ──────────────────────────────────────────────
// If a run still overruns its budget, the accumulated tool-call JSON is valid
// right up to the cut. Recovering the complete findings is far better than
// throwing the run away, so trim back to the last complete object and close the
// open brackets.
function closeOpenStructures(json: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of json) {
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }

  return json + stack.reverse().map(c => (c === "{" ? "}" : "]")).join("");
}

function salvageToolInput(partialJson: string): Record<string, unknown> | null {
  let cut = partialJson.length;
  for (let attempt = 0; attempt < 8; attempt++) {
    cut = partialJson.lastIndexOf("}", cut - 1);
    if (cut < 0) return null;
    try {
      const parsed = JSON.parse(closeOpenStructures(partialJson.slice(0, cut + 1)));
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // keep trimming
    }
  }
  return null;
}

interface SegmentResult {
  analysis: Partial<AnalysisResult>;
  truncated: boolean;
}

async function analyzeSegment(
  text: string,
  contractType: ContractType,
  maxItems: number | null,
  segment: SegmentContext | undefined,
  intake?: IntakeContext | null,
  playbookText?: string,
  clauseLibrary?: ClauseLibraryEntry[]
): Promise<SegmentResult> {
  const stream = anthropic.messages.stream({
    model: config.AI_MODEL,
    max_tokens: config.ANALYSIS_MAX_TOKENS,
    system: [{ type: "text", text: buildAnalysisSystemPrompt(maxItems) }],
    tools: [buildAnalysisTool(maxItems)],
    tool_choice: { type: "tool", name: "analyze_contract" },
    messages: [{
      role: "user",
      content: buildContractPrompt(text, contractType, intake, playbookText, clauseLibrary, maxItems, segment),
    }],
  });

  // Capture the raw tool-call JSON as it streams, so a truncated response can
  // still be salvaged — response.content gives no usable input in that case.
  let partialJson = "";
  stream.on("streamEvent", event => {
    if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
      partialJson += event.delta.partial_json;
    }
  });

  const response = await stream.finalMessage();
  const label = segment ? `segment ${segment.index}/${segment.total}` : "single pass";

  if (response.stop_reason === "max_tokens") {
    const salvaged = salvageToolInput(partialJson);
    const findings = (salvaged?.clauseAnalysis as unknown[] | undefined)?.length ?? 0;
    if (salvaged && findings >= 2) {
      console.warn(`[analysis] ${label} hit max_tokens; salvaged ${findings} complete findings`);
      return { analysis: salvaged as Partial<AnalysisResult>, truncated: true };
    }
    throw new Error(
      `Analysis output exceeded the token limit on ${label} and could not be recovered. ` +
      `Try again, or reduce ANALYSIS_MAX_TOKENS so the review is bounded more tightly.`
    );
  }

  const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
  if (!toolUse) throw new Error(`AI did not return structured analysis on ${label}`);

  return { analysis: toolUse.input as Partial<AnalysisResult>, truncated: false };
}

const RISK_ORDER = ["low", "medium", "high", "critical"] as const;
type RiskLevel = (typeof RISK_ORDER)[number];

function highestRisk(levels: (string | undefined)[]): RiskLevel {
  let worst = 0;
  for (const level of levels) {
    const idx = RISK_ORDER.indexOf(level as RiskLevel);
    if (idx > worst) worst = idx;
  }
  return RISK_ORDER[worst];
}

// Segments overlap conceptually (a theme can surface in several slices), so the
// merged lists are deduped on the field that identifies the item to a reader.
function dedupeBy<T>(items: T[], key: (item: T) => string, limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function analyzeContract(
  text: string,
  contractType: ContractType,
  intake?: IntakeContext | null,
  playbookText?: string,
  clauseLibrary?: ClauseLibraryEntry[]
): Promise<AnalysisResult & { model: string }> {
  // Streaming is required, not an optimisation: a non-streamed request with a
  // large max_tokens hits the SDK's HTTP timeout.
  //
  // config.ANALYSIS_MAX_TOKENS is the per-call output ceiling and must fit the
  // serverless function's max duration, or the function is killed mid-run and
  // the contract wedges at "processing". Default 8000 (~60-90s per call).
  //
  // Coverage does NOT come from raising that ceiling — it comes from splitting
  // long contracts into slices reviewed IN PARALLEL. Each slice gets the full
  // per-call budget for a fraction of the document, so total findings scale with
  // document length while wall-clock stays at roughly one call per wave.
  const maxItems = findingBudget(config.ANALYSIS_MAX_TOKENS);
  const segments = maxItems === null ? [text] : splitIntoSegments(text, SEGMENT_CHARS);

  if (segments.length === 1) {
    const { analysis } = await analyzeSegment(
      text, contractType, maxItems, undefined, intake, playbookText, clauseLibrary
    );
    return { ...(analysis as AnalysisResult), model: config.AI_MODEL };
  }

  console.log(`[analysis] ${text.length} chars → ${segments.length} segments × ${maxItems} findings, ${SEGMENT_CONCURRENCY} at a time`);

  let charsSoFar = 0;
  const bounds = segments.map(segment => {
    const from = charsSoFar;
    charsSoFar += segment.length;
    return `characters ${from.toLocaleString()}–${charsSoFar.toLocaleString()} of ${text.length.toLocaleString()}`;
  });

  const settled = await runWithConcurrency(segments, SEGMENT_CONCURRENCY, async (segmentText, i) =>
    analyzeSegment(
      segmentText,
      contractType,
      maxItems,
      { index: i + 1, total: segments.length, label: bounds[i] },
      intake,
      playbookText,
      clauseLibrary
    ).catch((err: unknown) => {
      // One bad slice must not sink a review of the other 90% of the document.
      console.error(`[analysis] segment ${i + 1}/${segments.length} failed:`, err);
      return null;
    })
  );

  const ok = settled.filter((r): r is SegmentResult => r !== null);
  if (ok.length === 0) {
    throw new Error("Analysis failed on every section of the contract. Please try again.");
  }
  if (ok.length < segments.length) {
    console.warn(`[analysis] ${segments.length - ok.length}/${segments.length} segments failed; returning partial coverage`);
  }

  const parts = ok.map(r => r.analysis);
  const merged: AnalysisResult = {
    riskLevel: highestRisk(parts.map(p => p.riskLevel)),
    riskSummary: dedupeBy(parts.flatMap(p => p.riskSummary ?? []), s => s.area ?? "", 14),
    clauseAnalysis: dedupeBy(parts.flatMap(p => p.clauseAnalysis ?? []), c => c.clause ?? "", 60),
    negotiationPoints: dedupeBy(parts.flatMap(p => p.negotiationPoints ?? []), n => n.point ?? "", 14),
    ambiguityFlags: dedupeBy(
      parts.flatMap(p => p.ambiguityFlags ?? []),
      a => `${a.term ?? ""} ${a.location ?? ""}`,
      24
    ),
  };

  // Be explicit in the output when coverage is known to be incomplete — a silent
  // gap reads as "nothing wrong here", which is the worst possible failure mode
  // for a contract review.
  const incomplete = segments.length - ok.length;
  if (incomplete > 0 || ok.some(r => r.truncated)) {
    merged.riskSummary = [
      {
        area: "Review coverage",
        risk: incomplete > 0
          ? `${incomplete} of ${segments.length} sections of this document could not be reviewed in this run. Re-run the analysis for complete coverage.`
          : "Part of this review reached its response limit, so the lowest-priority findings in one or more sections may be missing.",
        severity: "medium",
        recommendation: "Re-run the analysis, or review the affected sections manually.",
      },
      ...merged.riskSummary,
    ];
  }

  console.log(`[analysis] merged ${merged.clauseAnalysis.length} findings from ${ok.length}/${segments.length} segments`);
  return { ...merged, model: config.AI_MODEL };
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
