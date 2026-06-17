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
        description: "High-level risk areas identified",
        items: {
          type: "object",
          required: ["area", "risk", "severity", "recommendation"],
          properties: {
            area: { type: "string" },
            risk: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            recommendation: { type: "string" },
          },
        },
      },
      clauseAnalysis: {
        type: "array",
        description: "Clause-by-clause findings",
        items: {
          type: "object",
          required: ["clause", "finding", "risk", "recommendation"],
          properties: {
            clause: { type: "string" },
            finding: { type: "string" },
            risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
            recommendation: { type: "string" },
          },
        },
      },
      negotiationPoints: {
        type: "array",
        description: "Negotiation strategies with fallback positions",
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
        description: "Vague, contradictory, or undefined terms that could create disputes",
        items: {
          type: "object",
          required: ["term", "location", "issue", "suggestion"],
          properties: {
            term: { type: "string", description: "The ambiguous term or phrase" },
            location: { type: "string", description: "Clause or section where it appears" },
            issue: { type: "string", description: "Why this is ambiguous or risky" },
            suggestion: { type: "string", description: "Recommended replacement or clarification" },
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
  const response = await anthropic.beta.promptCaching.messages.create({
    model: config.AI_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: legalSystemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [analysisTool],
    tool_choice: { type: "tool", name: "analyze_contract" },
    messages: [{ role: "user", content: buildContractPrompt(text, contractType, intake, playbookText, clauseLibrary) }],
  });

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
          required: ["clause_ref", "original_text", "revised_text", "edit_type", "risk", "playbook_rule", "rationale"],
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
): Promise<{ edits: RedlineEdit[]; model: string }> {
  const response = await anthropic.beta.promptCaching.messages.create({
    model: config.AI_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: redlineSystemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [redlineTool],
    tool_choice: { type: "tool", name: "generate_redlines" },
    messages: [{
      role: "user",
      content: buildRedlinePrompt(text, contractType, intake, playbookText),
    }],
  });

  const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
  if (!toolUse) throw new Error("AI did not return redline edits");

  console.log("[diag] raw AI response:", JSON.stringify(toolUse.input));
  const { edits } = toolUse.input as { edits: RedlineEdit[] };
  console.log("[diag] parsed edits count:", Array.isArray(edits) ? edits.length : 0);
  return { edits: Array.isArray(edits) ? edits : [], model: config.AI_MODEL };
}

export async function summarizeContract(
  text: string,
  contractType: ContractType
): Promise<string> {
  const response = await anthropic.beta.promptCaching.messages.create({
    model: config.AI_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: legalSystemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildSummaryPrompt(text, contractType) }],
  });

  const textBlock = response.content.find((c): c is Anthropic.TextBlock => c.type === "text");
  if (!textBlock) throw new Error("AI did not return summary");

  return textBlock.text;
}
