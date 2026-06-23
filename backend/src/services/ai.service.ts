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
    required: ["riskLevel", "riskSummary", "clauseAnalysis", "negotiationPoints", "extractedClauses", "missingClauses", "contractMetadata"],
    properties: {
      riskLevel: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        description: "Overall risk level of the contract",
      },
      contractMetadata: {
        type: "object",
        description: "Key metadata extracted from the contract text",
        required: ["parties", "effectiveDate", "governingLaw"],
        properties: {
          parties: {
            type: "array",
            description: "All parties to the contract with their roles",
            items: {
              type: "object",
              required: ["name", "role"],
              properties: {
                name: { type: "string", description: "Party name as written in the contract" },
                role: { type: "string", description: "Role: e.g. 'Disclosing Party', 'Service Provider', 'Customer', 'Vendor', 'Licensor'" },
              },
            },
          },
          effectiveDate: { type: "string", description: "Contract effective/start date, or 'Not specified'" },
          expirationDate: { type: "string", description: "Contract end/expiration date, or 'Not specified'" },
          term: { type: "string", description: "Contract duration/term, e.g. '2 years', 'Perpetual', or 'Not specified'" },
          renewalTerms: { type: "string", description: "Auto-renewal terms and notice period, or 'Not specified'" },
          noticePeriod: { type: "string", description: "Required notice period for termination or non-renewal, or 'Not specified'" },
          governingLaw: { type: "string", description: "Governing law and jurisdiction as stated in the contract" },
          disputeResolution: { type: "string", description: "How disputes are resolved: arbitration, mediation, litigation, or 'Not specified'" },
          totalValue: { type: "string", description: "Total contract value or fee structure, or 'Not specified'" },
          paymentTerms: { type: "string", description: "Payment schedule/terms, or 'Not specified'" },
        },
      },
      extractedClauses: {
        type: "array",
        description: "All standard commercial clauses found in the contract. Extract every substantive clause with its verbatim text.",
        items: {
          type: "object",
          required: ["clauseType", "title", "verbatimText", "summary", "risk", "section"],
          properties: {
            clauseType: {
              type: "string",
              enum: [
                "confidentiality", "indemnification", "limitation_of_liability",
                "termination", "ip_ownership", "data_protection", "governing_law",
                "payment_terms", "representations_warranties", "non_compete",
                "non_solicitation", "force_majeure", "assignment", "dispute_resolution",
                "insurance", "audit_rights", "compliance", "notice_provisions",
                "entire_agreement", "amendment", "severability", "survival", "other"
              ],
              description: "Standard clause category",
            },
            title: { type: "string", description: "Clause heading as it appears in the contract, e.g. 'Section 8 — Limitation of Liability'" },
            verbatimText: { type: "string", description: "EXACT verbatim text of the clause from the contract. Copy the full clause text character-for-character." },
            summary: { type: "string", description: "Plain-English summary of what this clause means and its practical implications" },
            risk: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Risk level of this specific clause" },
            section: { type: "string", description: "Section/article number reference, e.g. 'Section 8.2', 'Article IV'" },
            issues: {
              type: "array",
              description: "Specific issues or concerns with this clause",
              items: { type: "string" },
            },
          },
        },
      },
      missingClauses: {
        type: "array",
        description: "Standard commercial clauses that SHOULD be present in this type of contract but are missing or inadequately addressed",
        items: {
          type: "object",
          required: ["clauseType", "importance", "recommendation"],
          properties: {
            clauseType: { type: "string", description: "Type of missing clause, e.g. 'Data Protection', 'Force Majeure'" },
            importance: { type: "string", enum: ["critical", "important", "recommended"], description: "How important this missing clause is" },
            recommendation: { type: "string", description: "What should be added and why" },
            suggestedLanguage: { type: "string", description: "Draft language for the missing clause" },
          },
        },
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
        description: "Clause-by-clause risk findings — each finding must reference specific contract language",
        items: {
          type: "object",
          required: ["clause", "finding", "risk", "recommendation"],
          properties: {
            clause: { type: "string" },
            finding: { type: "string" },
            risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
            recommendation: { type: "string" },
            contractText: { type: "string", description: "The exact contract text that triggered this finding" },
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
    max_tokens: 8192,
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
  clauseLibrary?: ClauseLibraryEntry[],
): Promise<{ edits: RedlineEdit[]; model: string }> {
  const response = await anthropic.beta.promptCaching.messages.create({
    model: config.AI_MODEL,
    max_tokens: 4096,
    system: [{ type: "text", text: redlineSystemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [redlineTool],
    tool_choice: { type: "tool", name: "generate_redlines" },
    messages: [{
      role: "user",
      content: buildRedlinePrompt(text, contractType, intake, playbookText, clauseLibrary),
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
