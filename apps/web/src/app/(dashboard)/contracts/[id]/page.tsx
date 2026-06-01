"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft, Download, Loader2, AlertTriangle, Send, Trash2,
  FileText, ChevronRight, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getContract, analyzeContract, getChatHistory, sendChatMessage, clearChatHistory,
  type ContractDetail, type ChatMessage,
} from "@/lib/api";
import { formatDate, formatFileSize, CONTRACT_TYPE_LABELS } from "@/lib/utils";

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const token = await getToken();
      const { contract } = await getContract(token, id);
      setContract(contract);

      if (contract.status === "analyzed") {
        setChatLoading(true);
        const { messages } = await getChatHistory(token, id);
        setMessages(messages);
        setChatLoading(false);
      }
    } catch {
      toast.error("Failed to load contract");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleAnalyze() {
    if (!contract) return;
    setAnalyzing(true);
    try {
      const token = await getToken();
      await analyzeContract(token, id);
      toast.success("Analysis complete!");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSend() {
    if (!question.trim() || sending) return;
    const q = question.trim();
    setQuestion("");
    setSending(true);

    const tempUser: ChatMessage = { id: crypto.randomUUID(), role: "user", content: q, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, tempUser]);

    try {
      const token = await getToken();
      const { answer } = await sendChatMessage(token, id, q);
      const tempAI: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: answer, created_at: new Date().toISOString() };
      setMessages((prev) => [...prev, tempAI]);
    } catch {
      toast.error("Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
    } finally {
      setSending(false);
    }
  }

  async function handleClearChat() {
    try {
      const token = await getToken();
      await clearChatHistory(token, id);
      setMessages([]);
      toast.success("Chat history cleared");
    } catch {
      toast.error("Failed to clear chat");
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (!contract) return null;

  const analysis = contract.analyses?.[0];
  const isAnalyzed = contract.status === "analyzed" && analysis;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back */}
      <Link href="/contracts" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        All Contracts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{contract.filename}</h1>
            <StatusBadge status={contract.status} />
            {analysis && <RiskBadge level={analysis.risk_level} />}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {CONTRACT_TYPE_LABELS[contract.contract_type]} · {formatFileSize(contract.file_size)} · Uploaded {formatDate(contract.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAnalyzed && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/contracts/${id}/export`}>
                <Download className="h-4 w-4 mr-1.5" />
                Export
              </Link>
            </Button>
          )}
          {!isAnalyzed && contract.status !== "processing" && (
            <Button onClick={handleAnalyze} disabled={analyzing} size="sm">
              {analyzing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Analyzing…</> : <><RefreshCw className="h-4 w-4 mr-1.5" />Run Analysis</>}
            </Button>
          )}
          {contract.status === "processing" && (
            <Button disabled size="sm">
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Processing…
            </Button>
          )}
        </div>
      </div>

      {!isAnalyzed ? (
        <NotAnalyzedState status={contract.status} onAnalyze={handleAnalyze} analyzing={analyzing} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Analysis tabs (2/3) */}
          <div className="xl:col-span-2">
            <Card>
              <CardContent className="pt-6">
                <Tabs defaultValue="risk">
                  <TabsList className="mb-4">
                    <TabsTrigger value="risk">Risk Summary ({analysis.risk_summary.length})</TabsTrigger>
                    <TabsTrigger value="clauses">Clauses ({analysis.clause_analysis.length})</TabsTrigger>
                    <TabsTrigger value="negotiation">Negotiation ({analysis.negotiation_points.length})</TabsTrigger>
                  </TabsList>

                  {/* Risk Summary */}
                  <TabsContent value="risk">
                    <div className="space-y-3">
                      {analysis.risk_summary.map((item, i) => (
                        <div key={i} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <p className="font-medium text-gray-900 text-sm">{item.area}</p>
                            <RiskBadge level={item.severity as any} />
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{item.risk}</p>
                          <div className="flex items-start gap-2 bg-blue-50 rounded p-2.5">
                            <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-blue-800">{item.recommendation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Clause Analysis */}
                  <TabsContent value="clauses">
                    <div className="space-y-3">
                      {analysis.clause_analysis.map((item, i) => (
                        <div key={i} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <p className="font-medium text-gray-900 text-sm">{item.clause}</p>
                            <RiskBadge level={item.risk} />
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{item.finding}</p>
                          <div className="flex items-start gap-2 bg-blue-50 rounded p-2.5">
                            <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-blue-800">{item.recommendation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Negotiation Points */}
                  <TabsContent value="negotiation">
                    <div className="space-y-3">
                      {analysis.negotiation_points.map((item, i) => (
                        <div key={i} className="rounded-lg border p-4">
                          <p className="font-semibold text-gray-900 text-sm mb-3">{item.point}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded bg-emerald-50 p-3">
                              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Preferred Position</p>
                              <p className="text-xs text-emerald-800">{item.preferredPosition}</p>
                            </div>
                            <div className="rounded bg-amber-50 p-3">
                              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Fallback Position</p>
                              <p className="text-xs text-amber-800">{item.fallbackPosition}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
                <p className="text-xs text-gray-400 mt-4 text-center">
                  AI-generated insights are not legal advice · Analyzed by {analysis.model}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chat panel (1/3) */}
          <div className="xl:col-span-1">
            <Card className="flex flex-col h-[600px]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Ask about this contract</CardTitle>
                  {messages.length > 0 && (
                    <button onClick={handleClearChat} className="text-gray-400 hover:text-red-500 transition-colors" title="Clear chat">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <Separator />
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-3/4" />
                    <Skeleton className="h-10 w-2/3 ml-auto" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                    <FileText className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-xs">Ask me anything about this contract</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${m.role === "user" ? "bg-primary text-white" : "bg-gray-100 text-gray-800"}`}>
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-3 py-2">
                      <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <Separator />
              {/* Input */}
              <div className="p-3 flex gap-2">
                <Textarea
                  placeholder="Ask a question…"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  rows={2}
                  className="resize-none text-xs"
                  disabled={sending}
                />
                <Button size="icon" onClick={handleSend} disabled={!question.trim() || sending} className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function NotAnalyzedState({ status, onAnalyze, analyzing }: { status: string; onAnalyze: () => void; analyzing: boolean }) {
  if (status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="font-medium text-gray-700">AI is analyzing your contract…</p>
        <p className="text-sm text-gray-400 mt-1">This usually takes 30–60 seconds</p>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle className="h-10 w-10 text-red-400 mb-4" />
        <p className="font-medium text-gray-700">Analysis failed</p>
        <p className="text-sm text-gray-400 mt-1">Something went wrong. Try running the analysis again.</p>
        <Button onClick={onAnalyze} disabled={analyzing} className="mt-6">
          {analyzing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Retrying…</> : <><RefreshCw className="h-4 w-4 mr-2" />Retry Analysis</>}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <FileText className="h-10 w-10 text-gray-300 mb-4" />
      <p className="font-medium text-gray-700">Contract uploaded — ready for analysis</p>
      <p className="text-sm text-gray-400 mt-1">Run the AI analysis to get risk flags and negotiation points</p>
      <Button onClick={onAnalyze} disabled={analyzing} className="mt-6">
        {analyzing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing…</> : "Run AI Analysis"}
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-4 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
