import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult, ContractType } from "../types.js";
import { config } from "../config.js";
import { buildContractPrompt, buildSummaryPrompt, legalSystemPrompt, type ClauseLibraryEntry } from "./prompts.js";

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
