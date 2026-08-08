"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown, ChevronUp, Loader2, GitCompare, Upload, Plus, Minus, Pencil,
  Sparkles, Download, ArrowRight, Columns2, AlignJustify,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import {
  listVersions, compareVersions, isClauseComparison, uploadContractVersion,
  type VersionItem, type Comparison, type DiffPart,
  type ClauseComparison, type ClauseStatus, type LegacyKeyChange,
} from "@/lib/api";
import { CONTRACT_BUSINESS_STATUS_LABELS } from "@/lib/utils";

interface Props {
  contractId: string;
  getToken: () => Promise<string | null>;
  /** Render body content only, no collapsible header/border — used when hosted inside a tab strip. */
  embedded?: boolean;
  /** Fill the viewport and give the whole area to the two text columns. */
  fullScreen?: boolean;
}

const STATUS_LABEL: Record<ClauseStatus, string> = {
  deviation: "Deviation",
  identical: "Identical",
  missing_in_base: "Added in new",
  missing_in_compared: "Missing in new",
};

const STATUS_CLS: Record<ClauseStatus, string> = {
  deviation: "bg-amber-100 text-amber-800",
  identical: "bg-gray-100 text-gray-600",
  missing_in_base: "bg-emerald-100 text-emerald-800",
  missing_in_compared: "bg-red-100 text-red-700",
};

const IMPACT_CLS: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-gray-100 text-gray-600",
};

