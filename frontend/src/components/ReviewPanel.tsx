"use client";
import { useState } from "react";
import {
  ChevronDown, ChevronRight, AlertTriangle, AlertCircle, Scale, MessageSquare,
} from "lucide-react";
import { RiskBadge } from "@/components/RiskBadge";
import type { AnalysisOut } from "@/lib/api";
import type { RiskLevel, AmbiguityFlag } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  analysis: AnalysisOut;
  activeId: string | null;
  onItemClick: (id: string) => void;
}

function riskBorderL(risk: RiskLevel) {
  switch (risk) {
    case "critical": return "border-l-red-500";
    case "high": return "border-l-orange-500";
    case "medium": return "border-l-amber-500";
    default: return "border-l-emerald-500";
  }
}

function riskBg(risk: RiskLevel) {
  switch (risk) {
    case "critical": return "bg-red-50";
    case "high": return "bg-orange-50";
    case "medium": return "bg-amber-50";
    default: return "bg-emerald-50";
  }
}

function SectionHeader({
  title, icon, count, open, onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-2.5 bg-white border-b hover:bg-gray-50 transition-colors text-left sticky top-0 z-10"
    >
      <div className="flex items-center gap-2">
        <span className="text-gray-500">{icon}</span>
        <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">{title}</span>
        <span className="ml-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-semibold leading-none">
          {count}
        </span>
      </div>
      {open
        ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
    </button>
  );
}

function AnnotationItem({
  id, active, title, body, recommendation, risk, onClick,
}: {
  id: string;
  active: boolean;
  title: string;
  body: string;
  recommendation: string;
  risk: RiskLevel;
  onClick: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onClick(id)}
      className={cn(
        "p-3 cursor-pointer border-b border-l-2 transition-all hover:brightness-95",
        active ? "bg-blue-50 border-l-blue-500" : cn(riskBg(risk), riskBorderL(risk)),
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[11px] font-semibold text-gray-800 leading-snug">{title}</p>
        <RiskBadge level={risk} className="text-[9px] px-1.5 py-0 shrink-0" />
      </div>
      <p className="text-[11px] text-gray-600 leading-relaxed mb-1.5">{body}</p>
      <div className="flex items-start gap-1">
        <ChevronRight className="h-2.5 w-2.5 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-blue-700 leading-relaxed">{recommendation}</p>
      </div>
    </div>
  );
}

export function ReviewPanel({ analysis, activeId, onItemClick }: Props) {
  const [open, setOpen] = useState({ risk: true, clauses: true, negotiation: true, ambiguity: false });
  const toggle = (k: keyof typeof open) => setOpen(p => ({ ...p, [k]: !p[k] }));

  const ambiguityFlags = analysis.ambiguity_flags as AmbiguityFlag[] | undefined;

  return (
    <div className="h-full overflow-y-auto flex flex-col bg-gray-50 select-none">
      {/* Overall risk summary */}
      <div className="px-4 py-3 bg-white border-b shrink-0">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Overall Risk</p>
        <RiskBadge level={analysis.risk_level} />
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
          <span>{analysis.risk_summary.length} risk areas</span>
          <span>·</span>
          <span>{analysis.clause_analysis.length} clause issues</span>
          <span>·</span>
          <span>{analysis.negotiation_points.length} negotiation pts</span>
          {ambiguityFlags && ambiguityFlags.length > 0 && (
            <><span>·</span><span>{ambiguityFlags.length} ambiguous terms</span></>
          )}
        </div>
      </div>

      {/* Risk Areas */}
      <div className="border-b">
        <SectionHeader
          title="Risk Areas"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          count={analysis.risk_summary.length}
          open={open.risk}
          onToggle={() => toggle("risk")}
        />
        {open.risk && analysis.risk_summary.map((item, i) => (
          <AnnotationItem
            key={`r-${i}`}
            id={`r-${i}`}
            active={activeId === `r-${i}`}
            title={item.area}
            body={item.risk}
            recommendation={item.recommendation}
            risk={item.severity as RiskLevel}
            onClick={onItemClick}
          />
        ))}
      </div>

      {/* Clause Issues */}
      <div className="border-b">
        <SectionHeader
          title="Clause Issues"
          icon={<AlertCircle className="h-3.5 w-3.5" />}
          count={analysis.clause_analysis.length}
          open={open.clauses}
          onToggle={() => toggle("clauses")}
        />
        {open.clauses && analysis.clause_analysis.map((item, i) => (
          <AnnotationItem
            key={`c-${i}`}
            id={`c-${i}`}
            active={activeId === `c-${i}`}
            title={item.clause}
            body={item.finding}
            recommendation={item.recommendation}
            risk={item.risk}
            onClick={onItemClick}
          />
        ))}
      </div>

      {/* Negotiation Points */}
      <div className="border-b">
        <SectionHeader
          title="Negotiation Points"
          icon={<Scale className="h-3.5 w-3.5" />}
          count={analysis.negotiation_points.length}
          open={open.negotiation}
          onToggle={() => toggle("negotiation")}
        />
        {open.negotiation && analysis.negotiation_points.map((item, i) => (
          <div
            key={`n-${i}`}
            onClick={() => onItemClick(`n-${i}`)}
            className={cn(
              "p-3 cursor-pointer border-b transition-all hover:brightness-95",
              activeId === `n-${i}` ? "bg-blue-50 border-l-2 border-l-blue-500" : "bg-white",
            )}
          >
            <p className="text-[11px] font-semibold text-gray-800 mb-2 leading-snug">{item.point}</p>
            <div className="space-y-1.5">
              <div className="bg-emerald-50 rounded-md p-2">
                <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide mb-0.5">Preferred Position</p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">{item.preferredPosition}</p>
              </div>
              <div className="bg-amber-50 rounded-md p-2">
                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">Fallback Position</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">{item.fallbackPosition}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ambiguity Flags */}
      {ambiguityFlags && ambiguityFlags.length > 0 && (
        <div className="border-b">
          <SectionHeader
            title="Ambiguity Flags"
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            count={ambiguityFlags.length}
            open={open.ambiguity}
            onToggle={() => toggle("ambiguity")}
          />
          {open.ambiguity && ambiguityFlags.map((item, i) => (
            <AnnotationItem
              key={`a-${i}`}
              id={`a-${i}`}
              active={activeId === `a-${i}`}
              title={`"${item.term}"`}
              body={item.issue}
              recommendation={item.suggestion}
              risk="medium"
              onClick={onItemClick}
            />
          ))}
        </div>
      )}

      <div className="mt-auto p-4 text-[10px] text-gray-400 text-center shrink-0">
        AI-generated · not legal advice
      </div>
    </div>
  );
}
