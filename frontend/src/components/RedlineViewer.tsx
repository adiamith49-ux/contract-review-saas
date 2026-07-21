"use client";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, FileDown, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LocatedEdit, ProcessedEdit, UnmatchedEdit } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  source: string;
  edits: ProcessedEdit[];
  matched_count: number;
  unmatched_count: number;
  onDownloadDocx: () => void;
  downloadingDocx?: boolean;
}

interface Block {
  text: string;
  start: number;
  end: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let lastEnd = 0;
  const regex = /\n\n+/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(source)) !== null) {
    const text = source.slice(lastEnd, m.index);
    if (text.trim()) blocks.push({ text, start: lastEnd, end: m.index });
    lastEnd = m.index + m[0].length;
  }
  const tail = source.slice(lastEnd);
  if (tail.trim()) blocks.push({ text: tail, start: lastEnd, end: source.length });

  return blocks;
}

function isHeading(text: string): boolean {
  const t = text.trim();
  if (t.length > 250 || t.length < 3) return false;
  return (
    /^(\d+\.|\d+\s|ARTICLE\s|SECTION\s|CLAUSE\s)/i.test(t) ||
    (t === t.toUpperCase() && t.length < 120 && /[A-Z]/.test(t))
  );
}

function riskBadgeCls(risk: string) {
  if (risk === "High")   return "text-red-700 bg-red-100 border-red-200";
  if (risk === "Medium") return "text-orange-700 bg-orange-100 border-orange-200";
  return "text-green-700 bg-green-100 border-green-200";
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function renderBlockContent(
  block: Block,
  matchedEdits: LocatedEdit[],
  activeEditIdx: number | null,
  editRefs: React.MutableRefObject<Map<number, HTMLSpanElement>>,
  allMatchedEdits: LocatedEdit[],
): React.ReactNode {
  const blockEdits = matchedEdits
    .filter(e => e.start >= block.start && e.end <= block.end)
    .sort((a, b) => a.start - b.start);

  if (blockEdits.length === 0) return block.text;

  const segments: React.ReactNode[] = [];
  let cursor = block.start;

  for (const edit of blockEdits) {
    const editIdx = allMatchedEdits.indexOf(edit);
    const isActive = activeEditIdx === editIdx;

    if (edit.start > cursor) {
      segments.push(
        <span key={`t-${cursor}`}>{block.text.slice(cursor - block.start, edit.start - block.start)}</span>,
      );
    }

    const raw = block.text.slice(edit.start - block.start, edit.end - block.start);

    segments.push(
      <span
        key={`e-${edit.start}`}
        ref={el => { if (el) editRefs.current.set(editIdx, el); }}
        className={cn("rounded transition-all", isActive ? "ring-2 ring-blue-400 ring-offset-1" : "")}
      >
        {edit.edit_type === "delete" && (
          <del className="text-red-600 bg-red-100 line-through px-0.5 rounded-sm decoration-red-600">
            {raw}
          </del>
        )}
        {edit.edit_type === "insert" && (
          <>
            <span>{raw}</span>
            <ins className="text-blue-700 bg-blue-100 underline not-italic px-0.5 rounded-sm ml-0.5">
              {edit.revised_text}
            </ins>
          </>
        )}
        {edit.edit_type === "replace" && (
          <>
            <del className="text-red-600 bg-red-100 line-through px-0.5 rounded-sm decoration-red-600">
              {raw}
            </del>
            <ins className="text-blue-700 bg-blue-100 underline not-italic px-0.5 rounded-sm ml-0.5">
              {edit.revised_text}
            </ins>
          </>
        )}
      </span>,
    );

    cursor = edit.end;
  }

  if (cursor < block.end) {
    segments.push(
      <span key={`t-${cursor}`}>{block.text.slice(cursor - block.start)}</span>,
    );
  }

  return <>{segments}</>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RedlineViewer({
  source, edits, matched_count, unmatched_count, onDownloadDocx, downloadingDocx = false,
}: Props) {
  const [activeEditIdx, setActiveEditIdx] = useState<number | null>(null);
  const editRefs = useRef<Map<number, HTMLSpanElement>>(new Map());

  const blocks = useMemo(() => parseBlocks(source), [source]);

  const matched = useMemo(
    () => edits.filter((e): e is LocatedEdit => e.matched).sort((a, b) => a.start - b.start),
    [edits],
  );

  const unmatched = useMemo(
    () => edits.filter((e): e is UnmatchedEdit => !e.matched),
    [edits],
  );

  function scrollToEdit(idx: number) {
    setActiveEditIdx(prev => prev === idx ? null : idx);
    editRefs.current.get(idx)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const highCount   = edits.filter(e => e.risk === "High").length;
  const mediumCount = edits.filter(e => e.risk === "Medium").length;
  const lowCount    = edits.filter(e => e.risk === "Low").length;

  const allUnplaced = matched.length === 0 && unmatched.length > 0;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Document with redlines ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-100 px-6 py-8">
        <div className="mx-auto max-w-3xl bg-white shadow-md rounded-lg px-10 py-10 min-h-full">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-8 pb-4 border-b text-xs text-gray-500">
            <span className="font-medium text-gray-700">Legend:</span>
            <span className="flex items-center gap-1.5">
              <del className="text-red-600 bg-red-100 px-1.5 py-0.5 rounded text-[11px] line-through decoration-red-600">deleted</del>
              <span>= removed text</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ins className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[11px] underline not-italic">inserted</ins>
              <span>= suggested addition</span>
            </span>
          </div>

          {/* Zero-match warning banner */}
          {allUnplaced && (
            <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800 mb-0.5">No edits could be placed inline</p>
                <p className="text-xs text-orange-700">
                  {unmatched.length} edit{unmatched.length !== 1 ? "s" : ""} generated — see the Redline Edits panel on the right.
                  Try re-uploading the contract or re-running redlines.
                </p>
              </div>
            </div>
          )}

          {/* Contract text with inline edits */}
          {blocks.map((block, bIdx) => {
            const hasEdits = matched.some(e => e.start >= block.start && e.end <= block.end);
            const heading = isHeading(block.text);

            return (
              <p
                key={bIdx}
                className={cn(
                  "mb-5 break-words leading-relaxed",
                  heading ? "font-bold text-gray-900 text-sm mt-3 mb-1" : "text-[13px] text-gray-700",
                  hasEdits ? "bg-yellow-50/40 -mx-1 px-1 rounded" : "",
                  allUnplaced ? "opacity-40" : "",
                )}
              >
                {renderBlockContent(block, matched, activeEditIdx, editRefs, matched)}
              </p>
            );
          })}

          {/* Unmatched appendix — only when SOME edits were placed (rest go to sidebar) */}
          {!allUnplaced && unmatched.length > 0 && (
            <div className="mt-10 pt-6 border-t border-orange-200">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-semibold text-orange-800">
                  {unmatched.length} edit{unmatched.length > 1 ? "s" : ""} could not be placed — see sidebar
                </span>
              </div>
            </div>
          )}

          <div className="mt-10 pt-6 border-t text-[10px] text-gray-400 text-center leading-relaxed">
            AI-generated redlines are for informational purposes only and do not constitute legal advice.
          </div>
        </div>
      </div>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div className="w-[300px] shrink-0 border-l bg-white flex flex-col shadow-[-2px_0_12px_rgba(0,0,0,0.08)]">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 bg-[#0F2A2A] text-white flex items-center gap-2.5">
          <Zap className="h-4 w-4 text-white/60 shrink-0" />
          <span className="text-sm font-semibold flex-1">Redline Edits</span>
        </div>

        {/* Stats */}
        <div className="shrink-0 px-3 py-2 bg-gray-50 border-b flex flex-wrap gap-2 text-[10px]">
          <span className="text-gray-500">{matched_count} placed</span>
          {unmatched_count > 0 && (
            <><span className="text-gray-300">·</span>
            <span className="text-orange-600 font-medium">{unmatched_count} unplaced</span></>
          )}
          <span className="ml-auto flex gap-2">
            {highCount > 0 && <span className="text-red-600 font-medium">{highCount}H</span>}
            {mediumCount > 0 && <span className="text-orange-600 font-medium">{mediumCount}M</span>}
            {lowCount > 0 && <span className="text-green-600 font-medium">{lowCount}L</span>}
          </span>
        </div>

        {/* Edit list — unplaced FIRST, then placed */}
        <div className="flex-1 overflow-y-auto divide-y">

          {/* ── Unplaced items at top ─────────────────────────────────────── */}
          {unmatched.length > 0 && (
            <>
              <div className="px-3 py-1.5 bg-orange-50 border-b border-orange-100 text-[10px] text-orange-700 font-semibold flex items-center gap-1.5 sticky top-0 z-10">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {unmatched.length} unplaced edit{unmatched.length !== 1 ? "s" : ""}
              </div>
              {unmatched.map((edit, i) => (
                <div key={`u-${i}`} className="px-3 py-3 bg-orange-50/40 border-b border-orange-100/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-gray-800 leading-snug flex-1 mr-2 line-clamp-1">
                      {edit.clause_ref}
                    </span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold border shrink-0", riskBadgeCls(edit.risk))}>
                      {edit.risk}
                    </span>
                  </div>
                  {edit.original_text && (
                    <div className="mb-1.5">
                      <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Original</span>
                      <p className="text-[10px] text-red-700 bg-red-50 border border-red-100 rounded px-1.5 py-1 mt-0.5 line-clamp-2 leading-relaxed">
                        {edit.original_text}
                      </p>
                    </div>
                  )}
                  {edit.revised_text && (
                    <div className="mb-1.5">
                      <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Suggested</span>
                      <p className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-1 mt-0.5 line-clamp-2 leading-relaxed">
                        {edit.revised_text}
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] text-orange-600 italic line-clamp-2 leading-relaxed">{edit.rationale}</p>
                </div>
              ))}
            </>
          )}

          {/* ── Placed items below ────────────────────────────────────────── */}
          {matched.length > 0 && (
            <>
              {unmatched.length > 0 && (
                <div className="px-3 py-1.5 bg-gray-50 border-b text-[10px] text-gray-500 font-semibold sticky top-0 z-10">
                  {matched.length} placed inline
                </div>
              )}
              {matched.map((edit, i) => {
                const isActive = activeEditIdx === i;
                return (
                  <button
                    key={`m-${i}`}
                    onClick={() => scrollToEdit(i)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 transition-colors",
                      isActive ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-50",
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold border shrink-0", riskBadgeCls(edit.risk))}>
                        {edit.risk}
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                        {edit.edit_type}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-1 mb-0.5">
                      {edit.clause_ref}
                    </p>
                    <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
                      {edit.rationale}
                    </p>
                  </button>
                );
              })}
            </>
          )}

          <div className="h-4" />
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3 border-t bg-white space-y-1.5">
          <Button
            size="sm"
            className="w-full h-8 text-xs"
            onClick={onDownloadDocx}
            disabled={downloadingDocx}
          >
            {downloadingDocx
              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating…</>
              : <><FileDown className="h-3.5 w-3.5 mr-1.5" />Download Redlines (.docx)</>
            }
          </Button>
          <p className="text-[9px] text-gray-400 text-center">
            Opens in Word with track changes — accept/reject in Review tab
          </p>
        </div>
      </div>
    </div>
  );
}
