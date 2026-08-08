"use client";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, AlignLeft, Columns2, FileDown, Loader2, Zap } from "lucide-react";
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

// "inline"   — Word-style markup: deletion and insertion sit next to each other.
// "original" — the contract as it stands today; edited spans struck through.
// "revised"  — the contract as it would read if every edit were accepted.
type RenderMode = "inline" | "original" | "revised";

// Standard legal-markup convention: deletions red + struck through, insertions
// green + underlined. Matches the DOCX/PDF exports so screen and paper agree.
const DEL_CLS = "text-red-700 bg-red-100 line-through px-0.5 rounded-sm decoration-red-600";
const INS_CLS = "text-emerald-800 bg-emerald-100 underline decoration-emerald-600 not-italic px-0.5 rounded-sm";

// An edit that OVERLAPS this block, not one that fits inside it. A redline
// routinely spans a paragraph break — a finding about Section 39 covers 39.1
// and 39.2, which are separate blocks — and requiring containment meant those
// edits matched no block at all and silently rendered nothing, even though the
// backend had placed them correctly.
function editsInBlock(block: Block, matchedEdits: LocatedEdit[]): LocatedEdit[] {
  return matchedEdits
    .filter(e => e.start < block.end && e.end > block.start)
    .sort((a, b) => a.start - b.start);
}

