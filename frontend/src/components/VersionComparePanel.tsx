"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown, ChevronUp, Loader2, GitCompare, Upload, Plus, Minus, Pencil,
  Sparkles, Download, ArrowRight, Columns2, AlignJustify,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import {
  listVersions, compareVersions,
  type VersionItem, type Comparison,
} from "@/lib/api";
import { CONTRACT_BUSINESS_STATUS_LABELS } from "@/lib/utils";

interface Props {
  contractId: string;
  getToken: () => Promise<string | null>;
}

const IMPACT_CLS: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-gray-100 text-gray-600",
};

export function VersionComparePanel({ contractId, getToken }: Props) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseId, setBaseId] = useState<string>("");
  const [againstId, setAgainstId] = useState<string>("");
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<Comparison | null>(null);
  const [diffView, setDiffView] = useState<"inline" | "sidebyside">("sidebyside");

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

  useEffect(() => { if (open && loading) load(); }, [open, loading, load]);

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
    if (result.key_changes.length) {
      lines.push(`## Key Changes`);
      for (const k of result.key_changes) {
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

  const baseVersion = result ? versions.find(v => v.id === result.base_contract_id) : undefined;
  const comparedVersion = result ? versions.find(v => v.id === result.compared_contract_id) : undefined;
  const colLabel = (v: VersionItem | undefined, fallback: string) =>
    v ? `v${v.version_number} · ${v.title || v.filename}` : fallback;

  return (
    <div className="shrink-0 border-b bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 md:px-5 py-2 flex items-center gap-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <GitCompare className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-xs font-semibold text-gray-700">Versions & Comparison</span>
        {!loading && <span className="text-[10px] text-gray-400">{versions.length} version{versions.length === 1 ? "" : "s"}</span>}
        <span className="ml-auto text-gray-400">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </button>

      {open && (
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
              <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                <Link href={`/upload?parent=${versions[0]?.id ?? contractId}`}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />Upload New Version (e.g. counterparty redline)
                </Link>
              </Button>

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
                    <Button size="sm" className="h-7 text-xs ml-auto" onClick={handleCompare} disabled={comparing}>
                      {comparing ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Comparing…</> : <><GitCompare className="h-3 w-3 mr-1" />Compare</>}
                    </Button>
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
                      {result.key_changes.length > 0 && (
                        <ul className="space-y-1.5">
                          {result.key_changes.map((k, i) => (
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
                          {/* View toggle — stop the click from collapsing the <details> */}
                          <span
                            className="ml-auto inline-flex rounded-md border bg-white overflow-hidden"
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

                        {changedBlocks.length === 0 ? (
                          <div className="px-3 py-4 text-[11px] text-gray-400 border-t">No textual changes between these two versions.</div>
                        ) : diffView === "inline" ? (
                          /* ── Inline (stacked) ─────────────────────────── */
                          <div className="max-h-96 overflow-y-auto px-3 py-2 space-y-1.5 border-t">
                            {changedBlocks.map((b, i) => (
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
                              {changedBlocks.map((b, i) => (
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
