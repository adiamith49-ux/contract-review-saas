import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult } from "@contralyn/shared";
import { config } from "../config.js";
import { legalSystemPrompt } from "./prompts.js";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildContractContext(
  contractText: string,
  contractType: string,
  analysis: AnalysisResult | null
): string {
  let context = `CONTRACT TYPE: ${contractType.replace("_", " ").toUpperCase()}\n\nCONTRACT TEXT:\n${contractText.slice(0, 120000)}`;

  if (analysis) {
    context += `\n\nPREVIOUS AI ANALYSIS FINDINGS:
Overall Risk: ${analysis.riskLevel.toUpperCase()}

Risk Areas:
${analysis.riskSummary.map((r) => `- ${r.area} [${r.severity}]: ${r.risk}`).join("\n")}

Key Clause Findings:
${analysis.clauseAnalysis.map((c) => `- ${c.clause} [${c.risk}]: ${c.finding}`).join("\n")}

Negotiation Points:
${analysis.negotiationPoints.map((n) => `- ${n.point}: Preferred — ${n.preferredPosition}`).join("\n")}`;
  }

  return context;
}

export async function chatWithContract(params: {
  contractText: string;
  contractType: string;
  analysis: AnalysisResult | null;
  history: ChatMessage[];
  question: string;
}): Promise<string> {
  const contextMessage = buildContractContext(
    params.contractText,
    params.contractType,
    params.analysis
  );

  // Keep last 20 messages (10 turns) to stay within context limits
  const recentHistory = params.history.slice(-20);

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `You are reviewing the following contract. Use this as your reference for all questions in this conversation.\n\n${contextMessage}`,
    },
    {
      role: "assistant",
      content: "I have reviewed the contract and the prior analysis. I'm ready to answer your questions about it.",
    },
    ...recentHistory,
    { role: "user", content: params.question },
  ];

  const response = await anthropic.messages.create({
    model: config.AI_MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text:
          legalSystemPrompt +
          "\n\nYou are now in Q&A mode for a specific contract. Answer the user's questions precisely based on the contract text and prior analysis. Be concise and practical. Always reference the specific clause or section when answering.",
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  const textBlock = response.content.find((c): c is Anthropic.TextBlock => c.type === "text");
  if (!textBlock) throw new Error("No response from AI");

  return textBlock.text;
}