function renderBlockContent(
  block: Block,
  matchedEdits: LocatedEdit[],
  activeEditIdx: number | null,
  editRefs: React.MutableRefObject<Map<number, HTMLSpanElement>>,
  allMatchedEdits: LocatedEdit[],
  mode: RenderMode = "inline",
  // Only one column may own the scroll anchors, or the later one wins the ref
  // and "jump to edit" scrolls the wrong pane.
  registerRefs = true,
): React.ReactNode {
  const blockEdits = editsInBlock(block, matchedEdits);

  if (blockEdits.length === 0) return block.text;

  const segments: React.ReactNode[] = [];
  let cursor = block.start;

  for (const edit of blockEdits) {
    const editIdx = allMatchedEdits.indexOf(edit);
    const isActive = activeEditIdx === editIdx;

    // Clamp to this block — the edit may start before it or end after it.
    const from = Math.max(edit.start, block.start);
    const to = Math.min(edit.end, block.end);
    // The replacement text belongs on the LAST block the edit touches, so a
    // span crossing a paragraph break strikes through both halves but inserts
    // the revised clause once rather than repeating it.
    const isFinalPiece = to >= edit.end;

    if (from > cursor) {
      segments.push(
        <span key={`t-${cursor}`}>{block.text.slice(cursor - block.start, from - block.start)}</span>,
      );
    }

    const raw = block.text.slice(from - block.start, to - block.start);

    let body: React.ReactNode;
    if (mode === "original") {
      // A pure insertion adds nothing to the original — show the anchor plain.
      body = edit.edit_type === "insert"
        ? <span>{raw}</span>
        : <del className={DEL_CLS}>{raw}</del>;
    } else if (mode === "revised") {
      // A deletion leaves nothing behind in the revised text.
      if (edit.edit_type === "delete") body = null;
      else if (edit.edit_type === "insert") {
        body = <><span>{raw}</span>{isFinalPiece && <ins className={cn(INS_CLS, "ml-0.5")}>{edit.revised_text}</ins>}</>;
      } else {
        body = isFinalPiece ? <ins className={INS_CLS}>{edit.revised_text}</ins> : null;
      }
    } else {
      if (edit.edit_type === "delete") body = <del className={DEL_CLS}>{raw}</del>;
      else if (edit.edit_type === "insert") {
        body = <><span>{raw}</span>{isFinalPiece && <ins className={cn(INS_CLS, "ml-0.5")}>{edit.revised_text}</ins>}</>;
      } else {
        body = (
          <>
            <del className={DEL_CLS}>{raw}</del>
            {isFinalPiece && <ins className={cn(INS_CLS, "ml-0.5")}>{edit.revised_text}</ins>}
          </>
        );
      }
    }

    segments.push(
      <span
        key={`e-${edit.start}-${from}`}
        ref={registerRefs ? (el => { if (el) editRefs.current.set(editIdx, el); }) : undefined}
        className={cn("rounded transition-all", isActive ? "ring-2 ring-blue-400 ring-offset-1" : "")}
      >
        {body}
      </span>,
    );

    cursor = to;
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
  const [layout, setLayout] = useState<"sidebyside" | "inline">("sidebyside");
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
  const sideBySide = layout === "sidebyside";

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Document with redlines ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-100 px-6 py-8">
        <div className={cn(
          "mx-auto bg-white shadow-md rounded-lg py-10 min-h-full",
          sideBySide ? "max-w-6xl px-6" : "max-w-3xl px-10",
        )}>
          {/* Legend + layout toggle */}
          <div className="flex items-center gap-4 mb-8 pb-4 border-b text-xs text-gray-500">
            <span className="font-medium text-gray-700">Legend:</span>
            <span className="flex items-center gap-1.5">
              <del className="text-red-600 bg-red-100 px-1.5 py-0.5 rounded text-[11px] line-through decoration-red-600">deleted</del>
              <span>= removed text</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ins className="text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded text-[11px] underline decoration-emerald-600 not-italic">inserted</ins>
              <span>= suggested addition</span>
            </span>

            <div className="ml-auto flex items-center rounded-md border bg-gray-50 p-0.5 gap-0.5 shrink-0">
              <button
                onClick={() => setLayout("sidebyside")}
                className={cn(
                  "flex items-center gap-1 text-[11px] px-2 py-1 rounded font-medium transition-colors",
                  sideBySide ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700",
                )}
              >
                <Columns2 className="h-3 w-3" />Side by side
              </button>
              <button
                onClick={() => setLayout("inline")}
                className={cn(
                  "flex items-center gap-1 text-[11px] px-2 py-1 rounded font-medium transition-colors",
                  !sideBySide ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700",
                )}
              >
                <AlignLeft className="h-3 w-3" />Inline
              </button>
            </div>
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

          {/* Column headers — side-by-side only */}
          {sideBySide && (
            <div className="sticky top-0 z-10 -mt-2 mb-4 flex gap-4 bg-white pb-2 border-b">
              <div className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Original
              </div>
              <div className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-wider text-blue-500">
                Redlined
              </div>
            </div>
          )}

          {/* Contract text with edits */}
          {blocks.map((block, bIdx) => {
            const hasEdits = matched.some(e => e.start >= block.start && e.end <= block.end);
            const heading = isHeading(block.text);

            const paraCls = cn(
              "break-words leading-relaxed",
              heading ? "font-bold text-gray-900 text-sm" : "text-[13px] text-gray-700",
              allUnplaced ? "opacity-40" : "",
            );

            if (sideBySide) {
              return (
                <div
                  key={bIdx}
                  className={cn(
                    "flex gap-4 items-stretch",
                    heading ? "mt-3 mb-1" : "mb-5",
                    hasEdits ? "bg-yellow-50/40 -mx-1 px-1 rounded" : "",
                  )}
                >
                  <p className={cn(paraCls, "flex-1 min-w-0")}>
                    {renderBlockContent(block, matched, activeEditIdx, editRefs, matched, "original")}
                  </p>
                  <div className="w-px shrink-0 bg-gray-100" aria-hidden />
                  <p className={cn(paraCls, "flex-1 min-w-0")}>
                    {renderBlockContent(block, matched, activeEditIdx, editRefs, matched, "revised", false)}
                  </p>
                </div>
              );
            }

            return (
              <p
                key={bIdx}
                className={cn(
                  paraCls,
                  heading ? "mt-3 mb-1" : "mb-5",
                  hasEdits ? "bg-yellow-50/40 -mx-1 px-1 rounded" : "",
                )}
              >
                {renderBlockContent(block, matched, activeEditIdx, editRefs, matched, "inline")}
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
                      <p className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-1 mt-0.5 line-clamp-2 leading-relaxed">
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
