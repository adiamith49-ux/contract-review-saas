"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Search, Library, Globe, Tag, MessageSquarePlus, Lock, ChevronDown, ChevronUp, Copy, Check, FileText, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { listClauses, type Clause } from "@/lib/api";
import { submitTicket } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

const TYPE_COLORS = {
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fallback:  "bg-amber-50  text-amber-700  border-amber-200",
  unacceptable: "bg-red-50 text-red-700 border-red-200",
};

const TYPE_LABELS = { approved: "Preferred", fallback: "Fallback", unacceptable: "Walk-away" };

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  nda: "NDA", msa: "MSA", saas: "SaaS", sow: "SOW", order_form: "Order Form",
  employment: "Employment", vendor_agreement: "Vendor", other: "Other",
};

export default function ClausesPage() {
  const { getToken } = useAuth();
  const [clauses, setClauses]   = useState<Clause[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterType, setFilterType] = useState<"all" | Clause["clause_type"]>("all");
  const [filterContractType, setFilterContractType] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Ticket dialog
  const [ticketTarget, setTicketTarget] = useState<Clause | null>(null);
  const [ticketDesc, setTicketDesc]     = useState("");
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    getToken().then(t => listClauses(t))
      .then(({ clauses }) => setClauses(clauses))
      .catch(() => toast.error("Failed to load clauses"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmitTicket() {
    if (!ticketTarget || !ticketDesc.trim()) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      await submitTicket(token, {
        type: "clause_change",
        reference_id: ticketTarget.id,
        reference_name: ticketTarget.title,
        description: ticketDesc.trim(),
      });
      toast.success("Request submitted — admin will review it");
      setTicketTarget(null);
      setTicketDesc("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy(c: Clause) {
    try {
      await navigator.clipboard.writeText(c.content);
      setCopiedId(c.id);
      toast.success("Clause copied — paste it into the redline or a suggestion edit");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  const filtered = clauses.filter(c => {
    const matchSearch = !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || c.clause_type === filterType;
    const matchContractType = filterContractType === "all" || (c.contract_types ?? []).includes(filterContractType);
    return matchSearch && matchType && matchContractType;
  });

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Clause Library</h1>
            <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              <Lock className="h-2.5 w-2.5" /> Admin-managed
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${clauses.length} clause${clauses.length !== 1 ? "s" : ""}`} — to request a change, use the Request Change button on any clause
          </p>
        </div>
      </div>

      {/* Roadmap note — auto-extraction from historical agreements (planned) */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-2.5">
        <GitBranch className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          <span className="font-semibold">Coming soon — automatic clause extraction.</span> A future release will mine your executed contracts to auto-suggest preferred, fallback and walk-away language, so institutional knowledge is captured without manual entry. Today, clauses are curated by your admin.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search clauses…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={filterType} onValueChange={v => setFilterType(v as typeof filterType)}>
          <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            <SelectItem value="approved">Preferred</SelectItem>
            <SelectItem value="fallback">Fallback</SelectItem>
            <SelectItem value="unacceptable">Walk-away</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterContractType} onValueChange={setFilterContractType}>
          <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
            <SelectValue placeholder="Contract type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contract Types</SelectItem>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clauses */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Library className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600">{search || filterType !== "all" ? "No clauses match your search" : "No clauses yet"}</p>
          <p className="text-xs text-gray-400 mt-1">Contact your admin to add clauses to the library.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm divide-y overflow-hidden">
          {filtered.map(c => (
            <div key={c.id}>
              <div className="px-5 py-4 flex items-center gap-3 group">
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", TYPE_COLORS[c.clause_type])}>
                      {TYPE_LABELS[c.clause_type]}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900">{c.title}</h3>
                  </div>
                  {expanded !== c.id && (
                    <p className="text-xs text-gray-500 line-clamp-1">{c.content}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {c.jurisdiction && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Globe className="h-3 w-3" /> {c.jurisdiction}
                      </span>
                    )}
                    {(c.contract_types ?? []).length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <FileText className="h-3 w-3 text-gray-300" />
                        {c.contract_types.map(ct => (
                          <span key={ct} className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{CONTRACT_TYPE_LABELS[ct] ?? ct}</span>
                        ))}
                      </div>
                    )}
                    {c.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <Tag className="h-3 w-3 text-gray-300" />
                        {c.tags.map(tag => (
                          <span key={tag} className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                    {c.source && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <GitBranch className="h-3 w-3" /> {c.source} · v{c.version ?? 1}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-300 ml-auto">{formatDate(c.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleCopy(c)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    title="Copy clause text to paste into a redline or suggestion"
                  >
                    {copiedId === c.id ? <><Check className="h-3.5 w-3.5 text-emerald-600" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
                  </button>
                  <button
                    onClick={() => { setTicketTarget(c); setTicketDesc(""); }}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary px-2.5 py-1.5 rounded-lg border border-primary/25 hover:bg-primary/5 transition-colors"
                    title="Request a change to this clause"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    Request change
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    {expanded === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {expanded === c.id && (
                <div className="px-5 pb-4 border-t bg-gray-50/60">
                  <pre className="text-xs text-gray-700 font-mono leading-relaxed whitespace-pre-wrap mt-3">{c.content}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Request change dialog */}
      <Dialog open={!!ticketTarget} onOpenChange={open => !open && setTicketTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request clause change</DialogTitle>
          </DialogHeader>
          {ticketTarget && (
            <div className="space-y-4 mt-1">
              <div className="rounded-lg bg-gray-50 border px-3 py-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Clause</p>
                <p className="text-sm font-medium text-gray-900">{ticketTarget.title}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Describe the change you need *</label>
                <textarea
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  rows={4}
                  placeholder="What should be changed and why? Include any specific wording if you have it…"
                  value={ticketDesc}
                  onChange={e => setTicketDesc(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400">Your admin will review this request and update the clause library.</p>
              <div className="flex justify-end gap-3">
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Cancel</Button>
                </DialogClose>
                <Button size="sm" onClick={handleSubmitTicket} disabled={submitting || !ticketDesc.trim()}>
                  {submitting ? "Submitting…" : "Submit request"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
