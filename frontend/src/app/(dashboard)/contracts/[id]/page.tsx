"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft, Download, Loader2, AlertTriangle, FileText, RefreshCw, GitPullRequest,
  AlignLeft, X, Pencil, Building2, Calendar, User, DollarSign, Globe, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ReviewPanel } from "@/components/ReviewPanel";
import { DocumentViewer } from "@/components/DocumentViewer";
import { RedlineViewer } from "@/components/RedlineViewer";
import { IntakePanel } from "@/components/IntakePanel";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { MatterWorkspace } from "@/components/MatterWorkspace";
import { AIChatFloat } from "@/components/AIChatFloat";
import {
  getContract, analyzeContract, downloadExport,
  runRedline, downloadRedlineDocx, summarizeContract, updateContractMetadata,
  type ContractDetail, type RedlineResult,
} from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { formatDate, formatDateShort, formatCurrency, formatFileSize, CONTRACT_TYPE_LABELS, getLifecycleBadge, CONTRACT_BUSINESS_STATUS_LABELS } from "@/lib/utils";
import type { ContractType } from "@/lib/types";

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"review" | "redline">("review");
  const [redlineResult, setRedlineResult] = useState<RedlineResult | null>(null);
  const [redlining, setRedlining] = useState(false);
  const [downloadingRedline, setDownloadingRedline] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);

  function handleApply(id: string) {
    setAppliedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleApplyAll(analysis: { risk_summary: unknown[]; clause_analysis: unknown[]; negotiation_points: unknown[]; ambiguity_flags?: unknown[] }) {
    const ids = [
      ...analysis.risk_summary.map((_, i) => `r-${i}`),
      ...analysis.clause_analysis.map((_, i) => `c-${i}`),
      ...analysis.negotiation_points.map((_, i) => `n-${i}`),
      ...(analysis.ambiguity_flags ?? []).map((_, i) => `a-${i}`),
    ];
    setAppliedIds(new Set(ids));
  }

  async function load() {
    try {
      const token = await getToken();
      const { contract } = await getContract(token, id);
      setContract(contract);
      if (contract.summary) setSummary(contract.summary);
    } catch {
      toast.error("Failed to load contract");
    } finally {
      setLoading(false);
    }
  }

  async function handleSummarize() {
    setSummarizing(true);
    setSummaryOpen(true);
    try {
      const token = await getToken();
      const { summary: s } = await summarizeContract(token, id);
      setSummary(s);
    } catch {
      toast.error("Failed to generate summary");
      setSummaryOpen(false);
    } finally {
      setSummarizing(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveMetadata(data: Parameters<typeof updateContractMetadata>[2]) {
    setMetaSaving(true);
    try {
      const token = await getToken();
      await updateContractMetadata(token, id, data);
      await load();
      setEditMetaOpen(false);
      toast.success("Contract updated");
    } catch {
      toast.error("Failed to update contract");
    } finally {
      setMetaSaving(false);
    }
  }

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
      await downloadExport(token, id, "docx", contract.filename, appliedIds.size > 0 ? appliedIds : undefined);
      toast.success("Download started");
    } catch {
      toast.error("Download failed");
    }
  }

  async function handleRedline() {
    if (!contract) return;
    setRedlining(true);
    setView("redline");
    try {
      const token = await getToken();
      const result = await runRedline(token, id);
      setRedlineResult(result);
      if (result.matched_count === 0) {
        toast.warning("Redlines generated but none could be placed — see the Redline Edits panel");
      } else if (result.unmatched_count > 0) {
        toast.success(`${result.matched_count} edits placed inline · ${result.unmatched_count} unplaced`);
      } else {
        toast.success(`${result.matched_count} redline edits placed inline`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Redline failed");
      setView("review");
    } finally {
      setRedlining(false);
    }
  }

  async function handleDownloadRedline() {
    if (!contract) return;
    setDownloadingRedline(true);
    try {
      const token = await getToken();
      await downloadRedlineDocx(token, id, contract.filename, redlineResult?.edits ?? []);
      toast.success("Redline DOCX downloaded");
    } catch {
      toast.error("Redline download failed");
    } finally {
      setDownloadingRedline(false);
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (!contract) return null;

  const analysis = contract.analyses?.[0] ?? null;
  const isAnalyzed = contract.status === "analyzed" && !!analysis;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Contract header bar ─────────────────────────────────────────── */}
      <div className="shrink-0 px-3 md:px-5 py-2.5 border-b bg-white flex items-center justify-between gap-2 md:gap-4 z-20">
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
              {contract.title || contract.filename}
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
              {/* View toggle tabs */}
              <div className="flex items-center rounded-md border bg-gray-50 p-0.5 gap-0.5">
                <button
                  onClick={() => setView("review")}
                  className={`text-xs px-2.5 py-1 rounded transition-colors font-medium ${
                    view === "review"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Review
                </button>
                <button
                  onClick={() => { if (!redlineResult || redlineResult.matched_count === 0) handleRedline(); else setView("redline"); }}
                  className={`text-xs px-2.5 py-1 rounded transition-colors font-medium flex items-center gap-1 ${
                    view === "redline"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {redlining
                    ? <><Loader2 className="h-3 w-3 animate-spin" />Redlining…</>
                    : <><GitPullRequest className="h-3 w-3" />Redline</>
                  }
                </button>
              </div>

              <Button variant="outline" size="sm" asChild>
                <Link href={`/contracts/${id}/export`}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => summary ? setSummaryOpen(true) : handleSummarize()}
                disabled={summarizing}
                title="AI plain-English summary"
              >
                {summarizing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <AlignLeft className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAnalyze}
                disabled={analyzing}
                title="Re-run AI analysis"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? "animate-spin" : ""}`} />
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

      {/* ── Metadata band ─────────────────────────────────────────────── */}
      {(() => {
        const hasAny = contract.counterparty || contract.start_date || contract.end_date || contract.renewal_date || contract.owner_name || contract.contract_value;
        const lifecycle = getLifecycleBadge(contract);
        return (
          <div className="shrink-0 border-b bg-gray-50/60">
            <div className="px-3 md:px-5 py-1.5 flex flex-wrap items-center gap-x-3 md:gap-x-5 gap-y-1 text-xs text-gray-600">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${lifecycle.className}`}>
                {lifecycle.label}
              </span>
              {contract.counterparty && (
                <span className="flex items-center gap-1 text-gray-600">
                  <Building2 className="h-3 w-3 text-gray-400" />{contract.counterparty}
                </span>
              )}
              {(contract.start_date || contract.end_date) && (
                <span className="flex items-center gap-1 text-gray-600">
                  <Calendar className="h-3 w-3 text-gray-400" />
                  {formatDateShort(contract.start_date)} → {formatDateShort(contract.end_date)}
                </span>
              )}
              {contract.renewal_date && (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <Calendar className="h-3 w-3" />Renewal: {formatDateShort(contract.renewal_date)}
                </span>
              )}
              {contract.owner_name && (
                <span className="flex items-center gap-1 text-gray-600">
                  <User className="h-3 w-3 text-gray-400" />{contract.owner_name}
                </span>
              )}
              {contract.contract_value && (
                <span className="flex items-center gap-1 text-gray-600">
                  <DollarSign className="h-3 w-3 text-gray-400" />{formatCurrency(contract.contract_value)}
                </span>
              )}
              {contract.version_number > 1 && (
                <span className="text-gray-400 font-medium">v{contract.version_number}</span>
              )}
              {!hasAny && (
                <span className="text-gray-400 italic">No metadata — </span>
              )}
              <button
                onClick={() => setEditMetaOpen(true)}
                className="ml-auto flex items-center gap-1 text-primary hover:underline text-[11px] font-medium shrink-0"
              >
                <Pencil className="h-3 w-3" />Edit metadata
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Legal intake ─────────────────────────────────────────────────── */}
      <IntakePanel contractId={id} getToken={getToken} />

      {/* ── Approval workflow ────────────────────────────────────────────── */}
      <ApprovalPanel contractId={id} contractStatus={contract.contract_status} getToken={getToken} onChanged={load} />

      {/* ── Matter workspace: comments, tasks, activity, team ────────────── */}
      <MatterWorkspace contractId={id} getToken={getToken} />

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {!isAnalyzed ? (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <NotAnalyzedState
            status={contract.status}
            onAnalyze={handleAnalyze}
            analyzing={analyzing}
          />
        </div>
      ) : view === "redline" ? (
        // ── Redline view ────────────────────────────────────────────────────
        redlining ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="font-medium text-gray-700">Generating redlines…</p>
              <p className="text-sm text-gray-400">AI is drafting clause-level edits</p>
            </div>
          </div>
        ) : redlineResult ? (
          <RedlineViewer
            source={contract.extracted_text ?? ""}
            edits={redlineResult.edits}
            matched_count={redlineResult.matched_count}
            unmatched_count={redlineResult.unmatched_count}
            onDownloadDocx={handleDownloadRedline}
            downloadingDocx={downloadingRedline}
          />
        ) : null
      ) : (
        // ── Review view ─────────────────────────────────────────────────────
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden relative">
          {/* Document viewer */}
          <div className="flex-1 min-h-0 min-w-0">
            <DocumentViewer
              text={contract.extracted_text}
              analysis={analysis}
              activeId={activeId}
              appliedIds={appliedIds}
              panelOpen={panelOpen}
            />
          </div>

          {/* Review panel */}
          {panelOpen && (
            <ReviewPanel
              analysis={analysis}
              activeId={activeId}
              onActiveChange={newId => setActiveId(prev => prev === newId ? null : newId)}
              appliedIds={appliedIds}
              onApply={handleApply}
              onApplyAll={() => handleApplyAll(analysis)}
              onClose={() => setPanelOpen(false)}
              onDownload={handleDownload}
              redlinePlaced={redlineResult?.matched_count}
              redlineTotal={redlineResult?.edits.length}
            />
          )}

          {/* Toggle tab when panel is collapsed */}
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-[#1a2035] text-white rounded-l-lg px-1.5 py-4 shadow-lg hover:opacity-90 transition-opacity"
              title="Show AI Review Panel"
            >
              <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold tracking-widest uppercase select-none">
                AI Review
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Summary drawer ──────────────────────────────────────────────── */}
      {summaryOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md shadow-2xl flex flex-col bg-white border-l">
          <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b bg-[#1a2035] text-white">
            <AlignLeft className="h-4 w-4 text-white/60 shrink-0" />
            <span className="text-sm font-semibold flex-1">AI Summary</span>
            <button
              onClick={() => setSummaryOpen(false)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {summarizing ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Generating plain-English summary…</p>
              </div>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
            )}
          </div>
          <div className="shrink-0 px-4 py-3 border-t">
            <p className="text-[10px] text-gray-400 text-center">AI-generated · not legal advice</p>
          </div>
        </div>
      )}

      {/* Metadata edit dialog */}
      {editMetaOpen && (
        <MetadataEditDialog
          contract={contract}
          open={editMetaOpen}
          onClose={() => setEditMetaOpen(false)}
          onSave={handleSaveMetadata}
          saving={metaSaving}
        />
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
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        <div className="w-full lg:w-[340px] border-r p-4 space-y-3">
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

// ─── Metadata Edit Dialog ─────────────────────────────────────────────────────

const CONTRACT_TYPES = Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][];

const BUSINESS_STATUS_OPTIONS = [
  { value: "draft",        label: "Draft"        },
  { value: "submitted",    label: "Submitted"    },
  { value: "under_review", label: "Under Review" },
  { value: "waiting_for_business", label: "Waiting for Business" },
  { value: "sent_to_counterparty", label: "Sent to Counterparty" },
  { value: "in_negotiation",   label: "In Negotiation"   },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved",     label: "Approved"     },
  { value: "executed",     label: "Executed"     },
  { value: "expired",      label: "Expired"      },
  { value: "on_hold",      label: "On Hold"      },
  { value: "terminated",   label: "Terminated"   },
];

function MetadataEditDialog({
  contract, open, onClose, onSave, saving,
}: {
  contract: ContractDetail;
  open: boolean;
  onClose: () => void;
  onSave: (data: Parameters<typeof updateContractMetadata>[2]) => Promise<void>;
  saving: boolean;
}) {
  const [title, setTitle]           = useState(contract.title ?? "");
  const [counterparty, setCounterparty] = useState(contract.counterparty ?? "");
  const [contractType, setContractType] = useState<ContractType>(contract.contract_type);
  const [contractStatus, setContractStatus] = useState(contract.contract_status ?? "draft");
  const [startDate, setStartDate]   = useState(contract.start_date ?? "");
  const [endDate, setEndDate]       = useState(contract.end_date ?? "");
  const [renewalDate, setRenewalDate] = useState(contract.renewal_date ?? "");
  const [ownerName, setOwnerName]   = useState(contract.owner_name ?? "");
  const [contractValue, setContractValue] = useState(contract.contract_value != null ? String(contract.contract_value) : "");

  async function handleSave() {
    await onSave({
      title: title.trim() || null,
      counterparty: counterparty.trim() || null,
      contract_type: contractType,
      contract_status: contractStatus,
      start_date: startDate || null,
      end_date: endDate || null,
      renewal_date: renewalDate || null,
      owner_name: ownerName.trim() || null,
      contract_value: contractValue ? Number(contractValue) : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Edit Contract Metadata
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Contract Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. MSA 2026 — Acme Corp" className="h-9" />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <Building2 className="h-3 w-3 inline mr-1" />Counterparty / Vendor
            </Label>
            <Input value={counterparty} onChange={e => setCounterparty(e.target.value)} placeholder="e.g. Acme Corporation" className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Contract Type</Label>
            <Select value={contractType} onValueChange={v => setContractType(v as ContractType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Contract Status</Label>
            <Select value={contractStatus} onValueChange={setContractStatus}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUSINESS_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <Calendar className="h-3 w-3 inline mr-1" />Start Date
            </Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <Calendar className="h-3 w-3 inline mr-1" />End / Expiry Date
            </Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <Calendar className="h-3 w-3 inline mr-1" />Renewal Date
            </Label>
            <Input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <User className="h-3 w-3 inline mr-1" />Contract Owner
            </Label>
            <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="e.g. Jane Smith" className="h-9" />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <DollarSign className="h-3 w-3 inline mr-1" />Contract Value (USD)
            </Label>
            <Input type="number" value={contractValue} onChange={e => setContractValue(e.target.value)} placeholder="e.g. 500000" className="h-9" min="0" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
