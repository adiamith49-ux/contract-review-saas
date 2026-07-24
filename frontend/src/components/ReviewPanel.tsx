
"use client";
import { useState, useEffect, useCallback } from "react";
import {
  X, ChevronDown, ChevronUp, ShieldAlert, FileWarning,
  Handshake, HelpCircle, Check, FileDown, ListChecks,
  FileText, AlertCircle, Users, Calendar, Scale, BookOpen,
  XCircle, Pencil, Copy, Search, Loader2, Send,
} from "lucide-react";
import { toast } from "sonner";
import { RiskBadge } from "@/components/RiskBadge";
import { Button } from "@/components/ui/button";
import { listClauses, submitTicket, type AnalysisOut, type Clause } from "@/lib/api";
import type { RiskLevel, AmbiguityFlag, ExtractedClause, MissingClause, ContractMetadata } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

type ItemDecision = "accepted" | "rejected" | "edited";

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
  onScrollToText?: (text: string) => void;
  getToken: () => Promise<string | null>;
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "clauses" | "risks" | "negotiate" | "library";

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

function importanceDot(imp: string) {
  switch (imp) {
    case "critical":    return "bg-red-500";
    case "important":   return "bg-amber-500";
    default:            return "bg-blue-400";
  }
}

const CLAUSE_TYPE_LABELS: Record<string, string> = {
  confidentiality: "Confidentiality",
  indemnification: "Indemnification",
  limitation_of_liability: "Limitation of Liability",
  termination: "Termination",
  ip_ownership: "IP Ownership",
  data_protection: "Data Protection",
  governing_law: "Governing Law",
  payment_terms: "Payment Terms",
  representations_warranties: "Representations & Warranties",
  non_compete: "Non-Compete",
  non_solicitation: "Non-Solicitation",
  force_majeure: "Force Majeure",
  assignment: "Assignment",
  dispute_resolution: "Dispute Resolution",
  insurance: "Insurance",
  audit_rights: "Audit Rights",
  compliance: "Compliance",
  notice_provisions: "Notice Provisions",
  entire_agreement: "Entire Agreement",
  amendment: "Amendment",
  severability: "Severability",
  survival: "Survival",
  other: "Other",
};

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-y sticky top-0 z-10">
      <span className="text-gray-400 shrink-0">{icon}</span>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex-1">{title}</span>
      <span className="text-[10px] bg-gray-200 text-gray-500 rounded-full px-1.5 py-0.5 font-semibold leading-none">{count}</span>
    </div>
  );
}

// ─── Metadata Card ───────────────────────────────────────────────────────────

