"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  FileText, Plus, Trash2, Search, SlidersHorizontal, X, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/RiskBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { listContracts, deleteContract, type ContractListItem } from "@/lib/api";
import { formatDateShort, formatCurrency, getLifecycleBadge, CONTRACT_TYPE_LABELS, CONTRACT_BUSINESS_STATUS_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ContractType, RiskLevel } from "@/lib/types";

const ALL = "all";

const TYPE_OPTIONS = [
  { value: ALL, label: "All types" },
  ...Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const RISK_OPTIONS: { value: RiskLevel | "all"; label: string }[] = [
  { value: ALL,        label: "All risks"   },
  { value: "critical", label: "Critical"    },
  { value: "high",     label: "High"        },
  { value: "medium",   label: "Medium"      },
  { value: "low",      label: "Low"         },
];

const STATUS_OPTIONS = [
  { value: ALL,            label: "All statuses"  },
  { value: "active",       label: "Active"        },
  { value: "renewal_due",  label: "Renewal Due"   },
  { value: "expired",      label: "Expired"       },
  { value: "separator",    label: "—"             },
  { value: "draft",        label: "Draft"         },
  { value: "under_review", label: "Under Review"  },
  { value: "in_negotiation",   label: "In Negotiation"   },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "executed",     label: "Executed"      },
  { value: "on_hold",      label: "On Hold"       },
  { value: "terminated",   label: "Terminated"    },
];

function fileExt(filename: string): "pdf" | "docx" | "other" {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  return "other";
}

function matchesLifecycle(c: ContractListItem, filter: string): boolean {
  if (filter === ALL) return true;
  const badge = getLifecycleBadge(c);
  if (filter === "active")      return badge.type === "active";
  if (filter === "expired")     return badge.type === "expired";
  if (filter === "renewal_due") return badge.type === "renewal_due";
  // business status filters
  return c.contract_status === filter;
}

