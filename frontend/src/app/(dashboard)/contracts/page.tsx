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
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { listContracts, deleteContract, type ContractListItem } from "@/lib/api";
import { formatDate, formatFileSize, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ContractType, RiskLevel, ContractStatus } from "@/lib/types";

const ALL = "all";

const STATUS_OPTIONS: { value: ContractStatus | "all"; label: string }[] = [
  { value: ALL,         label: "All statuses"  },
  { value: "analyzed",  label: "Analyzed"      },
  { value: "uploaded",  label: "Uploaded"      },
  { value: "processing",label: "Analyzing"     },
  { value: "failed",    label: "Failed"        },
];

const RISK_OPTIONS: { value: RiskLevel | "all"; label: string }[] = [
  { value: ALL,       label: "All risk levels" },
  { value: "critical",label: "Critical"        },
  { value: "high",    label: "High"            },
  { value: "medium",  label: "Medium"          },
  { value: "low",     label: "Low"             },
];

const TYPE_OPTIONS = [
  { value: ALL, label: "All types" },
  ...Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

function fileExt(filename: string): "pdf" | "docx" | "other" {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  return "other";
}

export default function ContractsPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [contracts, setContracts]     = useState<ContractListItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [riskFilter, setRiskFilter]   = useState(ALL);
  const [deleteTarget, setDeleteTarget] = useState<ContractListItem | null>(null);
  const [deleting, setDeleting]       = useState(false);

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
    const matchSearch = !q ||
      c.filename.toLowerCase().includes(q) ||
      CONTRACT_TYPE_LABELS[c.contract_type].toLowerCase().includes(q);
    const matchType   = typeFilter   === ALL || c.contract_type                     === typeFilter;
    const matchStatus = statusFilter === ALL || c.status                            === statusFilter;
    const matchRisk   = riskFilter   === ALL || c.analyses?.[0]?.risk_level         === riskFilter;
    return matchSearch && matchType && matchStatus && matchRisk;
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
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto space-y-5">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">All Contracts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${contracts.length} contract${contracts.length !== 1 ? "s" : ""}${filtered.length !== contracts.length ? ` · ${filtered.length} shown` : ""}`}
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
              Upload
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search by filename or type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Contract type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Risk filter */}
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Risk level" />
          </SelectTrigger>
          <SelectContent>
            {RISK_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5 text-gray-500">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[minmax(0,2fr)_160px_120px_120px_110px_56px] border-b bg-gray-50/80 px-5 py-2.5">
          {["Contract", "Type", "Risk", "Status", "Uploaded", ""].map((h, i) => (
            <div key={i} className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2fr)_160px_120px_120px_110px_56px] items-center px-5 py-4 border-b last:border-b-0">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
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

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete contract?</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.filename}</strong> and its analysis will be permanently deleted. This cannot be undone.
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

// ─── Contract row ─────────────────────────────────────────────────────────────

function ContractRow({
  contract: c, onNavigate, onDelete,
}: {
  contract: ContractListItem;
  onNavigate: () => void;
  onDelete: () => void;
}) {
  const ext = fileExt(c.filename);

  return (
    <div
      onClick={onNavigate}
      className="grid grid-cols-[minmax(0,2fr)_160px_120px_120px_110px_56px] items-center px-5 py-3.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer group"
    >
      {/* Contract name */}
      <div className="flex items-center gap-3 min-w-0 pr-4">
        <div className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0 uppercase",
          ext === "pdf"  ? "bg-red-100 text-red-600"  :
          ext === "docx" ? "bg-blue-100 text-blue-600" :
                           "bg-gray-100 text-gray-500",
        )}>
          {ext === "other" ? <FileText className="h-4 w-4" /> : ext.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
            {c.filename}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">{formatFileSize(c.file_size)}</p>
        </div>
      </div>

      {/* Type */}
      <span className="text-xs text-gray-600 truncate pr-2">
        {CONTRACT_TYPE_LABELS[c.contract_type]}
      </span>

      {/* Risk */}
      <div>
        {c.analyses?.[0]
          ? <RiskBadge level={c.analyses[0].risk_level} />
          : <span className="text-xs text-gray-300">—</span>}
      </div>

      {/* Status */}
      <div>
        <StatusBadge status={c.status} />
      </div>

      {/* Date */}
      <span className="text-xs text-gray-500">{formatDate(c.created_at)}</span>

      {/* Actions */}
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
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
          Clear filters
        </Button>
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
        Upload a PDF or DOCX to get AI-powered risk analysis, clause review, and negotiation guidance.
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
