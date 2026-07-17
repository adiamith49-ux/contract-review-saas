"use client";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Trash2, Send, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getChatHistory, sendChatMessage, clearChatHistory, type ChatMessage,
} from "@/lib/api";

interface Props {
  contractId: string;
  isAnalyzed: boolean;
}

export function AIChatFloat({ contractId, isAnalyzed }: Props) {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat history when opening the drawer (only once per open)
  useEffect(() => {
    if (!open || !isAnalyzed || messages.length > 0) return;
    setChatLoading(true);
    getToken()
      .then(token => getChatHistory(token, contractId))
      .then(({ messages: msgs }) => setMessages(msgs))
      .catch(() => {})
      .finally(() => setChatLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!question.trim() || sending) return;
    const q = question.trim();
    setQuestion("");
    setSending(true);

    const tempMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const token = await getToken();
      const { answer } = await sendChatMessage(token, contractId, q);
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: answer, created_at: new Date().toISOString() },
      ]);
    } catch {
      toast.error("Failed to send message");
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  }

  async function handleClearChat() {
    try {
      const token = await getToken();
      await clearChatHistory(token, contractId);
      setMessages([]);
      toast.success("Chat cleared");
    } catch {
      toast.error("Failed to clear chat");
    }
  }

  return (
    <>
      {/* Chat drawer */}
      {open && (
        <div className="fixed bottom-[76px] right-5 z-50 w-[360px] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
          style={{ maxHeight: "min(520px, calc(100vh - 100px))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a17] shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">AI Contract Assistant</span>
            </div>
            <div className="flex items-center gap-0.5">
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>

          <Separator />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
            {!isAnalyzed ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center text-gray-400">
                <FileText className="h-8 w-8 mb-2 opacity-25" />
                <p className="text-xs font-medium">Run analysis first to chat about this contract</p>
              </div>
            ) : chatLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-8 w-2/3 ml-auto" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center text-gray-400">
                <MessageSquare className="h-8 w-8 mb-2 opacity-25" />
                <p className="text-xs font-medium">Ask me anything about this contract</p>
                <p className="text-[10px] mt-1 opacity-60 px-4">
                  e.g. &quot;What is the liability cap?&quot; or &quot;Explain the termination clause&quot;
                </p>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-800 rounded-bl-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <Separator />

          {/* Input */}
          <div className="p-3 flex gap-2 shrink-0 bg-gray-50">
            <Textarea
              placeholder={isAnalyzed ? "Ask about this contract…" : "Run analysis first…"}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              rows={2}
              className="resize-none text-xs bg-white"
              disabled={sending || !isAnalyzed}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!question.trim() || sending || !isAnalyzed}
              className="shrink-0 self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Floating circle button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-primary shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center"
      >
        {open
          ? <X className="h-5 w-5 text-white" />
          : <MessageSquare className="h-5 w-5 text-white" />}
      </button>
    </>
  );
}
