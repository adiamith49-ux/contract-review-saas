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
        description: "Top 3-4 high-level risk areas",
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
        description: "Top 3-5 clause-level risk findings",
        items: {
          type: "object",
          required: ["clause", "finding", "risk", "recommendation"],
          properties: {
            clause: { type: "string" },
            finding: { type: "string" },
            risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
            recommendation: { type: "string" },
            contractText: { type: "string" },
            suggestedLanguage: { type: "string" },
          },
        },
      },
      negotiationPoints: {
        type: "array",
        description: "Top 2-3 negotiation leverage points",
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
    },
  },
};

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
  const stream = anthropic.messages.stream({
    model: config.AI_MODEL,
    max_tokens: 2000,
    system: [{ type: "text", text: legalSystemPrompt }],
    tools: [analysisTool],
    tool_choice: { type: "tool", name: "analyze_contract" },
    messages: [{ role: "user", content: buildContractPrompt(text, contractType, intake, playbookText, clauseLibrary) }],
  });

  const response = await stream.finalMessage();

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
  const response = await anthropic.messages.create({
    model: config.AI_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: redlineSystemPrompt }],
    tools: [redlineTool],
    tool_choice: { type: "tool", name: "generate_redlines" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
  if (!toolUse) {
    console.log("[redline] no tool_use block in response");
    return [];
  }

  const input = toolUse.input as Record<string, unknown>;
  let edits = input.edits as RedlineEdit[] | string | undefined;

  // AI sometimes returns edits as a JSON string
  if (typeof edits === "string") {
    try { edits = JSON.parse(edits); } catch { edits = []; }
  }

  if (!edits || !Array.isArray(edits)) {
    console.log("[redline] unexpected edits format:", typeof edits, JSON.stringify(input).slice(0, 300));
    return [];
  }

  return edits;
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