export function VersionComparePanel({ contractId, getToken, embedded, fullScreen }: Props) {
  const [open, setOpen] = useState(false);
  const isOpen = embedded || open;
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseId, setBaseId] = useState<string>("");
  const [againstId, setAgainstId] = useState<string>("");
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<Comparison | null>(null);
  const [diffView, setDiffView] = useState<"inline" | "sidebyside">("sidebyside");
  // The comparison is a multi-second AI call. A bare spinner reads as frozen,
  // so the button counts up while it runs.
  const [elapsed, setElapsed] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  // "full" shows both contracts end to end with the changes highlighted in
  // place; "changes" shows only the changed blocks. Reading a redline in
  // context is the normal job, so full is the default.
  const [scope, setScope] = useState<"full" | "changes">("full");
  // Empty set = show everything. "missing_in_base" doubles as the Missing chip.
  const [statusFilter, setStatusFilter] = useState<Set<ClauseStatus>>(new Set());
  const [showResults, setShowResults] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!comparing) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [comparing]);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const { versions } = await listVersions(token, contractId);
      setVersions(versions);
      // default: compare the two most recent versions (prior vs latest)
      if (versions.length >= 2) {
        setBaseId(versions[versions.length - 2].id);
        setAgainstId(versions[versions.length - 1].id);
      }
    } catch { /* panel stays minimal */ } finally {
      setLoading(false);
    }
  }, [contractId, getToken]);

  useEffect(() => { if (isOpen && loading) load(); }, [isOpen, loading, load]);

  // The version-upload flow routes here with ?compare=auto so the new draft
  // opens on its diff rather than on an empty panel waiting for a click. Guarded
  // by a ref because the comparison is an AI call — it must fire exactly once
  // per arrival, not on every re-render that touches baseId/againstId.
  const autoCompare = useSearchParams().get("compare") === "auto";
  const autoRan = useRef(false);

  useEffect(() => {
    if (!autoCompare || autoRan.current || loading || comparing) return;
    if (versions.length < 2 || !baseId || !againstId || baseId === againstId) return;
    autoRan.current = true;
    void handleCompare();
  }, [autoCompare, loading, comparing, versions.length, baseId, againstId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCompare() {
    if (!baseId || !againstId) { toast.error("Pick two versions to compare"); return; }
    if (baseId === againstId) { toast.error("Choose two different versions"); return; }
    setComparing(true);
    setResult(null);
    try {
      const token = await getToken();
      const { comparison } = await compareVersions(token, baseId, againstId);
      setResult(comparison);
      toast.success("Comparison ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setComparing(false);
    }
  }

  function label(v: VersionItem) {
    return `v${v.version_number} · ${CONTRACT_BUSINESS_STATUS_LABELS[v.contract_status ?? "draft"] ?? v.contract_status} · ${new Date(v.created_at).toLocaleDateString()}`;
  }

  function downloadReport() {
    if (!result) return;
    const base = versions.find(v => v.id === result.base_contract_id);
    const comp = versions.find(v => v.id === result.compared_contract_id);
    const lines: string[] = [];
    lines.push(`# Contract Comparison Report`);
    lines.push(``);
    lines.push(`Base (prior): ${base ? `v${base.version_number} — ${base.title || base.filename}` : result.base_contract_id}`);
    lines.push(`Compared (new): ${comp ? `v${comp.version_number} — ${comp.title || comp.filename}` : result.compared_contract_id}`);
    lines.push(`Generated: ${new Date(result.created_at).toLocaleString()}`);
    lines.push(``);
    lines.push(`Changes: ${result.added_count} added · ${result.deleted_count} deleted · ${result.modified_count} modified`);
    lines.push(``);
    lines.push(`## AI Summary of Changes`);
    lines.push(result.summary ?? "—");
    lines.push(``);
    if (clauses.length) {
      lines.push(`## Clause Comparison (${clauseCounts.deviation} deviations · ${clauseCounts.identical} identical · ${clauseCounts.missing} missing)`);
      for (const c of clauses) {
        lines.push(`\n### [${STATUS_LABEL[c.status]}] ${c.title}${c.baseSection || c.comparedSection ? ` (v1 §${c.baseSection ?? "-"} → v2 §${c.comparedSection ?? "-"})` : ""}`);
        if (c.summary) lines.push(c.summary);
        if (c.baseText) lines.push(`\nPRIOR:\n${c.baseText}`);
        if (c.comparedText) lines.push(`\nNEW:\n${c.comparedText}`);
      }
      lines.push(``);
    }
    if (legacyChanges.length) {
      lines.push(`## Key Changes`);
      for (const k of legacyChanges) {
        lines.push(`- [${k.type.toUpperCase()} · ${k.impact} impact] ${k.clause}: ${k.detail}`);
      }
      lines.push(``);
    }
    lines.push(`## Full Diff`);
    for (const b of result.diff) {
      if (b.type === "added") lines.push(`\n+ ADDED:\n${b.compared}`);
      else if (b.type === "deleted") lines.push(`\n- DELETED:\n${b.base}`);
      else if (b.type === "modified") lines.push(`\n~ MODIFIED:\n  was: ${b.base}\n  now: ${b.compared}`);
    }
    lines.push(``);
    lines.push(`AI-generated insights are not legal advice.`);
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparison-${base ? `v${base.version_number}` : "base"}-vs-${comp ? `v${comp.version_number}` : "new"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Comparison report downloaded");
  }

  const changedBlocks = result?.diff.filter(b => b.type !== "unchanged") ?? [];
  // The stored diff already carries every unchanged paragraph with both sides,
  // so the complete uploaded documents are reconstructible here — no extra
  // fetch — and the highlighting lands in its real position in the contract.
  const allBlocks = result?.diff ?? [];
  const shownBlocks = scope === "full" ? allBlocks : changedBlocks;

  // Newer comparisons store clause-level results in key_changes; older rows
  // hold the previous free-form notes. Both are rendered, neither is assumed.
  const clauses: ClauseComparison[] = (result?.key_changes ?? []).filter(isClauseComparison);
  const legacyChanges = (result?.key_changes ?? []).filter(
    (k): k is LegacyKeyChange => !isClauseComparison(k));
  const clauseCounts = {
    deviation: clauses.filter(c => c.status === "deviation").length,
    identical: clauses.filter(c => c.status === "identical").length,
    missing:   clauses.filter(c => c.status === "missing_in_base" || c.status === "missing_in_compared").length,
  };
  const visibleClauses = clauses.filter(c =>
    statusFilter.size === 0 ? true
      : c.status === "missing_in_base" || c.status === "missing_in_compared"
        ? statusFilter.has("missing_in_base")
        : statusFilter.has(c.status));

  const baseVersion = result ? versions.find(v => v.id === result.base_contract_id) : undefined;
  const comparedVersion = result ? versions.find(v => v.id === result.compared_contract_id) : undefined;
  const colLabel = (v: VersionItem | undefined, fallback: string) =>
    v ? `v${v.version_number} · ${v.title || v.filename}` : fallback;

  // Word-level highlight inside a reworded clause. Falls back to plain text for
  // comparisons stored before the word diff existed.
  const renderParts = (parts: DiffPart[] | undefined, plain: string | undefined, side: "base" | "compared") => {
    if (!parts?.length) return plain;
    return parts.map((p, i) => {
      if (p.c === "same") return <span key={i}>{p.t} </span>;
      const isDel = p.c === "del";
      if ((isDel && side !== "base") || (!isDel && side !== "compared")) return null;
      return (
        <mark key={i} className={cn(
          "rounded px-0.5",
          isDel ? "bg-red-200 text-red-900 line-through decoration-red-500" : "bg-emerald-200 text-emerald-900",
        )}>{p.t}</mark>
      );
    });
  };

  // ── One side of the contract, rendered as the document ────────────────────
  // Not one bordered row per sentence: sentences re-flow into the paragraphs
  // they came from, so the column reads like the uploaded contract with the
  // edits marked in place. `side` picks which version this column shows —
  // deletions only exist on the left, insertions only on the right.
  function DocumentColumn({ blocks, side }: { blocks: typeof allBlocks; side: "base" | "compared" }) {
    const paras: { key: number; runs: React.ReactNode[] }[] = [];
    blocks.forEach((b, i) => {
      const runs: React.ReactNode[] = [];
      if (b.type === "unchanged") {
        runs.push(<span key={i}>{(side === "base" ? b.base : b.compared)} </span>);
      } else if (b.type === "modified") {
        runs.push(
          <span key={i}>
            {renderParts(side === "base" ? b.baseParts : b.comparedParts, side === "base" ? b.base : b.compared, side)}{" "}
          </span>,
        );
      } else if (b.type === "deleted" && side === "base") {
        runs.push(<del key={i} className="bg-red-100 text-red-800 decoration-red-500 rounded px-0.5">{b.base} </del>);
      } else if (b.type === "added" && side === "compared") {
        runs.push(<ins key={i} className="bg-emerald-100 text-emerald-900 no-underline rounded px-0.5">{b.compared} </ins>);
      } else {
        return; // this edit belongs to the other column
      }

      if (b.para || paras.length === 0) paras.push({ key: i, runs });
      else paras[paras.length - 1].runs.push(...runs);
    });

    if (paras.length === 0) {
      return <p className="text-[13px] text-gray-400 italic">— nothing in this version —</p>;
    }
    return (
      <>
        {paras.map(p => (
          <p key={p.key} className="text-[13px] leading-relaxed mb-3">{p.runs}</p>
        ))}
      </>
    );
  }

  // A new version is the same matter, so it uploads straight from here — no
  // wizard, no re-entering the client and counterparty we already hold. The
  // server inherits everything from the parent; only the file is new.
  async function handleVersionFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";                 // allow re-picking the same file
    if (!file) return;
    const parentId = versions[0]?.id ?? contractId;
    setUploading(true);
    try {
      const token = await getToken();
      const { contract } = await uploadContractVersion(token, file, parentId);
      toast.success(`Uploaded as v${versions.length + 1}`);
      const { versions: fresh } = await listVersions(token, contractId);
      setVersions(fresh);
      if (fresh.length >= 2) {
        setBaseId(fresh[fresh.length - 2].id);
        setAgainstId(contract.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const uploadVersionButton = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleVersionFile}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading
          ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
          : <><Upload className="h-3.5 w-3.5 mr-1.5" />Upload New Version</>}
      </Button>
    </>
  );

  function toggleFilter(st: ClauseStatus) {
    setStatusFilter(prev => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st); else next.add(st);
      return next;
    });
  }

  const filterChip = (st: ClauseStatus, label: string, count: number) => (
    <button
      type="button"
      onClick={() => toggleFilter(st)}
      className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium border transition-colors",
        statusFilter.has(st) ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 hover:bg-gray-50")}
    >
      {label} {count}
    </button>
  );

  const ResultsPanel = () => (
    <div className="flex flex-col h-full min-h-0 border-l bg-gray-50/60">
      <div className="shrink-0 px-3 py-2 border-b bg-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-gray-700">Result ({visibleClauses.length})</span>
          {statusFilter.size > 0 && (
            <button type="button" onClick={() => setStatusFilter(new Set())}
              className="ml-auto text-[10px] text-gray-500 hover:text-gray-900 underline">Reset</button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterChip("deviation", "Deviations", clauseCounts.deviation)}
          {filterChip("identical", "Identical", clauseCounts.identical)}
          {filterChip("missing_in_base", "Missing", clauseCounts.missing)}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto divide-y">
        {clauses.length === 0 ? (
          <p className="px-3 py-4 text-[11px] text-gray-400">
            No clause comparison on this result. Run Compare again to generate one.
          </p>
        ) : visibleClauses.length === 0 ? (
          <p className="px-3 py-4 text-[11px] text-gray-400">Nothing matches this filter.</p>
        ) : visibleClauses.map((c, i) => (
          <div key={i} className="px-3 py-2.5 bg-white">
            <div className="flex items-start gap-2 mb-1">
              <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", STATUS_CLS[c.status])}>
                {STATUS_LABEL[c.status]}
              </span>
              {c.impact && (
                <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase", IMPACT_CLS[c.impact])}>{c.impact}</span>
              )}
            </div>
            <p className="text-xs font-semibold text-gray-900">{c.title}</p>
            {(c.baseSection || c.comparedSection) && (
              <p className="text-[10px] text-gray-400 mb-1">v1 §{c.baseSection || "—"} → v2 §{c.comparedSection || "—"}</p>
            )}
            {c.summary && <p className="text-[11px] text-gray-700 leading-relaxed mt-1">{c.summary}</p>}
            {c.status !== "identical" && (
              <div className="mt-1.5 space-y-1">
                {c.baseText && (
                  <p className="text-[10px] leading-relaxed bg-red-50 text-red-900 border-l-2 border-red-300 px-1.5 py-1 rounded-sm line-clamp-4">{c.baseText}</p>
                )}
                {c.comparedText && (
                  <p className="text-[10px] leading-relaxed bg-emerald-50 text-emerald-900 border-l-2 border-emerald-300 px-1.5 py-1 rounded-sm line-clamp-4">{c.comparedText}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const compareButton = (
    <Button size="sm" className="h-7 text-xs" onClick={handleCompare} disabled={comparing}>
      {comparing
        ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Comparing… {elapsed}s</>
        : <><GitCompare className="h-3 w-3 mr-1" />Compare</>}
    </Button>
  );

  const versionSelects = (
    <>
      <select value={baseId} onChange={e => setBaseId(e.target.value)} className="text-xs rounded border px-2 py-1 bg-white max-w-[240px]">
        {versions.map(v => <option key={v.id} value={v.id}>{label(v)}</option>)}
      </select>
      <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
      <select value={againstId} onChange={e => setAgainstId(e.target.value)} className="text-xs rounded border px-2 py-1 bg-white max-w-[240px]">
        {versions.map(v => <option key={v.id} value={v.id}>{label(v)}</option>)}
      </select>
    </>
  );

  // ── Full-screen comparison ───────────────────────────────────────────────
  // Everything except the two columns is collapsed into one control strip, so
  // the contract text gets the whole viewport.
  if (fullScreen) {
    if (loading) {
      return <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>;
    }

    if (versions.length < 2) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
          <GitCompare className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500 max-w-md">
            Only one version so far. Upload a second version — a counterparty redline, say — to compare the two drafts side by side with an AI change summary.
          </p>
          {uploadVersionButton}
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full min-h-0 bg-white">
        {/* Control strip */}
        <div className="shrink-0 border-b px-4 py-2 flex items-center gap-2 flex-wrap">
          {versionSelects}
          {compareButton}

          {result && (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-medium"><Plus className="h-3 w-3" />{result.added_count}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[11px] font-medium"><Minus className="h-3 w-3" />{result.deleted_count}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-medium"><Pencil className="h-3 w-3" />{result.modified_count}</span>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowVersions(v => !v)}
                  className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                    showVersions ? "bg-gray-900 text-white border-gray-900" : "text-gray-600 hover:bg-gray-50")}
                >
                  <GitCompare className="h-3 w-3" />Versions
                </button>
                <button
                  type="button"
                  onClick={() => setShowResults(r => !r)}
                  className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                    showResults ? "bg-gray-900 text-white border-gray-900" : "text-gray-600 hover:bg-gray-50")}
                >
                  Result
                  <span className={cn("rounded-full px-1 text-[9px]", showResults ? "bg-white/20" : "bg-gray-100")}>{clauses.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSummary(s => !s)}
                  className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                    showSummary ? "bg-blue-600 text-white border-blue-600" : "text-blue-700 hover:bg-blue-50")}
                >
                  <Sparkles className="h-3 w-3" />AI summary
                  {result.key_changes.length > 0 && (
                    <span className={cn("rounded-full px-1 text-[9px]", showSummary ? "bg-white/20" : "bg-blue-100")}>{result.key_changes.length}</span>
                  )}
                </button>
                <span className="inline-flex rounded-md border overflow-hidden">
                  <button type="button" onClick={() => setScope("full")}
                    className={cn("px-2 py-1 text-[10px] font-medium", scope === "full" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50")}
                    title="Both contracts end to end, changes highlighted in place">
                    Full documents
                  </button>
                  <button type="button" onClick={() => setScope("changes")}
                    className={cn("px-2 py-1 text-[10px] font-medium border-l", scope === "changes" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50")}
                    title="Only the paragraphs that differ">
                    Changes only
                  </button>
                </span>
                <span className="inline-flex rounded-md border overflow-hidden">
                  <button type="button" onClick={() => setDiffView("inline")}
                    className={cn("inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium", diffView === "inline" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50")}>
                    <AlignJustify className="h-3 w-3" />Inline
                  </button>
                  <button type="button" onClick={() => setDiffView("sidebyside")}
                    className={cn("inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium border-l", diffView === "sidebyside" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50")}>
                    <Columns2 className="h-3 w-3" />Side by side
                  </button>
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={downloadReport}>
                  <Download className="h-3 w-3 mr-1" />Report
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Collapsible: version list */}
        {result && showVersions && (
          <div className="shrink-0 border-b bg-gray-50/60 px-4 py-2 max-h-40 overflow-y-auto divide-y">
            {versions.map(v => (
              <div key={v.id} className="flex items-center gap-2 py-1.5 text-xs">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">{v.version_number}</span>
                <Link href={`/contracts/${v.id}`} className="font-medium text-gray-800 hover:text-primary truncate">{v.title || v.filename}</Link>
                <span className="text-gray-400 shrink-0">{CONTRACT_BUSINESS_STATUS_LABELS[v.contract_status ?? "draft"] ?? v.contract_status}</span>
                <span className="text-gray-300 ml-auto shrink-0">{formatDateTime(v.created_at)}</span>
                {v.id === contractId && <span className="text-[9px] font-semibold text-primary shrink-0">CURRENT</span>}
              </div>
            ))}
            <div className="pt-2">{uploadVersionButton}</div>
          </div>
        )}

        {/* Collapsible: AI summary + key changes */}
        {result && showSummary && (
          <div className="shrink-0 border-b border-blue-100 bg-blue-50/50 px-4 py-2.5 max-h-[38vh] overflow-y-auto">
            {result.summary && <p className="text-xs text-blue-900 leading-relaxed">{result.summary}</p>}
            {legacyChanges.length > 0 && (
              <ul className="mt-2 space-y-1">
                {legacyChanges.map((k, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase", IMPACT_CLS[k.impact])}>{k.type}</span>
                    <span className="text-gray-700"><span className="font-medium">{k.clause}:</span> {k.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* The two columns */}
        {!result ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            {comparing ? `Comparing the two drafts… ${elapsed}s` : "Pick two versions and press Compare."}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0 flex flex-col">
        {shownBlocks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">No textual changes between these two versions.</div>
        ) : diffView === "inline" ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            {shownBlocks.map((b, i) => (
              <div key={i} className="text-[13px] leading-relaxed">
                {b.type === "unchanged" && <p className="px-3 py-1 text-gray-700">{b.compared ?? b.base}</p>}
                {b.type === "added" && <p className="rounded bg-emerald-50 border-l-2 border-emerald-400 px-3 py-2 text-emerald-900"><span className="font-semibold">+ </span>{b.compared}</p>}
                {b.type === "deleted" && <p className="rounded bg-red-50 border-l-2 border-red-400 px-3 py-2 text-red-900 line-through"><span className="font-semibold no-underline">− </span>{b.base}</p>}
                {b.type === "modified" && (
                  <div className="rounded bg-amber-50 border-l-2 border-amber-400 px-3 py-2">
                    <p className="text-gray-700"><span className="font-semibold text-red-700">was: </span>{renderParts(b.baseParts, b.base, "base")}</p>
                    <p className="text-gray-700 mt-1"><span className="font-semibold text-emerald-800">now: </span>{renderParts(b.comparedParts, b.compared, "compared")}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 grid grid-cols-2 gap-px bg-gray-200 text-[11px] font-semibold">
              <div className="bg-gray-100 px-4 py-2 text-gray-600 flex items-center gap-1.5">
                <Minus className="h-3 w-3 text-red-500 shrink-0" />
                <span className="truncate">Older — {colLabel(baseVersion, "prior draft")}</span>
              </div>
              <div className="bg-gray-100 px-4 py-2 text-gray-600 flex items-center gap-1.5">
                <Plus className="h-3 w-3 text-emerald-500 shrink-0" />
                <span className="truncate">Newer — {colLabel(comparedVersion, "new draft")}</span>
              </div>
            </div>
            {scope === "full" ? (
              /* The contract as uploaded, both versions, edits marked in place.
                 Each column scrolls on its own so you can track one side. */
              <div className="flex-1 min-h-0 grid grid-cols-2 gap-px bg-gray-200">
                <div className="bg-white overflow-y-auto px-5 py-4">
                  <DocumentColumn blocks={allBlocks} side="base" />
                </div>
                <div className="bg-white overflow-y-auto px-5 py-4">
                  <DocumentColumn blocks={allBlocks} side="compared" />
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto divide-y">
                {shownBlocks.map((b, i) => (
                  <div key={i} className="grid grid-cols-2 gap-px bg-gray-100">
                    <div className={cn("px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap",
                      b.type === "deleted" && "bg-red-50 text-red-900 line-through decoration-red-400",
                      b.type === "modified" && "bg-red-50/70 text-red-800",
                      b.type === "added" && "bg-gray-50 text-gray-300 italic",
                    )}>
                      {b.type === "added"
                        ? "— not in this version —"
                        : b.type === "modified"
                          ? renderParts(b.baseParts, b.base, "base")
                          : b.base}
                    </div>
                    <div className={cn("px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap",
                      b.type === "added" && "bg-emerald-50 text-emerald-900",
                      b.type === "modified" && "bg-emerald-50/70 text-emerald-800",
                      b.type === "deleted" && "bg-gray-50 text-gray-300 italic",
                    )}>
                      {b.type === "deleted"
                        ? "— removed in this version —"
                        : b.type === "modified"
                          ? renderParts(b.comparedParts, b.compared, "compared")
                          : b.compared}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
            </div>
            {showResults && (
              <div className="w-[340px] shrink-0"><ResultsPanel /></div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "shrink-0 border-b bg-white"}>
      {!embedded && (
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full px-3 md:px-5 py-2 flex items-center gap-2.5 text-left hover:bg-gray-50 transition-colors"
        >
          <GitCompare className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-xs font-semibold text-gray-700">Versions & Comparison</span>
          {!loading && <span className="text-[10px] text-gray-400">{versions.length} version{versions.length === 1 ? "" : "s"}</span>}
          <span className="ml-auto text-gray-400">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
        </button>
      )}

      {isOpen && (
        <div className="px-3 md:px-5 pb-4 space-y-3">
          {loading ? (
            <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
          ) : (
            <>
              {/* Version list */}
              <div className="rounded-lg border divide-y">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                      {v.version_number}
                    </span>
                    <Link href={`/contracts/${v.id}`} className="font-medium text-gray-800 hover:text-primary truncate">
                      {v.title || v.filename}
                    </Link>
                    <span className="text-gray-400 shrink-0">{CONTRACT_BUSINESS_STATUS_LABELS[v.contract_status ?? "draft"] ?? v.contract_status}</span>
                    {v.owner_name && <span className="text-gray-400 shrink-0">· {v.owner_name}</span>}
                    <span className="text-gray-300 ml-auto shrink-0">{formatDateTime(v.created_at)}</span>
                    {v.id === contractId && <span className="text-[9px] font-semibold text-primary shrink-0">CURRENT</span>}
                  </div>
                ))}
              </div>

              {/* Upload a new version */}
              {uploadVersionButton}

              {versions.length < 2 ? (
                <p className="text-[11px] text-gray-400">
                  Upload a second version to compare drafts and see added / deleted / modified clauses with an AI change summary.
                </p>
              ) : (
                <>
                  {/* Compare controls */}
                  <div className="flex items-center gap-2 flex-wrap rounded-lg border bg-gray-50/60 px-3 py-2.5">
                    <span className="text-[11px] font-medium text-gray-500">Compare</span>
                    <select value={baseId} onChange={e => setBaseId(e.target.value)} className="text-xs rounded border px-2 py-1 bg-white max-w-[42%]">
                      {versions.map(v => <option key={v.id} value={v.id}>{label(v)}</option>)}
                    </select>
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                    <select value={againstId} onChange={e => setAgainstId(e.target.value)} className="text-xs rounded border px-2 py-1 bg-white max-w-[42%]">
                      {versions.map(v => <option key={v.id} value={v.id}>{label(v)}</option>)}
                    </select>
                    <span className="ml-auto">{compareButton}</span>
                  </div>

                  {result && (
                    <div className="space-y-3">
                      {/* Counts */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-medium"><Plus className="h-3 w-3" />{result.added_count} added</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[11px] font-medium"><Minus className="h-3 w-3" />{result.deleted_count} deleted</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-medium"><Pencil className="h-3 w-3" />{result.modified_count} modified</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={downloadReport}>
                          <Download className="h-3 w-3 mr-1" />Download report
                        </Button>
                      </div>

                      {/* AI summary */}
                      {result.summary && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-[11px] font-semibold text-blue-800">AI Summary of Changes</span>
                          </div>
                          <p className="text-xs text-blue-900 leading-relaxed">{result.summary}</p>
                        </div>
                      )}

                      {/* Key changes */}
                      {legacyChanges.length > 0 && (
                        <ul className="space-y-1.5">
                          {legacyChanges.map((k, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs">
                              <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase", IMPACT_CLS[k.impact])}>{k.type}</span>
                              <span className="text-gray-700"><span className="font-medium">{k.clause}:</span> {k.detail}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Full diff — with inline / side-by-side toggle */}
                      <details className="rounded-lg border" open>
                        <summary className="px-3 py-2 text-[11px] font-medium text-gray-600 cursor-pointer flex items-center gap-2">
                          <span>Full text diff ({changedBlocks.length} changed block{changedBlocks.length === 1 ? "" : "s"})</span>
                          {/* Scope + view toggles — stop the click from collapsing the <details> */}
                          <span
                            className="ml-auto inline-flex rounded-md border bg-white overflow-hidden"
                            onClick={e => e.preventDefault()}
                          >
                            <button
                              type="button"
                              onClick={() => setScope("full")}
                              className={cn("px-2 py-1 text-[10px] font-medium transition-colors",
                                scope === "full" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50")}
                              title="Both contracts end to end, changes highlighted in place"
                            >
                              Full documents
                            </button>
                            <button
                              type="button"
                              onClick={() => setScope("changes")}
                              className={cn("px-2 py-1 text-[10px] font-medium transition-colors border-l",
                                scope === "changes" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50")}
                              title="Only the paragraphs that differ"
                            >
                              Changes only
                            </button>
                          </span>
                          <span
                            className="inline-flex rounded-md border bg-white overflow-hidden"
                            onClick={e => e.preventDefault()}
                          >
                            <button
                              type="button"
                              onClick={() => setDiffView("inline")}
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors",
                                diffView === "inline" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
                              )}
                              title="Stacked inline diff"
                            >
                              <AlignJustify className="h-3 w-3" />Inline
                            </button>
                            <button
                              type="button"
                              onClick={() => setDiffView("sidebyside")}
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors border-l",
                                diffView === "sidebyside" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
                              )}
                              title="Side-by-side comparison"
                            >
                              <Columns2 className="h-3 w-3" />Side by side
                            </button>
                          </span>
                        </summary>

                        {shownBlocks.length === 0 ? (
                          <div className="px-3 py-4 text-[11px] text-gray-400 border-t">No textual changes between these two versions.</div>
                        ) : diffView === "inline" ? (
                          /* ── Inline (stacked) ─────────────────────────── */
                          <div className="max-h-96 overflow-y-auto px-3 py-2 space-y-1.5 border-t">
                            {shownBlocks.map((b, i) => (
                              <div key={i} className="text-[11px] leading-relaxed">
                                {b.type === "added" && <p className="rounded bg-emerald-50 border-l-2 border-emerald-400 px-2 py-1 text-emerald-900"><span className="font-semibold">+ </span>{b.compared}</p>}
                                {b.type === "deleted" && <p className="rounded bg-red-50 border-l-2 border-red-400 px-2 py-1 text-red-900 line-through/50"><span className="font-semibold">− </span>{b.base}</p>}
                                {b.type === "modified" && (
                                  <div className="rounded bg-amber-50 border-l-2 border-amber-400 px-2 py-1">
                                    <p className="text-red-700"><span className="font-semibold">was: </span>{b.base}</p>
                                    <p className="text-emerald-800 mt-0.5"><span className="font-semibold">now: </span>{b.compared}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          /* ── Side by side (old left, new right) ────────── */
                          <div className="border-t">
                            {/* Column headers */}
                            <div className="grid grid-cols-2 gap-px bg-gray-200 text-[10px] font-semibold sticky top-0 z-10">
                              <div className="bg-gray-100 px-3 py-1.5 text-gray-600 flex items-center gap-1.5">
                                <Minus className="h-3 w-3 text-red-500" />
                                <span className="truncate">Older — {colLabel(baseVersion, "prior draft")}</span>
                              </div>
                              <div className="bg-gray-100 px-3 py-1.5 text-gray-600 flex items-center gap-1.5">
                                <Plus className="h-3 w-3 text-emerald-500" />
                                <span className="truncate">Newer — {colLabel(comparedVersion, "new draft")}</span>
                              </div>
                            </div>
                            {/* Aligned rows */}
                            <div className="max-h-96 overflow-y-auto divide-y">
                              {shownBlocks.map((b, i) => (
                                <div key={i} className="grid grid-cols-2 gap-px bg-gray-100">
                                  {/* Left: old text */}
                                  <div className={cn(
                                    "px-3 py-2 text-[11px] leading-relaxed min-h-[2rem]",
                                    b.type === "deleted" && "bg-red-50 text-red-900",
                                    b.type === "modified" && "bg-red-50/70 text-red-800",
                                    b.type === "added" && "bg-gray-50 text-gray-300 italic",
                                  )}>
                                    {b.type === "added" ? "— not present —" : b.base}
                                  </div>
                                  {/* Right: new text */}
                                  <div className={cn(
                                    "px-3 py-2 text-[11px] leading-relaxed min-h-[2rem]",
                                    b.type === "added" && "bg-emerald-50 text-emerald-900",
                                    b.type === "modified" && "bg-emerald-50/70 text-emerald-800",
                                    b.type === "deleted" && "bg-gray-50 text-gray-300 italic",
                                  )}>
                                    {b.type === "deleted" ? "— removed —" : b.compared}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </details>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
