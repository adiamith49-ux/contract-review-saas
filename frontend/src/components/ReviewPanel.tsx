"use client";
import {
  X, ChevronDown, ChevronUp, ShieldAlert, FileWarning,
  Handshake, HelpCircle, Check, FileDown, ListChecks,
} from "lucide-react";
import { RiskBadge } from "@/components/RiskBadge";
import { Button } from "@/components/ui/button";
import type { AnalysisOut } from "@/lib/api";
import type { RiskLevel, AmbiguityFlag } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  analysis: AnalysisOut;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  appliedIds: Set<string>;
  onApply: (id: string) => void;
  onApplyAll: () => void;
  onClose: () => void;
  onDownload: () => void;
  redlinePlaced?: number;
  redlineTotal?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskDot(risk: string) {
  switch (risk) {
    case "critical": return "bg-red-500";
    case "high":     return "bg-orange-500";
    case "medium":   return "bg-amber-400";
    default:         return "bg-emerald-500";
  }
}

function riskBorderL(risk: string) {
  switch (risk) {
    case "critical": return "border-r-red-500";
    case "high":     return "border-r-orange-500";
    case "medium":   return "border-r-amber-400";
    default:         return "border-r-emerald-500";
  }
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({
  icon, title, count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-y sticky top-0 z-10">
      <span className="text-gray-400 shrink-0">{icon}</span>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex-1">{title}</span>
      <span className="text-[10px] bg-gray-200 text-gray-500 rounded-full px-1.5 py-0.5 font-semibold leading-none">
        {count}
      </span>
    </div>
  );
}

// ─── Accordion item (Risk Areas, Clause Issues, Ambiguity Flags) ──────────────

function AccordionItem({
  id, title, risk, body, recommendation,
  isOpen, isApplied, onToggle, onApply,
}: {
  id: string;
  title: string;
  risk: string;
  body: string;
  recommendation: string;
  isOpen: boolean;
  isApplied: boolean;
  onToggle: (id: string) => void;
  onApply: (id: string) => void;
}) {
  return (
    <div className={cn(
      "border-b border-r-2 transition-colors",
      isOpen ? riskBorderL(risk) : "border-r-transparent",
    )}>
      {/* Heading row — always visible */}
      <button
        onClick={() => onToggle(id)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
          isOpen ? "bg-gray-50" : "hover:bg-gray-50",
        )}
      >
        <span className={cn("h-2 w-2 rounded-full shrink-0", riskDot(risk))} />
        <span className="text-[11px] font-semibold text-gray-800 flex-1 leading-snug line-clamp-2 pr-1">
          {title}
        </span>
        <RiskBadge level={risk as RiskLevel} className="text-[9px] px-1.5 py-0 shrink-0" />
        {isApplied && <Check className="h-3 w-3 text-emerald-500 shrink-0" />}
        {isOpen
          ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
      </button>

      {/* Expanded body */}
      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-2 bg-white border-t border-gray-100">
          <p className="text-[11px] text-gray-600 leading-relaxed">{body}</p>
          <div className="rounded-md bg-blue-50 px-2.5 py-2">
            <p className="text-[9px] font-bold text-blue-700 uppercase tracking-wide mb-0.5">Recommendation</p>
            <p className="text-[11px] text-blue-800 leading-relaxed">{recommendation}</p>
          </div>
          <Button
            size="sm"
            variant={isApplied ? "outline" : "default"}
            className={cn(
              "w-full h-7 text-[11px]",
              isApplied && "border-emerald-500 text-emerald-700 hover:bg-emerald-50",
            )}
            onClick={() => onApply(id)}
          >
            {isApplied
              ? <><Check className="h-3 w-3 mr-1" />Applied</>
              : "Apply Change"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Negotiation item (preferred + fallback positions) ────────────────────────

function NegotiationItem({
  id, title, preferred, fallback,
  isOpen, isApplied, onToggle, onApply,
}: {
  id: string;
  title: string;
  preferred: string;
  fallback: string;
  isOpen: boolean;
  isApplied: boolean;
  onToggle: (id: string) => void;
  onApply: (id: string) => void;
}) {
  return (
    <div className={cn(
      "border-b border-l-2 transition-colors",
      isOpen ? "border-r-violet-500" : "border-r-transparent",
    )}>
      <button
        onClick={() => onToggle(id)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
          isOpen ? "bg-gray-50" : "hover:bg-gray-50",
        )}
      >
        <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
        <span className="text-[11px] font-semibold text-gray-800 flex-1 leading-snug line-clamp-2 pr-1">
          {title}
        </span>
        {isApplied && <Check className="h-3 w-3 text-emerald-500 shrink-0" />}
        {isOpen
          ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-2 bg-white border-t border-gray-100">
          <div className="rounded-md bg-emerald-50 px-2.5 py-2">
            <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide mb-0.5">Preferred Position</p>
            <p className="text-[11px] text-emerald-800 leading-relaxed">{preferred}</p>
          </div>
          <div className="rounded-md bg-amber-50 px-2.5 py-2">
            <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">Fallback Position</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">{fallback}</p>
          </div>
          <Button
            size="sm"
            variant={isApplied ? "outline" : "default"}
            className={cn(
              "w-full h-7 text-[11px]",
              isApplied && "border-emerald-500 text-emerald-700 hover:bg-emerald-50",
            )}
            onClick={() => onApply(id)}
          >
            {isApplied
              ? <><Check className="h-3 w-3 mr-1" />Applied</>
              : "Apply Preferred Position"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ReviewPanel({ analysis, activeId, onActiveChange, appliedIds, onApply, onApplyAll, onClose, onDownload, redlinePlaced, redlineTotal }: Props) {
  const ambiguityFlags = (analysis.ambiguity_flags ?? []) as AmbiguityFlag[];

  const allIds = [
    ...analysis.risk_summary.map((_, i) => `r-${i}`),
    ...analysis.clause_analysis.map((_, i) => `c-${i}`),
    ...analysis.negotiation_points.map((_, i) => `n-${i}`),
    ...ambiguityFlags.map((_, i) => `a-${i}`),
  ];

  function handleToggle(id: string) {
    onActiveChange(activeId === id ? null : id);
  }

  const remaining = allIds.length - appliedIds.size;

  return (
    <div className="w-[340px] shrink-0 flex flex-col bg-white border-l shadow-[-2px_0_12px_rgba(0,0,0,0.08)]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 bg-[#1a2035] text-white">
        <ListChecks className="h-4 w-4 text-white/60 shrink-0" />
        <span className="text-sm font-semibold flex-1">AI Review</span>
        <RiskBadge level={analysis.risk_level} className="text-[9px] shrink-0" />
        <button
          onClick={onClose}
          className="ml-1 p-1 rounded hover:bg-white/10 transition-colors shrink-0"
          title="Collapse panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-1.5 bg-gray-50 border-b flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-gray-500">
        <span>{analysis.risk_summary.length} risks</span>
        <span>·</span>
        <span>{analysis.clause_analysis.length} clauses</span>
        <span>·</span>
        <span>{analysis.negotiation_points.length} negotiations</span>
        {ambiguityFlags.length > 0 && (
          <><span>·</span><span>{ambiguityFlags.length} ambiguous</span></>
        )}
        {typeof redlinePlaced === "number" && (
          <><span>·</span>
          <span className={redlinePlaced > 0 ? "text-violet-600 font-medium" : "text-gray-400"}>
            {redlinePlaced}/{redlineTotal} redlined
          </span></>
        )}
        {appliedIds.size > 0 && (
          <><span>·</span><span className="text-emerald-600 font-medium">{appliedIds.size} applied</span></>
        )}
      </div>

      {/* ── Scrollable accordion items ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Risk Areas */}
        {analysis.risk_summary.length > 0 && (
          <>
            <SectionLabel
              icon={<ShieldAlert className="h-3 w-3" />}
              title="Risk Areas"
              count={analysis.risk_summary.length}
            />
            {analysis.risk_summary.map((item, i) => (
              <AccordionItem
                key={`r-${i}`}
                id={`r-${i}`}
                title={item.area}
                body={item.risk}
                recommendation={item.recommendation}
                risk={item.severity}
                isOpen={activeId === `r-${i}`}
                isApplied={appliedIds.has(`r-${i}`)}
                onToggle={handleToggle}
                onApply={onApply}
              />
            ))}
          </>
        )}

        {/* Clause Issues */}
        <SectionLabel
          icon={<FileWarning className="h-3 w-3" />}
          title="Clause Issues"
          count={analysis.clause_analysis.length}
        />
        {analysis.clause_analysis.length > 0 ? analysis.clause_analysis.map((item, i) => (
          <AccordionItem
            key={`c-${i}`}
            id={`c-${i}`}
            title={item.clause}
            body={item.finding}
            recommendation={item.recommendation}
            risk={item.risk}
            isOpen={activeId === `c-${i}`}
            isApplied={appliedIds.has(`c-${i}`)}
            onToggle={handleToggle}
            onApply={onApply}
          />
        )) : (
          <div className="px-4 py-3 text-[11px] text-gray-400 italic border-b">
            No clause-level issues flagged — all key clauses appear acceptable.
          </div>
        )}

        {/* Negotiation Points */}
        <SectionLabel
          icon={<Handshake className="h-3 w-3" />}
          title="Negotiation Points"
          count={analysis.negotiation_points.length}
        />
        {analysis.negotiation_points.length > 0 ? analysis.negotiation_points.map((item, i) => (
          <NegotiationItem
            key={`n-${i}`}
            id={`n-${i}`}
            title={item.point}
            preferred={item.preferredPosition}
            fallback={item.fallbackPosition}
            isOpen={activeId === `n-${i}`}
            isApplied={appliedIds.has(`n-${i}`)}
            onToggle={handleToggle}
            onApply={onApply}
          />
        )) : (
          <div className="px-4 py-3 text-[11px] text-gray-400 italic border-b">
            No negotiation points identified. Re-run analysis with legal intake for more targeted suggestions.
          </div>
        )}

        {/* Ambiguity Flags */}
        {ambiguityFlags.length > 0 && (
          <>
            <SectionLabel
              icon={<HelpCircle className="h-3 w-3" />}
              title="Ambiguity Flags"
              count={ambiguityFlags.length}
            />
            {ambiguityFlags.map((item, i) => (
              <AccordionItem
                key={`a-${i}`}
                id={`a-${i}`}
                title={`"${item.term}" — ${item.location}`}
                body={item.issue}
                recommendation={item.suggestion}
                risk="medium"
                isOpen={activeId === `a-${i}`}
                isApplied={appliedIds.has(`a-${i}`)}
                onToggle={handleToggle}
                onApply={onApply}
              />
            ))}
          </>
        )}

        <div className="h-4" />
      </div>

      {/* ── Footer actions ──────────────────────────────────────────────── */}
      <div className="shrink-0 p-3 border-t bg-white space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={onApplyAll}
          disabled={remaining === 0}
        >
          <Check className="h-3.5 w-3.5 mr-1.5" />
          {remaining === 0 ? "All Changes Applied" : `Apply All (${remaining} remaining)`}
        </Button>
        <Button
          size="sm"
          className="w-full h-8 text-xs"
          onClick={onDownload}
        >
          <FileDown className="h-3.5 w-3.5 mr-1.5" />
          Download Review (.docx)
        </Button>
        <p className="text-[9px] text-gray-400 text-center leading-relaxed">
          AI-generated · not legal advice
        </p>
      </div>
    </div>
  );
}
