"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Search, MessageSquare, Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  listAdminContracts, getAdminContractHistory, downloadAdminReport,
  type AdminContract, type AdminContractHistory,
} from "@/lib/admin-api";
import {
  cn, formatDate, formatDateTime, formatFileSize,
  CONTRACT_TYPE_LABELS, RISK_COLORS, STATUS_COLORS, STATUS_LABELS,
} from "@/lib/utils";
import type { ContractType, RiskLevel, ContractStatus } from "@/lib/types";

const STATUS_TABS = ["all", "uploaded", "processing", "analyzed", "failed"] as const;

// Human-readable labels for audit-log actions; anything unknown is prettified
const ACTION_LABELS: Record<string, string> = {
  "contract.uploaded":   "Contract uploaded",
  "contract.analyzed":   "AI analysis completed",
  "contract.summarized": "Summary generated",
  "contract.exported":   "Report exported",
  "contract.renamed":    "Contract renamed",
  "contract.deleted":    "Contract deleted",
  "intake.saved":        "Legal intake saved",
  "chat.message":        "Chat question asked",
  "redline.generated":   "Redlines generated",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default function AdminContractsPage() {
  const [contracts, setContracts] = useState<AdminContract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<string>("all");
  const [search, setSearch]       = useState("");
  const [downloading, setDownloading] = useState(false);

  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [history, setHistory]         = useState<AdminContractHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    listAdminContracts()
      .then(({ contracts }) => setContracts(contracts))
      .catch((err: any) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  function openContract(id: string) {
    setSelectedId(id);
    setHistory(null);
    setHistoryLoading(true);
    getAdminContractHistory(id)
      .then(setHistory)
      .catch((err: any) => { toast.error(err.message); setSelectedId(null); })
      .finally(() => setHistoryLoading(false));
  }

  async function handleDownloadReport() {
    setDownloading(true);
    try {
      await downloadAdminReport("contracts");
      toast.success("Contracts report downloaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (!q) return true;
      return (
        c.filename.toLowerCase().includes(q) ||
        (c.client_name ?? "").toLowerCase().includes(q) ||
        c.user_email.toLowerCase().includes(q) ||
        c.contract_type.toLowerCase().includes(q)
      );
    });
  }, [contracts, tab, search]);

  const counts = contracts.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contracts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Every contract on the platform, across all users and clients.</p>
        </div>
        <Button size="sm" onClick={handleDownloadReport} disabled={downloading}>
          <Download className="h-4 w-4 mr-1.5" />
          {downloading ? "Preparing…" : "Download Report"}
        </Button>
      </div>

      {/* Search + status tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            className="pl-9 h-9 w-64"
            placeholder="Search contracts, clients, users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {t}
              {t !== "all" && counts[t] ? ` (${counts[t]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Contracts table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-20 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <FileText className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {contracts.length === 0 ? "No contracts yet" : "No contracts match"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {contracts.length === 0
                ? "Contracts uploaded by users will appear here."
                : "Try a different search or status filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/60 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">Contract</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Client</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">User</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">Risk</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openContract(c.id)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900 truncate max-w-[220px]">{c.filename}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{formatFileSize(c.file_size)}</p>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{c.client_name ?? "—"}</td>
                    <td className="px-4 py-3.5 text-gray-600 truncate max-w-[180px]">{c.user_email}</td>
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                      {CONTRACT_TYPE_LABELS[c.contract_type as ContractType] ?? c.contract_type}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        "text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap",
                        STATUS_COLORS[c.status as ContractStatus] ?? "bg-gray-100 text-gray-600 border-gray-200"
                      )}>
                        {STATUS_LABELS[c.status as ContractStatus] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {c.risk_level ? (
                        <span className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize whitespace-nowrap",
                          RISK_COLORS[c.risk_level as RiskLevel] ?? "bg-gray-100 text-gray-600 border-gray-200"
                        )}>
                          {c.risk_level}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contract history dialog */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8 truncate">
              {history?.contract.filename ?? "Contract details"}
            </DialogTitle>
          </DialogHeader>

          {historyLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : history && (
            <div className="space-y-4">
              {/* Meta */}
              <div className="rounded-lg bg-gray-50 border p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Client</p>
                  <p className="text-gray-900">{history.contract.client_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Uploaded by</p>
                  <p className="text-gray-900 truncate">{history.contract.user_email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Type</p>
                  <p className="text-gray-900">
                    {CONTRACT_TYPE_LABELS[history.contract.contract_type as ContractType] ?? history.contract.contract_type}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Size</p>
                  <p className="text-gray-900">{formatFileSize(history.contract.file_size)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Uploaded</p>
                  <p className="text-gray-900">{formatDateTime(history.contract.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Last activity</p>
                  <p className="text-gray-900">{formatDateTime(history.contract.updated_at)}</p>
                </div>
              </div>

              {/* Analysis + chat summary */}
              <div className="flex flex-wrap gap-2">
                {history.analysis ? (
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border capitalize",
                    RISK_COLORS[history.analysis.risk_level as RiskLevel] ?? "bg-gray-100 text-gray-600 border-gray-200"
                  )}>
                    <Bot className="h-3 w-3" />
                    {history.analysis.risk_level} risk · analyzed {formatDate(history.analysis.created_at)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-gray-100 text-gray-500 border-gray-200">
                    <Bot className="h-3 w-3" /> Not analyzed yet
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                  <MessageSquare className="h-3 w-3" /> {history.chat_count} chat message{history.chat_count === 1 ? "" : "s"}
                </span>
              </div>

              {history.contract.error_message && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  {history.contract.error_message}
                </div>
              )}

              {/* Activity timeline */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">History</p>
                {history.activity.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center border rounded-lg bg-gray-50">
                    No recorded activity for this contract.
                  </p>
                ) : (
                  <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                    {history.activity.map((a) => (
                      <div key={a.id} className="flex items-start gap-3 px-3.5 py-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800">{actionLabel(a.action)}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{formatDateTime(a.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
