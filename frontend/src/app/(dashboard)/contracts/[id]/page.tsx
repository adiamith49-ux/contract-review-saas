"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  ArrowLeft, Download, Loader2, AlertTriangle, FileText, RefreshCw, GitPullRequest,
  AlignLeft, X, Pencil, Building2, Calendar, User, DollarSign, Globe, Upload, GitCompare,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ReviewPanel } from "@/components/ReviewPanel";
import { DocumentViewer } from "@/components/DocumentViewer";
import { RedlineViewer } from "@/components/RedlineViewer";
import { ContractDetailTabs } from "@/components/ContractDetailTabs";
import { AIChatFloat } from "@/components/AIChatFloat";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
  getContract, analyzeContract, waitForAnalysis, downloadExport,
  runRedline, downloadRedlineDocx, summarizeContract, updateContractMetadata,
  type ContractDetail, type RedlineResult,
} from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { formatDate, formatDateShort, formatCurrency, formatFileSize, CONTRACT_TYPE_LABELS, getLifecycleBadge, CONTRACT_BUSINESS_STATUS_LABELS } from "@/lib/utils";
import { reviewerLabel } from "@/lib/reviewer";
import type { ContractType } from "@/lib/types";

// ─── Applied-item → redline resolution ────────────────────────────────────────
// Only clause findings carry verbatim contract text plus replacement language,
// so only they can anchor a tracked change. Risk-summary and ambiguity items are
// commentary on the same clauses — applying one selects the clause findings it
// covers, instead of silently redlining nothing.

function sectionRefs(...parts: (string | undefined | null)[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    for (const m of (p ?? "").matchAll(/\b\d+(?:\.\d+)*\b/g)) out.push(m[0]);
  }
  return out;
}

// "24" covers "24.1"; "24.1" belongs to "24".
function refsOverlap(a: string[], b: string[]): boolean {
  return a.some(x => b.some(y => x === y || x.startsWith(`${y}.`) || y.startsWith(`${x}.`)));
}

function topicWords(s?: string | null): Set<string> {
  return new Set(
    (s ?? "").toLowerCase().split(/[^a-z]+/)
      .filter(w => w.length > 4 && !["section","sections","clause","clauses","agreement","contract"].includes(w)),
  );
}

