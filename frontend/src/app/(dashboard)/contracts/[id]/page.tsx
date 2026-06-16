"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft, Download, Loader2, AlertTriangle, FileText, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ReviewPanel } from "@/components/ReviewPanel";
import { DocumentViewer } from "@/components/DocumentViewer";
import { AIChatFloat } from "@/components/AIChatFloat";
import { getContract, analyzeContract, downloadExport, getRedlines, type ContractDetail, type RedlineStats } from "@/lib/api";
import { formatDate, formatFileSize, CONTRACT_TYPE_LABELS } from "@/lib/utils";

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [redlineStats, setRedlineStats] = useState<RedlineStats | null>(null);

  async function load() {
    try {
      const token = await getToken();
      const [{ contract }, { redlines }] = await Promise.all([
        getContract(token, id),
        getRedlines(token, id),
      ]);
      setContract(contract);
      setRedlineStats(redlines);
    } catch {
      toast.error("Failed to load contract");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function handleDownload() {
    if (!contract) return;
    try {
      const token = await getToken();
      await downloadExport(token, id, "docx", contract.filename);
      toast.success("Download started");
    } catch {
      toast.error("Download failed");
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (!contract) return null;

  const analysis = contract.analyses?.[0] ?? null;
  const isAnalyzed = contract.status === "analyzed" && !!analysis;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Contract header bar ─────────────────────────────────────────── */}
      <div className="shrink-0 px-5 py-2.5 border-b bg-white flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/contracts"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-800 transition-colors shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Contracts
          </Link>
          <span className="text-gray-200 select-none">|</span>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h1 className="text-sm font-semibold text-gray-900 truncate max-w-xs">
              {contract.filename}
            </h1>
            <StatusBadge status={contract.status} />
            {analysis && <RiskBadge level={analysis.risk_level} />}
          </div>
          <span className="hidden lg:block text-xs text-gray-400 shrink-0">
            {CONTRACT_TYPE_LABELS[contract.contract_type]}
            {" · "}
            {formatFileSize(contract.file_size)}
            {" · "}
            {formatDate(contract.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAnalyzed && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/contracts/${id}/export`}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download Review
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAnalyze}
                disabled={analyzing}
                title="Re-run AI analysis"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${analyzing ? "animate-spin" : ""}`} />
                Re-analyze
              </Button>
            </>
          )}
          {!isAnalyzed && contract.status !== "processing" && (
            <Button onClick={handleAnalyze} disabled={analyzing} size="sm">
              {analyzing
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Analyzing…</>
                : "Run AI Analysis"}
            </Button>
          )}
          {contract.status === "processing" && (
            <Button disabled size="sm">
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Processing…
            </Button>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {!isAnalyzed ? (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <NotAnalyzedState
            status={contract.status}
            onAnalyze={handleAnalyze}
            analyzing={analyzing}
          />
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {/* Document viewer — full width, scrolls independently */}
          <div className="absolute inset-0">
            <DocumentViewer
              text={contract.extracted_text}
              analysis={analysis}
              activeId={activeId}
            />
          </div>

          {/* Review panel — floating left overlay */}
          {panelOpen && (
            <ReviewPanel
              analysis={analysis}
              activeId={activeId}
              onActiveChange={newId => setActiveId(prev => prev === newId ? null : newId)}
              onClose={() => setPanelOpen(false)}
              onDownload={handleDownload}
              redlinePlaced={redlineStats?.placed_count}
              redlineTotal={redlineStats?.total_count}
            />
          )}

          {/* Toggle tab when panel is collapsed */}
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-[#1a2035] text-white rounded-r-lg px-1.5 py-4 shadow-lg hover:opacity-90 transition-opacity"
              title="Show AI Review Panel"
            >
              <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold tracking-widest uppercase select-none">
                AI Review
              </span>
            </button>
          )}
        </div>
      )}

      {/* Floating AI Chat button */}
      <AIChatFloat contractId={id} isAnalyzed={isAnalyzed} />
    </div>
  );
}

// ─── Not-analyzed state ───────────────────────────────────────────────────────

function NotAnalyzedState({
  status, onAnalyze, analyzing,
}: {
  status: string;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
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
          {analyzing
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Retrying…</>
            : <><RefreshCw className="h-4 w-4 mr-2" />Retry Analysis</>}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <FileText className="h-10 w-10 text-gray-300 mb-4" />
      <p className="font-medium text-gray-700">Contract uploaded — ready for analysis</p>
      <p className="text-sm text-gray-400 mt-1">
        Run AI analysis to get risk flags, clause review, and negotiation points
      </p>
      <Button onClick={onAnalyze} disabled={analyzing} className="mt-6">
        {analyzing
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing…</>
          : "Run AI Analysis"}
      </Button>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-5 py-2.5 border-b bg-white flex items-center gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-[310px] border-r p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <div className="flex-1 p-8 space-y-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-20 w-full mt-4" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-full" />
        </div>
      </div>
    </div>
  );
}
