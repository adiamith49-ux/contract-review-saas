"use client";
import { useEffect, useMemo, useRef } from "react";
import type { AnalysisOut } from "@/lib/api";
import type { RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Annotation {
  id: string;
  title: string;
  body: string;
  recommendation: string;
  risk: RiskLevel;
}

// ─── Text parsing ─────────────────────────────────────────────────────────────

function parseContractParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 10);
}

function isHeading(text: string): boolean {
  const t = text.trim();
  if (t.length > 250 || t.length < 3) return false;
  return (
    /^(\d+\.|\d+\s|ARTICLE\s|SECTION\s|CLAUSE\s)/i.test(t) ||
    (t === t.toUpperCase() && t.length < 120 && /[A-Z]/.test(t))
  );
}

// ─── Annotation matching ──────────────────────────────────────────────────────

function findMatchingParagraphIndex(needle: string, paragraphs: string[]): number {
  // Try section/clause/article number extraction
  const secMatch = needle.match(/(?:section|clause|article|§)\s*([\d.]+)/i);
  if (secMatch) {
    const num = secMatch[1].replace(/\./g, "\\.");
    const idx = paragraphs.findIndex(p => {
      const t = p.trim();
      return (
        new RegExp(`^(section|clause|article|§)?\\s*${num}[\\s.:\\-]`, "i").test(t) ||
        t.startsWith(secMatch[1] + " ") ||
        t.startsWith(secMatch[1] + ".")
      );
    });
    if (idx !== -1) return idx;
  }

  // Keyword matching
  const words = needle.toLowerCase().split(/\W+/).filter(w => w.length > 4);
  if (!words.length) return -1;

  let best = -1;
  let bestScore = 0.35;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].toLowerCase();
    const hits = words.filter(w => p.includes(w)).length;
    const score = hits / words.length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function buildAnnotationMap(
  analysis: AnalysisOut,
  paragraphs: string[],
): Map<number, Annotation[]> {
  const map = new Map<number, Annotation[]>();

  const add = (idx: number, ann: Annotation) => {
    if (idx < 0) return;
    map.set(idx, [...(map.get(idx) ?? []), ann]);
  };

  analysis.risk_summary.forEach((item, i) =>
    add(findMatchingParagraphIndex(`${item.area} ${item.risk}`, paragraphs), {
      id: `r-${i}`, title: item.area, body: item.risk,
      recommendation: item.recommendation, risk: item.severity as RiskLevel,
    })
  );

  analysis.clause_analysis.forEach((item, i) =>
    add(findMatchingParagraphIndex(`${item.clause} ${item.finding}`, paragraphs), {
      id: `c-${i}`, title: item.clause, body: item.finding,
      recommendation: item.recommendation, risk: item.risk,
    })
  );

  analysis.negotiation_points.forEach((item, i) =>
    add(findMatchingParagraphIndex(item.point, paragraphs), {
      id: `n-${i}`, title: item.point,
      body: `Preferred: ${item.preferredPosition}`,
      recommendation: `Fallback: ${item.fallbackPosition}`,
      risk: "medium" as RiskLevel,
    })
  );

  (analysis.ambiguity_flags ?? []).forEach((item, i) =>
    add(findMatchingParagraphIndex(`${item.term} ${item.location}`, paragraphs), {
      id: `a-${i}`, title: `"${item.term}"`, body: item.issue,
      recommendation: item.suggestion, risk: "medium" as RiskLevel,
    })
  );

  return map;
}


// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  text?: string | null;
  analysis: AnalysisOut | null;
  activeId: string | null;
  appliedIds?: Set<string>;
  panelOpen?: boolean;
}

export function DocumentViewer({ text, analysis, activeId, appliedIds, panelOpen = true }: Props) {
  const paragraphRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const paragraphs = useMemo(
    () => (text ? parseContractParagraphs(text) : []),
    [text],
  );

  const annMap = useMemo(
    () => (analysis ? buildAnnotationMap(analysis, paragraphs) : new Map<number, Annotation[]>()),
    [analysis, paragraphs],
  );

  // Reverse lookup: annotationId → paragraphIndex
  const annToParagraph = useMemo(() => {
    const map = new Map<string, number>();
    annMap.forEach((anns, pIdx) => anns.forEach(a => map.set(a.id, pIdx)));
    return map;
  }, [annMap]);

  // Scroll to relevant paragraph when activeId changes
  useEffect(() => {
    if (!activeId) return;
    const pIdx = annToParagraph.get(activeId);
    if (pIdx !== undefined) {
      paragraphRefs.current.get(pIdx)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeId, annToParagraph]);

  if (!text) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 text-sm text-gray-400">
        Document text not available for preview
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-100 px-6 py-8">
      {/* Paper-like document card — wider when review panel is closed */}
      <div className={cn("mx-auto bg-white shadow-md rounded-lg px-10 py-10 min-h-full transition-all duration-300", panelOpen ? "max-w-3xl" : "max-w-5xl")}>
        {paragraphs.map((para, idx) => {
          const annotations = annMap.get(idx) ?? [];
          const isActive = activeId !== null && annotations.some(a => a.id === activeId);
          const allApplied = annotations.length > 0 && annotations.every(a => appliedIds?.has(a.id));
          const heading = isHeading(para);

          // Three-state highlight: active (blue) > all-applied (green) > flagged (red)
          const highlightCls = annotations.length === 0 ? "" :
            isActive   ? "pl-3 py-1 border-l-4 border-l-blue-500 bg-blue-50 ring-2 ring-blue-300 ring-offset-1 rounded-sm" :
            allApplied ? "pl-3 py-1 border-l-4 border-l-green-500 bg-green-50" :
                         "pl-3 py-1 border-l-4 border-l-red-500 bg-red-50";

          return (
            <div
              key={idx}
              ref={el => { if (el) paragraphRefs.current.set(idx, el); }}
              className={cn("mb-5 rounded-sm transition-all duration-200", highlightCls)}
            >
              {/* Paragraph / heading text */}
              <p
                className={cn(
                  "leading-relaxed whitespace-pre-wrap break-words",
                  heading
                    ? "font-bold text-gray-900 text-sm mt-3 mb-0.5"
                    : "text-[13px] text-gray-700",
                )}
              >
                {para}
              </p>

              {/* Inline annotation cards (review-mode style) */}
              {annotations.length > 0 && (
                <div className="mt-2 space-y-1.5 pb-1">
                  {annotations.map(ann => {
                    const isAnnActive   = ann.id === activeId;
                    const isAnnApplied  = appliedIds?.has(ann.id);
                    const cardCls = isAnnApplied
                      ? "bg-green-100/80 text-green-900"
                      : isAnnActive
                      ? "bg-blue-100/80 text-blue-900"
                      : "bg-red-100/80 text-red-900";
                    return (
                      <div key={ann.id} className={cn("rounded-md px-3 py-2 text-[11px]", cardCls)}>
                        <p className="font-semibold mb-0.5">{ann.title}</p>
                        <p className="opacity-80 leading-relaxed">{ann.body}</p>
                        <p className="mt-1 font-medium opacity-90">→ {ann.recommendation}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="mt-10 pt-6 border-t text-[10px] text-gray-400 text-center leading-relaxed">
          AI-generated annotations are mapped to contract text for informational purposes only and do not constitute legal advice.
          <br />
          Annotations that could not be matched to a specific clause are listed in the Review Panel on the left.
        </div>
      </div>
    </div>
  );
}