function sharesTopic(a?: string | null, b?: string | null): boolean {
  const wa = topicWords(a);
  if (wa.size === 0) return false;
  const wb = topicWords(b);
  for (const w of wa) if (wb.has(w)) return true;
  return false;
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const { user } = useUser();

  // Word attributes every comment and tracked change to this name.
  const reviewer = reviewerLabel(user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" "));

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeElapsed, setAnalyzeElapsed] = useState(0);
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

  // The list fields are JSONB, so a partially-written analysis row can hand back
  // null where the type promises an array. Coerce rather than throw — this runs
  // on a click, and an exception here takes the whole page down.
  function handleApplyAll(analysis: { risk_summary?: unknown; clause_analysis?: unknown; negotiation_points?: unknown; ambiguity_flags?: unknown } | null) {
    if (!analysis) return;
    const idsFor = (value: unknown, prefix: string) =>
      Array.isArray(value) ? value.map((_, i) => `${prefix}-${i}`) : [];

    setAppliedIds(new Set([
      ...idsFor(analysis.risk_summary, "r"),
      ...idsFor(analysis.clause_analysis, "c"),
      ...idsFor(analysis.negotiation_points, "n"),
      ...idsFor(analysis.ambiguity_flags, "a"),
    ]));
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

  // Resume watching a run that was started elsewhere — e.g. the upload wizard
  // kicks off analysis and routes here, or the user reloaded mid-run. Without
  // this the page would sit on "Processing…" until manually refreshed.
  useEffect(() => {
    if (contract?.status !== "processing" || analyzing) return;
    let cancelled = false;
    setAnalyzing(true);
    setAnalyzeElapsed(0);
    waitForAnalysis(() => getToken(), id, {
      onTick: s => { if (!cancelled) setAnalyzeElapsed(s); },
    })
      .then(() => { if (!cancelled) { toast.success("Analysis complete!"); return load(); } })
      .catch(err => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Analysis failed");
        return load();
      })
      .finally(() => { if (!cancelled) { setAnalyzing(false); setAnalyzeElapsed(0); } });
    return () => { cancelled = true; };
  }, [contract?.status, id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setAnalyzeElapsed(0);
    try {
      const token = await getToken();
      // Returns as soon as the job is queued — the AI runs server-side.
      await analyzeContract(token, id);
      await waitForAnalysis(() => getToken(), id, { onTick: setAnalyzeElapsed });
      toast.success("Analysis complete!");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
      await load(); // refresh so a failed contract shows its real status
    } finally {
      setAnalyzing(false);
      setAnalyzeElapsed(0);
    }
  }

  async function handleDownload() {
    if (!contract) return;
    try {
      const token = await getToken();
      await downloadExport(token, id, "docx", contract.filename, appliedIds.size > 0 ? appliedIds : undefined, contract.version_number, reviewer);
      toast.success("Download started");
    } catch {
      toast.error("Download failed");
    }
  }

  async function handleRedline() {
    if (!contract || !analysis) return;

    // Redline the clause findings the user applied in the Review panel. Only
    // findings with real contract text + a suggested revision can anchor a
    // tracked change; applying a risk-summary, ambiguity or negotiation item
    // selects the clause findings covering the same sections/topic.
    const eligible = (analysis.clause_analysis ?? [])
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.contractText && c.suggestedLanguage);

    const selected = new Set<number>();
    for (const { i } of eligible) if (appliedIds.has(`c-${i}`)) selected.add(i);

    const selectBy = (refs: string[], topic?: string | null) => {
      for (const { c, i } of eligible) {
        const clauseRefs = sectionRefs(c.clause);
        if ((refs.length > 0 && refsOverlap(refs, clauseRefs)) || sharesTopic(topic, c.clause)) {
          selected.add(i);
        }
      }
    };

    (analysis.risk_summary ?? []).forEach((r, i) => {
      if (appliedIds.has(`r-${i}`)) selectBy(sectionRefs(r.clauseRef), r.area);
    });
    (analysis.ambiguity_flags ?? []).forEach((a, i) => {
      if (appliedIds.has(`a-${i}`)) selectBy(sectionRefs(a.location), a.term);
    });
    // Negotiation points carry no clause reference at all, so they match on topic only.
    (analysis.negotiation_points ?? []).forEach((n, i) => {
      if (appliedIds.has(`n-${i}`)) selectBy(sectionRefs(n.point), n.point);
    });

    const editsToRedline = eligible
      .filter(({ i }) => selected.has(i))
      .map(({ c }) => ({
        clause_ref: c.clause,
        original_text: c.contractText!,
        revised_text: c.suggestedLanguage!,
        edit_type: "replace" as const,
        risk: (c.risk === "critical" || c.risk === "high" ? "High" : c.risk === "medium" ? "Medium" : "Low") as "High" | "Medium" | "Low",
        playbook_rule: c.playbookRule ?? "",
        rationale: c.finding,
      }));

    if (editsToRedline.length === 0) {
      toast.warning(
        eligible.length > 0
          ? "Nothing to redline yet — the items you applied have no replacement language. Open the Clauses tab and Accept a suggested revision."
          : "This analysis has no clause findings with replacement language, so there is nothing to redline.",
      );
      return;
    }

    setRedlining(true);
    setView("redline");
    try {
      const token = await getToken();
      const result = await runRedline(token, id, editsToRedline);
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
      await downloadRedlineDocx(token, id, contract.filename, redlineResult?.edits ?? [], reviewer);
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
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ── Contract header bar ─────────────────────────────────────────── */}
      <div className="sticky top-0 shrink-0 px-3 md:px-5 py-2.5 border-b bg-white flex items-center justify-between gap-2 md:gap-4 z-20">
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

      {/* ── Legal intake / Approval / Versions / Matter workspace ─────────── */}
      <ContractDetailTabs contractId={id} contractStatus={contract.contract_status} getToken={getToken} onChanged={load} />

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {!isAnalyzed ? (
        <div className="flex-1 min-h-[65vh] flex items-center justify-center bg-gray-50">
          <NotAnalyzedState
            status={contract.status}
            onAnalyze={handleAnalyze}
            analyzing={analyzing}
            elapsed={analyzeElapsed}
            errorMessage={contract.error_message}
            isVersion={!!contract.parent_contract_id}
            versionNumber={contract.version_number}
            onCompare={() => router.push(`/contracts/${id}?panel=versions&compare=auto`)}
          />
        </div>
      ) : view === "redline" ? (
        // ── Redline view ────────────────────────────────────────────────────
        redlining ? (
          <div className="flex-1 min-h-[65vh] flex items-center justify-center bg-gray-50">
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
        <div className="flex flex-col lg:flex-row flex-1 min-h-[65vh] overflow-hidden relative">
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
              getToken={getToken}
            />
          )}

          {/* Toggle tab when panel is collapsed */}
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-[#0F2A2A] text-white rounded-l-lg px-1.5 py-4 shadow-lg hover:opacity-90 transition-opacity"
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
          <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b bg-[#0F2A2A] text-white">
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
              <MarkdownContent content={summary ?? ""} className="text-sm text-gray-700" />
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

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function NotAnalyzedState({
  status, onAnalyze, analyzing, elapsed = 0, errorMessage = null,
  versionNumber = 1, isVersion = false, onCompare,
}: {
  status: string;
  onAnalyze: () => void;
  analyzing: boolean;
  elapsed?: number;
  errorMessage?: string | null;
  versionNumber?: number;
  isVersion?: boolean;
  onCompare?: () => void;
}) {
  if (status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="font-medium text-gray-700">AI is analyzing your contract…</p>
        <p className="text-sm text-gray-400 mt-1">
          A thorough review can take a few minutes for a long contract.
          {elapsed > 0 && ` (${formatElapsed(elapsed)} elapsed)`}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          You can leave this page — the review keeps running and will be here when you come back.
        </p>
        {/* Escape hatch: if a prior run got interrupted the status can stay stuck
            here. Re-running is safe — the server rejects a genuinely in-flight
            analysis and only re-runs a stale one. */}
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className="mt-6 text-xs text-gray-400 hover:text-primary underline underline-offset-2 disabled:opacity-50"
        >
          {analyzing ? "Re-running…" : "Taking too long? Re-run analysis"}
        </button>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle className="h-10 w-10 text-red-400 mb-4" />
        <p className="font-medium text-gray-700">Analysis failed</p>
        <p className="text-sm text-gray-400 mt-1 max-w-md">
          {errorMessage ?? "Something went wrong. Try running the analysis again."}
        </p>
        <Button onClick={onAnalyze} disabled={analyzing} className="mt-6">
          {analyzing
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Retrying…</>
            : <><RefreshCw className="h-4 w-4 mr-2" />Retry Analysis</>}
        </Button>
      </div>
    );
  }
  // A new version is not re-reviewed on upload — what you want from a
  // counterparty's draft is what changed, not a fresh risk report on the 95%
  // they left alone. Lead with the comparison and keep the full review one
  // click away for when the new draft warrants its own review.
  if (isVersion) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <GitCompare className="h-10 w-10 text-gray-300 mb-4" />
        <p className="font-medium text-gray-700">Version {versionNumber} uploaded</p>
        <p className="text-sm text-gray-400 mt-1 max-w-md">
          Compare it against the previous draft to see what the counterparty changed, with an
          AI summary of the changes. A full risk review of this version is optional.
        </p>
        <div className="flex items-center gap-2 mt-6">
          <Button onClick={onCompare}>
            <GitCompare className="h-4 w-4 mr-2" />
            View Comparison
          </Button>
          <Button variant="outline" onClick={onAnalyze} disabled={analyzing}>
            {analyzing
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing…</>
              : "Run Full AI Analysis"}
          </Button>
        </div>
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