function MetadataSection({ metadata }: { metadata: ContractMetadata }) {
  const rows: { label: string; value: string; icon: React.ReactNode }[] = [];

  if (metadata.parties?.length > 0) {
    rows.push({
      label: "Parties",
      value: metadata.parties.map(p => `${p.name} (${p.role})`).join(" · "),
      icon: <Users className="h-3 w-3" />,
    });
  }
  if (metadata.effectiveDate && metadata.effectiveDate !== "Not specified") {
    rows.push({ label: "Effective Date", value: metadata.effectiveDate, icon: <Calendar className="h-3 w-3" /> });
  }
  if (metadata.expirationDate && metadata.expirationDate !== "Not specified") {
    rows.push({ label: "Expiration", value: metadata.expirationDate, icon: <Calendar className="h-3 w-3" /> });
  }
  if (metadata.term && metadata.term !== "Not specified") {
    rows.push({ label: "Term", value: metadata.term, icon: <Calendar className="h-3 w-3" /> });
  }
  if (metadata.renewalTerms && metadata.renewalTerms !== "Not specified") {
    rows.push({ label: "Renewal", value: metadata.renewalTerms, icon: <Calendar className="h-3 w-3" /> });
  }
  if (metadata.noticePeriod && metadata.noticePeriod !== "Not specified") {
    rows.push({ label: "Notice Period", value: metadata.noticePeriod, icon: <Calendar className="h-3 w-3" /> });
  }
  if (metadata.governingLaw && metadata.governingLaw !== "Not specified") {
    rows.push({ label: "Governing Law", value: metadata.governingLaw, icon: <Scale className="h-3 w-3" /> });
  }
  if (metadata.disputeResolution && metadata.disputeResolution !== "Not specified") {
    rows.push({ label: "Disputes", value: metadata.disputeResolution, icon: <Scale className="h-3 w-3" /> });
  }
  if (metadata.totalValue && metadata.totalValue !== "Not specified") {
    rows.push({ label: "Value", value: metadata.totalValue, icon: <FileText className="h-3 w-3" /> });
  }
  if (metadata.paymentTerms && metadata.paymentTerms !== "Not specified") {
    rows.push({ label: "Payment", value: metadata.paymentTerms, icon: <FileText className="h-3 w-3" /> });
  }

  if (rows.length === 0) return null;

  return (
    <div className="border-b">
      <SectionLabel icon={<BookOpen className="h-3 w-3" />} title="Extracted Metadata" count={rows.length} />
      <div className="px-3 py-2 space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5 shrink-0">{r.icon}</span>
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{r.label}</span>
              <p className="text-[11px] text-gray-700 leading-snug">{r.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Extracted Clause Item ───────────────────────────────────────────────────

function ExtractedClauseItem({
  clause, isOpen, onToggle, onScrollToText,
}: {
  clause: ExtractedClause;
  isOpen: boolean;
  onToggle: () => void;
  onScrollToText?: (text: string) => void;
}) {
  return (
    <div className={cn("border-b border-r-2 transition-colors", isOpen ? riskBorderL(clause.risk) : "border-r-transparent")}>
      <button onClick={onToggle} className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors", isOpen ? "bg-gray-50" : "hover:bg-gray-50")}>
        <span className={cn("h-2 w-2 rounded-full shrink-0", riskDot(clause.risk))} />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-1">{clause.title}</span>
          <span className="text-[9px] text-gray-400 ml-1">{CLAUSE_TYPE_LABELS[clause.clauseType] ?? clause.clauseType}</span>
        </div>
        <RiskBadge level={clause.risk} className="text-[9px] px-1.5 py-0 shrink-0" />
        {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-2 bg-white border-t border-gray-100">
          <div className="rounded-md bg-gray-50 px-2.5 py-2">
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Summary</p>
            <p className="text-[11px] text-gray-700 leading-relaxed">{clause.summary}</p>
          </div>

          {clause.issues && clause.issues.length > 0 && (
            <div className="rounded-md bg-amber-50 px-2.5 py-2">
              <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wide mb-1">Issues</p>
              <ul className="space-y-0.5">
                {clause.issues.map((issue, i) => (
                  <li key={i} className="text-[11px] text-amber-800 leading-relaxed flex gap-1.5">
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-md bg-slate-100 px-2.5 py-2 max-h-32 overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Contract Text</p>
              {onScrollToText && (
                <button
                  onClick={() => onScrollToText(clause.verbatimText.slice(0, 80))}
                  className="text-[9px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  Show in document →
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed italic whitespace-pre-wrap">
              &ldquo;{clause.verbatimText.length > 500 ? clause.verbatimText.slice(0, 500) + "…" : clause.verbatimText}&rdquo;
            </p>
          </div>

          <p className="text-[9px] text-gray-400">{clause.section}</p>
        </div>
      )}
    </div>
  );
}

// ─── Missing Clause Item ────────────────────────────────────────────────────

function MissingClauseItem({ clause, isOpen, onToggle }: { clause: MissingClause; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={cn("border-b border-r-2 transition-colors", isOpen ? "border-r-red-400" : "border-r-transparent")}>
      <button onClick={onToggle} className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors", isOpen ? "bg-red-50/50" : "hover:bg-gray-50")}>
        <span className={cn("h-2 w-2 rounded-full shrink-0", importanceDot(clause.importance))} />
        <span className="text-[11px] font-semibold text-gray-800 flex-1 leading-snug">{clause.clauseType}</span>
        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", {
          "bg-red-100 text-red-700": clause.importance === "critical",
          "bg-amber-100 text-amber-700": clause.importance === "important",
          "bg-blue-100 text-blue-700": clause.importance === "recommended",
        })}>{clause.importance}</span>
        {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-2 bg-white border-t border-gray-100">
          <p className="text-[11px] text-gray-600 leading-relaxed">{clause.recommendation}</p>
          {clause.suggestedLanguage && (
            <div className="rounded-md bg-emerald-50 px-2.5 py-2">
              <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide mb-0.5">Suggested Language</p>
              <p className="text-[10px] text-emerald-800 leading-relaxed italic">&ldquo;{clause.suggestedLanguage}&rdquo;</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Accordion item (Risk Areas, Clause Issues, Ambiguity Flags) ──────────────

function AccordionItem({
  id, title, risk, body, recommendation, contractText, suggestedLanguage, clauseRef,
  isOpen, isApplied, onToggle, onApply, onScrollToText,
  decision, onDecision, editedText, onEditedTextChange,
}: {
  id: string;
  title: string;
  risk: string;
  body: string;
  recommendation: string;
  contractText?: string;
  suggestedLanguage?: string;
  clauseRef?: string;
  isOpen: boolean;
  isApplied: boolean;
  onToggle: (id: string) => void;
  onApply: (id: string) => void;
  onScrollToText?: (text: string) => void;
  decision?: ItemDecision;
  onDecision?: (id: string, d: ItemDecision) => void;
  editedText?: string;
  onEditedTextChange?: (id: string, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className={cn("border-b border-r-2 transition-colors", isOpen ? riskBorderL(risk) : "border-r-transparent")}>
      <button onClick={() => onToggle(id)} className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors", isOpen ? "bg-gray-50" : "hover:bg-gray-50")}>
        <span className={cn("h-2 w-2 rounded-full shrink-0", riskDot(risk))} />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-2 pr-1">{title}</span>
          {clauseRef && <span className="text-[9px] text-gray-400 ml-1">{clauseRef}</span>}
        </div>
        <RiskBadge level={risk as RiskLevel} className="text-[9px] px-1.5 py-0 shrink-0" />
        {decision === "accepted" && <Check className="h-3 w-3 text-emerald-500 shrink-0" />}
        {decision === "rejected" && <XCircle className="h-3 w-3 text-red-400 shrink-0" />}
        {decision === "edited" && <Pencil className="h-3 w-3 text-blue-500 shrink-0" />}
        {!decision && isApplied && <Check className="h-3 w-3 text-emerald-500 shrink-0" />}
        {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-2 bg-white border-t border-gray-100">
          <p className="text-[11px] text-gray-600 leading-relaxed">{body}</p>

          {contractText && (
            <div className="rounded-md bg-slate-100 px-2.5 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Contract Text</p>
                {onScrollToText && (
                  <button onClick={() => onScrollToText(contractText.slice(0, 80))} className="text-[9px] text-blue-600 hover:text-blue-800 font-medium">
                    Show in document →
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-600 leading-relaxed italic">&ldquo;{contractText.length > 300 ? contractText.slice(0, 300) + "…" : contractText}&rdquo;</p>
            </div>
          )}

          <div className="rounded-md bg-blue-50 px-2.5 py-2">
            <p className="text-[9px] font-bold text-blue-700 uppercase tracking-wide mb-0.5">Recommendation</p>
            <p className="text-[11px] text-blue-800 leading-relaxed">{recommendation}</p>
          </div>

          {/* Suggested replacement language */}
          {suggestedLanguage && (
            <div className={cn("rounded-md px-2.5 py-2", decision === "rejected" ? "bg-red-50/50 opacity-60" : "bg-emerald-50")}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide">Suggested Language</p>
                {!editing && onDecision && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-[9px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
                  >
                    <Pencil className="h-2.5 w-2.5" /> Edit
                  </button>
                )}
              </div>
              {editing ? (
                <textarea
                  className="w-full text-[10px] text-gray-800 leading-relaxed border rounded px-2 py-1.5 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  value={editedText ?? suggestedLanguage}
                  onChange={(e) => onEditedTextChange?.(id, e.target.value)}
                  rows={4}
                />
              ) : (
                <p className="text-[10px] text-emerald-800 leading-relaxed italic">
                  &ldquo;{decision === "edited" && editedText ? editedText : suggestedLanguage}&rdquo;
                </p>
              )}
              {editing && (
                <div className="flex gap-1.5 mt-1.5">
                  <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => { setEditing(false); onDecision?.(id, "edited"); onApply(id); }}>
                    <Check className="h-2.5 w-2.5 mr-1" />Save & Apply
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setEditing(false); onEditedTextChange?.(id, suggestedLanguage); }}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Accept / Reject / Apply buttons */}
          {suggestedLanguage && onDecision && !editing ? (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={decision === "accepted" ? "outline" : "default"}
                className={cn("flex-1 h-7 text-[11px]", decision === "accepted" && "border-emerald-500 text-emerald-700 hover:bg-emerald-50")}
                onClick={() => { onDecision(id, "accepted"); onApply(id); }}
              >
                {decision === "accepted" ? <><Check className="h-3 w-3 mr-1" />Accepted</> : <><Check className="h-3 w-3 mr-1" />Accept</>}
              </Button>
              <Button
                size="sm"
                variant={decision === "rejected" ? "outline" : "outline"}
                className={cn("h-7 text-[11px] px-3", decision === "rejected" && "border-red-400 text-red-600 hover:bg-red-50")}
                onClick={() => onDecision(id, "rejected")}
              >
                {decision === "rejected" ? <><XCircle className="h-3 w-3 mr-1" />Rejected</> : <><XCircle className="h-3 w-3 mr-1" />Reject</>}
              </Button>
            </div>
          ) : !suggestedLanguage ? (
            <Button
              size="sm"
              variant={isApplied ? "outline" : "default"}
              className={cn("w-full h-7 text-[11px]", isApplied && "border-emerald-500 text-emerald-700 hover:bg-emerald-50")}
              onClick={() => onApply(id)}
            >
              {isApplied ? <><Check className="h-3 w-3 mr-1" />Applied</> : "Apply Change"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Negotiation item ────────────────────────────────────────────────────────

function NegotiationItem({
  id, title, preferred, fallback, isOpen, isApplied, onToggle, onApply,
}: {
  id: string; title: string; preferred: string; fallback: string;
  isOpen: boolean; isApplied: boolean; onToggle: (id: string) => void; onApply: (id: string) => void;
}) {
  return (
    <div className={cn("border-b border-l-2 transition-colors", isOpen ? "border-r-violet-500" : "border-r-transparent")}>
      <button onClick={() => onToggle(id)} className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors", isOpen ? "bg-gray-50" : "hover:bg-gray-50")}>
        <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
        <span className="text-[11px] font-semibold text-gray-800 flex-1 leading-snug line-clamp-2 pr-1">{title}</span>
        {isApplied && <Check className="h-3 w-3 text-emerald-500 shrink-0" />}
        {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
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
            className={cn("w-full h-7 text-[11px]", isApplied && "border-emerald-500 text-emerald-700 hover:bg-emerald-50")}
            onClick={() => onApply(id)}
          >
            {isApplied ? <><Check className="h-3 w-3 mr-1" />Applied</> : "Apply Preferred Position"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Clause Library tab (read-only quick-access while reviewing) ───────────────

const CLAUSE_TYPE_CLS: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  fallback: "bg-amber-100 text-amber-700",
  unacceptable: "bg-red-100 text-red-700",
};
// Match the labels used on the /clauses page (approved is shown as "Preferred")
const CLAUSE_TYPE_LABEL: Record<string, string> = {
  approved: "Preferred",
  fallback: "Fallback",
  unacceptable: "Walk-away",
};

function ClauseLibraryTab({ getToken }: { getToken: () => Promise<string | null> }) {
  const [clauses, setClauses] = useState<Clause[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [requestFor, setRequestFor] = useState<Clause | null>(null);
  const [requestText, setRequestText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const { clauses } = await listClauses(token);
      setClauses(clauses);
    } catch {
      setError(true);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  async function copy(c: Clause) {
    try {
      await navigator.clipboard.writeText(c.content);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 1500);
      toast.success("Clause copied — paste into a suggestion or redline");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  async function sendRequest() {
    if (!requestFor || !requestText.trim()) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      await submitTicket(token, {
        type: "clause_change",
        reference_id: requestFor.id,
        reference_name: requestFor.title,
        description: requestText.trim(),
      });
      toast.success("Change request sent to your admin");
      setRequestFor(null);
      setRequestText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send request");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return <div className="px-4 py-6 text-[11px] text-gray-400 italic">Couldn't load the clause library.</div>;
  }
  if (clauses === null) {
    return <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>;
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clauses.filter(c => c.title.toLowerCase().includes(q) || c.content.toLowerCase().includes(q))
    : clauses;

  return (
    <div className="p-3 space-y-2.5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search approved / fallback language…"
          className="w-full rounded-md border pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {clauses.length === 0 ? (
        <p className="px-1 py-4 text-[11px] text-gray-400 italic">Your firm&apos;s clause library is empty. An admin can add approved and fallback language.</p>
      ) : filtered.length === 0 ? (
        <p className="px-1 py-4 text-[11px] text-gray-400 italic">No clauses match &ldquo;{search}&rdquo;.</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(c => {
            const isOpen = openId === c.id;
            return (
              <div key={c.id} className="rounded-lg border">
                <button
                  onClick={() => setOpenId(isOpen ? null : c.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold", CLAUSE_TYPE_CLS[c.clause_type])}>
                    {CLAUSE_TYPE_LABEL[c.clause_type] ?? c.clause_type}
                  </span>
                  <span className="text-xs font-medium text-gray-800 truncate flex-1">{c.title}</span>
                  {c.jurisdiction && <span className="text-[9px] text-gray-400 uppercase shrink-0">{c.jurisdiction}</span>}
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="border-t px-2.5 py-2 space-y-2">
                    <pre className="text-[11px] text-gray-700 font-sans whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">{c.content}</pre>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => copy(c)}>
                        {copiedId === c.id ? <><Check className="h-3 w-3 mr-1 text-emerald-600" />Copied</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 text-[11px] text-gray-500"
                        onClick={() => { setRequestFor(c); setRequestText(""); }}
                      >
                        <Send className="h-3 w-3 mr-1" />Request change
                      </Button>
                    </div>

                    {requestFor?.id === c.id && (
                      <div className="rounded-md border bg-gray-50 p-2 space-y-1.5">
                        <textarea
                          value={requestText}
                          onChange={e => setRequestText(e.target.value)}
                          placeholder="Describe the change you'd like an admin to make to this clause…"
                          rows={3}
                          className="w-full rounded border px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" className="h-6 text-[11px]" disabled={submitting || !requestText.trim()} onClick={sendRequest}>
                            {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}Send to admin
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setRequestFor(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[9px] text-gray-400 text-center pt-1">Firm library is admin-curated · request changes via ticket</p>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ReviewPanel({ analysis, activeId, onActiveChange, appliedIds, onApply, onApplyAll, onClose, onDownload, redlinePlaced, redlineTotal, onScrollToText, getToken }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [openClauseIdx, setOpenClauseIdx] = useState<number | null>(null);
  const [openMissingIdx, setOpenMissingIdx] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>({});
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});

  function handleDecision(id: string, d: ItemDecision) {
    setDecisions(prev => ({ ...prev, [id]: d }));
  }
  function handleEditedTextChange(id: string, text: string) {
    setEditedTexts(prev => ({ ...prev, [id]: text }));
  }

  const ambiguityFlags = (analysis.ambiguity_flags ?? []) as AmbiguityFlag[];
  const extractedClauses = (analysis.extracted_clauses ?? []) as ExtractedClause[];
  const missingClauses = (analysis.missing_clauses ?? []) as MissingClause[];
  const metadata = analysis.contract_metadata as ContractMetadata | undefined;

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
  const criticalMissing = missingClauses.filter(c => c.importance === "critical").length;
  const highRiskClauses = extractedClauses.filter(c => c.risk === "high" || c.risk === "critical").length;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "clauses", label: "Clauses", count: extractedClauses.length + analysis.clause_analysis.length },
    { key: "risks", label: "Risks", count: analysis.risk_summary.length },
    { key: "negotiate", label: "Negotiate", count: analysis.negotiation_points.length },
    { key: "library", label: "Library" },
  ];

  return (
    <div className="w-[380px] shrink-0 flex flex-col bg-white border-l shadow-[-2px_0_12px_rgba(0,0,0,0.08)]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 bg-[#0F2A2A] text-white">
        <ListChecks className="h-4 w-4 text-white/60 shrink-0" />
        <span className="text-sm font-semibold flex-1">AI Review</span>
        <RiskBadge level={analysis.risk_level} className="text-[9px] shrink-0" />
        <button onClick={onClose} className="ml-1 p-1 rounded hover:bg-white/10 transition-colors shrink-0" title="Collapse panel">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex border-b bg-gray-50">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 text-[10px] font-medium py-2 border-b-2 transition-colors",
              tab === t.key
                ? "border-blue-600 text-blue-700 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1 text-[9px] bg-gray-200 text-gray-500 rounded-full px-1 py-0.5 font-semibold">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-1.5 bg-gray-50 border-b flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-gray-500">
        <span>{analysis.clause_analysis.length} clause issue{analysis.clause_analysis.length === 1 ? "" : "s"}</span>
        {criticalMissing > 0 && <><span>·</span><span className="text-red-600 font-medium">{criticalMissing} missing (critical)</span></>}
        {highRiskClauses > 0 && <><span>·</span><span className="text-orange-600 font-medium">{highRiskClauses} high risk</span></>}
        {typeof redlinePlaced === "number" && (
          <><span>·</span>
          <span className={redlinePlaced > 0 ? "text-violet-600 font-medium" : "text-gray-400"}>
            {redlinePlaced}/{redlineTotal} redlined
          </span></>
        )}
        {Object.values(decisions).filter(d => d === "accepted").length > 0 && (
          <><span>·</span><span className="text-emerald-600 font-medium">{Object.values(decisions).filter(d => d === "accepted").length} accepted</span></>
        )}
        {Object.values(decisions).filter(d => d === "rejected").length > 0 && (
          <><span>·</span><span className="text-red-500 font-medium">{Object.values(decisions).filter(d => d === "rejected").length} rejected</span></>
        )}
        {Object.values(decisions).filter(d => d === "edited").length > 0 && (
          <><span>·</span><span className="text-blue-600 font-medium">{Object.values(decisions).filter(d => d === "edited").length} edited</span></>
        )}
      </div>

      {/* ── Scrollable content ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* ════════ OVERVIEW TAB ════════ */}
        {tab === "overview" && (
          <>
            {/* Metadata */}
            {metadata && <MetadataSection metadata={metadata} />}

            {/* Missing Clauses (critical ones only in overview) */}
            {missingClauses.length > 0 && (
              <>
                <SectionLabel icon={<AlertCircle className="h-3 w-3" />} title="Missing Clauses" count={missingClauses.length} />
                {missingClauses.map((clause, i) => (
                  <MissingClauseItem
                    key={`m-${i}`}
                    clause={clause}
                    isOpen={openMissingIdx === i}
                    onToggle={() => setOpenMissingIdx(openMissingIdx === i ? null : i)}
                  />
                ))}
              </>
            )}

            {/* Risk Areas */}
            {analysis.risk_summary.length > 0 && (
              <>
                <SectionLabel icon={<ShieldAlert className="h-3 w-3" />} title="Risk Summary" count={analysis.risk_summary.length} />
                {analysis.risk_summary.map((item, i) => (
                  <AccordionItem
                    key={`r-${i}`} id={`r-${i}`}
                    title={item.area} body={item.risk} recommendation={item.recommendation} risk={item.severity}
                    clauseRef={(item as any).clauseRef}
                    isOpen={activeId === `r-${i}`} isApplied={appliedIds.has(`r-${i}`)}
                    onToggle={handleToggle} onApply={onApply}
                    decision={decisions[`r-${i}`]} onDecision={handleDecision}
                    editedText={editedTexts[`r-${i}`]} onEditedTextChange={handleEditedTextChange}
                  />
                ))}
              </>
            )}

            {/* Ambiguity Flags */}
            {ambiguityFlags.length > 0 && (
              <>
                <SectionLabel icon={<HelpCircle className="h-3 w-3" />} title="Ambiguity Flags" count={ambiguityFlags.length} />
                {ambiguityFlags.map((item, i) => (
                  <AccordionItem
                    key={`a-${i}`} id={`a-${i}`}
                    title={`"${item.term}" — ${item.location}`} body={item.issue} recommendation={item.suggestion} risk="medium"
                    isOpen={activeId === `a-${i}`} isApplied={appliedIds.has(`a-${i}`)}
                    onToggle={handleToggle} onApply={onApply}
                    decision={decisions[`a-${i}`]} onDecision={handleDecision}
                    editedText={editedTexts[`a-${i}`]} onEditedTextChange={handleEditedTextChange}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* ════════ CLAUSES TAB ════════ */}
        {tab === "clauses" && (
          <>
            {extractedClauses.length > 0 && (
              <>
                <SectionLabel icon={<FileText className="h-3 w-3" />} title="Extracted Clauses" count={extractedClauses.length} />
                {extractedClauses.map((clause, i) => (
                  <ExtractedClauseItem
                    key={`ec-${i}`}
                    clause={clause}
                    isOpen={openClauseIdx === i}
                    onToggle={() => setOpenClauseIdx(openClauseIdx === i ? null : i)}
                    onScrollToText={onScrollToText}
                  />
                ))}
              </>
            )}

            {/* Clause-level issues (the AI's clause findings) */}
            <SectionLabel icon={<FileWarning className="h-3 w-3" />} title="Clause Issues" count={analysis.clause_analysis.length} />
            {analysis.clause_analysis.length > 0 ? analysis.clause_analysis.map((item, i) => (
              <AccordionItem
                key={`c-${i}`} id={`c-${i}`}
                title={item.clause} body={item.finding} recommendation={item.recommendation} risk={item.risk}
                contractText={item.contractText}
                suggestedLanguage={(item as any).suggestedLanguage}
                isOpen={activeId === `c-${i}`} isApplied={appliedIds.has(`c-${i}`)}
                onToggle={handleToggle} onApply={onApply} onScrollToText={onScrollToText}
                decision={decisions[`c-${i}`]} onDecision={handleDecision}
                editedText={editedTexts[`c-${i}`]} onEditedTextChange={handleEditedTextChange}
              />
            )) : (
              <div className="px-4 py-3 text-[11px] text-gray-400 italic border-b">
                No clause-level issues flagged.
              </div>
            )}

            {missingClauses.length > 0 && (
              <>
                <SectionLabel icon={<AlertCircle className="h-3 w-3" />} title="Missing Clauses" count={missingClauses.length} />
                {missingClauses.map((clause, i) => (
                  <MissingClauseItem
                    key={`m-${i}`}
                    clause={clause}
                    isOpen={openMissingIdx === i}
                    onToggle={() => setOpenMissingIdx(openMissingIdx === i ? null : i)}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* ════════ RISKS TAB ════════ */}
        {tab === "risks" && (
          <>
            {analysis.risk_summary.length > 0 && (
              <>
                <SectionLabel icon={<ShieldAlert className="h-3 w-3" />} title="Risk Areas" count={analysis.risk_summary.length} />
                {analysis.risk_summary.map((item, i) => (
                  <AccordionItem
                    key={`r-${i}`} id={`r-${i}`}
                    title={item.area} body={item.risk} recommendation={item.recommendation} risk={item.severity}
                    clauseRef={(item as any).clauseRef}
                    isOpen={activeId === `r-${i}`} isApplied={appliedIds.has(`r-${i}`)}
                    onToggle={handleToggle} onApply={onApply}
                    decision={decisions[`r-${i}`]} onDecision={handleDecision}
                    editedText={editedTexts[`r-${i}`]} onEditedTextChange={handleEditedTextChange}
                  />
                ))}
              </>
            )}

            {ambiguityFlags.length > 0 && (
              <>
                <SectionLabel icon={<HelpCircle className="h-3 w-3" />} title="Ambiguity Flags" count={ambiguityFlags.length} />
                {ambiguityFlags.map((item, i) => (
                  <AccordionItem
                    key={`a-${i}`} id={`a-${i}`}
                    title={`"${item.term}" — ${item.location}`} body={item.issue} recommendation={item.suggestion} risk="medium"
                    isOpen={activeId === `a-${i}`} isApplied={appliedIds.has(`a-${i}`)}
                    onToggle={handleToggle} onApply={onApply}
                    decision={decisions[`a-${i}`]} onDecision={handleDecision}
                    editedText={editedTexts[`a-${i}`]} onEditedTextChange={handleEditedTextChange}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* ════════ NEGOTIATE TAB ════════ */}
        {tab === "negotiate" && (
          <>
            <SectionLabel icon={<Handshake className="h-3 w-3" />} title="Negotiation Points" count={analysis.negotiation_points.length} />
            {analysis.negotiation_points.length > 0 ? analysis.negotiation_points.map((item, i) => (
              <NegotiationItem
                key={`n-${i}`} id={`n-${i}`}
                title={item.point} preferred={item.preferredPosition} fallback={item.fallbackPosition}
                isOpen={activeId === `n-${i}`} isApplied={appliedIds.has(`n-${i}`)}
                onToggle={handleToggle} onApply={onApply}
              />
            )) : (
              <div className="px-4 py-3 text-[11px] text-gray-400 italic border-b">
                No negotiation points identified.
              </div>
            )}
          </>
        )}

        {/* ════════ LIBRARY TAB ════════ */}
        {tab === "library" && <ClauseLibraryTab getToken={getToken} />}

        <div className="h-4" />
      </div>

      {/* ── Footer actions ──────────────────────────────────────────────── */}
      <div className="shrink-0 p-3 border-t bg-white space-y-2">
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={onApplyAll} disabled={remaining === 0}>
          <Check className="h-3.5 w-3.5 mr-1.5" />
          {remaining === 0 ? "All Changes Applied" : `Apply All (${remaining} remaining)`}
        </Button>
        <Button size="sm" className="w-full h-8 text-xs" onClick={onDownload}>
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