export default function ContractsPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [contracts, setContracts]       = useState<ContractListItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [typeFilter, setTypeFilter]     = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [riskFilter, setRiskFilter]     = useState(ALL);
  const [deleteTarget, setDeleteTarget] = useState<ContractListItem | null>(null);
  const [deleting, setDeleting]         = useState(false);

  async function load() {
    try {
      const token = await getToken();
      const { contracts } = await listContracts(token);
      setContracts(contracts);
    } catch {
      toast.error("Failed to load contracts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = contracts.filter(c => {
    const q = search.toLowerCase();
    const displayName = (c.title || c.filename).toLowerCase();
    const matchSearch = !q ||
      displayName.includes(q) ||
      (c.counterparty ?? "").toLowerCase().includes(q) ||
      (c.owner_name ?? "").toLowerCase().includes(q) ||
      CONTRACT_TYPE_LABELS[c.contract_type].toLowerCase().includes(q);
    const matchType   = typeFilter   === ALL || c.contract_type === typeFilter;
    const matchRisk   = riskFilter   === ALL || c.analyses?.[0]?.risk_level === riskFilter;
    const matchStatus = matchesLifecycle(c, statusFilter);
    return matchSearch && matchType && matchRisk && matchStatus;
  });

  const hasFilters = search || typeFilter !== ALL || statusFilter !== ALL || riskFilter !== ALL;

  function clearFilters() {
    setSearch(""); setTypeFilter(ALL); setStatusFilter(ALL); setRiskFilter(ALL);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = await getToken();
      await deleteContract(token, deleteTarget.id);
      toast.success("Contract deleted");
      setContracts(prev => prev.filter(c => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete contract");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Contract Repository</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading
              ? "Loading…"
              : `${contracts.length} contract${contracts.length !== 1 ? "s" : ""}${filtered.length !== contracts.length ? ` · ${filtered.length} shown` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/clients">
              <Building2 className="h-4 w-4 mr-1.5" />
              Clients
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/upload">
              <Plus className="h-4 w-4 mr-1.5" />
              New Contract Request
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search by title, counterparty, owner…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px] h-9 text-sm">
            <SelectValue placeholder="Contract type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o =>
              o.value === "separator" ? (
                <div key="sep" className="border-t my-1" />
              ) : (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue placeholder="Risk" />
          </SelectTrigger>
          <SelectContent>
            {RISK_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5 text-gray-500">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2.5fr)_130px_150px_110px_120px_100px_48px] border-b bg-gray-50/80 px-5 py-2.5">
          {["Contract", "Type", "Status", "Risk", "End Date", "Owner", ""].map((h, i) => (
            <div key={i} className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{h}</div>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2.5fr)_130px_150px_110px_120px_100px_48px] items-center px-5 py-4 border-b last:border-b-0">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              {Array.from({ length: 5 }).map((_, j) => <Skeleton key={j} className="h-5 w-20 rounded-md" />)}
              <div />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState hasFilters={!!hasFilters} onClear={clearFilters} />
        ) : (
          filtered.map(c => (
            <ContractRow
              key={c.id}
              contract={c}
              onNavigate={() => router.push(`/contracts/${c.id}`)}
              onDelete={() => setDeleteTarget(c)}
            />
          ))
        )}
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete contract?</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.title || deleteTarget?.filename}</strong> and all associated analysis will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={deleting}>Cancel</Button>
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function ContractRow({
  contract: c, onNavigate, onDelete,
}: {
  contract: ContractListItem;
  onNavigate: () => void;
  onDelete: () => void;
}) {
  const ext = fileExt(c.filename);
  const lifecycle = getLifecycleBadge(c);

  return (
    <div
      onClick={onNavigate}
      className="grid grid-cols-[minmax(0,2.5fr)_130px_150px_110px_120px_100px_48px] items-center px-5 py-3.5 border-b last:border-b-0 hover:bg-gray-50/60 transition-colors cursor-pointer group"
    >
      {/* Contract name + counterparty */}
      <div className="flex items-center gap-3 min-w-0 pr-4">
        <div className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0 uppercase",
          ext === "pdf"  ? "bg-red-100 text-red-600"  :
          ext === "docx" ? "bg-blue-100 text-blue-600" :
                           "bg-gray-100 text-gray-500",
        )}>
          {ext === "other" ? <FileText className="h-4 w-4" /> : ext.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
            {c.title || c.filename}
          </p>
          {c.counterparty ? (
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{c.counterparty}</p>
          ) : (
            <p className="text-[11px] text-gray-300 mt-0.5">{c.filename}</p>
          )}
        </div>
      </div>

      {/* Type */}
      <span className="text-xs text-gray-600 truncate pr-2">
        {CONTRACT_TYPE_LABELS[c.contract_type]}
      </span>

      {/* Lifecycle / Status */}
      <div>
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", lifecycle.className)}>
          {lifecycle.label}
        </span>
      </div>

      {/* Risk */}
      <div>
        {c.analyses?.[0]
          ? <RiskBadge level={c.analyses[0].risk_level} />
          : <span className="text-xs text-gray-300">—</span>}
      </div>

      {/* End date */}
      <span className="text-xs text-gray-500">
        {c.end_date ? formatDateShort(c.end_date) : <span className="text-gray-300">—</span>}
      </span>

      {/* Owner */}
      <span className="text-xs text-gray-500 truncate pr-2">
        {c.owner_name || <span className="text-gray-300">—</span>}
      </span>

      {/* Delete */}
      <div className="flex items-center justify-end">
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
          title="Delete contract"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center px-6">
        <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
          <SlidersHorizontal className="h-5 w-5 text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-700">No contracts match your filters</p>
        <p className="text-xs text-gray-400 mt-1">Try adjusting or clearing your search criteria.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>Clear filters</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
        <FileText className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-700">No contracts yet</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">
        Upload a PDF or DOCX to create a contract record with metadata, dates, and AI-powered risk analysis.
      </p>
      <Button asChild size="sm" className="mt-5">
        <Link href="/upload">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Upload your first contract
        </Link>
      </Button>
    </div>
  );
}
