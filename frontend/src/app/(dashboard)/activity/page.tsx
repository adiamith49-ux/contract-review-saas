"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Activity, Upload, Search, Download, MessageSquare,
  BookOpen, Gavel, Trash2, RefreshCw, ChevronLeft, ChevronRight,
  ClipboardList, FileText, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActivityLog, type ActivityEntry } from "@/lib/api";
import { formatDate } from "@/lib/utils";

// ─── Action metadata ──────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  "contract.uploaded":    { label: "Contract uploaded",       icon: Upload,        color: "text-blue-600 bg-blue-50" },
  "contract.analyzed":    { label: "AI analysis run",         icon: Search,        color: "text-violet-600 bg-violet-50" },
  "contract.summarized":  { label: "Summary generated",       icon: FileText,      color: "text-teal-600 bg-teal-50" },
  "contract.exported":    { label: "Contract exported",       icon: Download,      color: "text-emerald-600 bg-emerald-50" },
  "contract.redlined":    { label: "Redlines generated",      icon: RefreshCw,     color: "text-orange-600 bg-orange-50" },
  "contract.intake_saved":{ label: "Legal intake saved",      icon: ClipboardList, color: "text-indigo-600 bg-indigo-50" },
  "contract.deleted":     { label: "Contract deleted",        icon: Trash2,        color: "text-red-600 bg-red-50" },
  "chat.message":         { label: "AI chat message",         icon: MessageSquare, color: "text-sky-600 bg-sky-50" },
  "clause.created":       { label: "Clause created",          icon: BookOpen,      color: "text-emerald-600 bg-emerald-50" },
  "clause.updated":       { label: "Clause updated",          icon: BookOpen,      color: "text-amber-600 bg-amber-50" },
  "clause.deleted":       { label: "Clause deleted",          icon: BookOpen,      color: "text-red-600 bg-red-50" },
  "rule.created":         { label: "Playbook rule created",   icon: Gavel,         color: "text-emerald-600 bg-emerald-50" },
  "rule.updated":         { label: "Playbook rule updated",   icon: Gavel,         color: "text-amber-600 bg-amber-50" },
  "rule.deleted":         { label: "Playbook rule deleted",   icon: Gavel,         color: "text-red-600 bg-red-50" },
};

function actionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, icon: Activity, color: "text-gray-600 bg-gray-100" };
}

function metaDetail(entry: ActivityEntry): string {
  const m = entry.metadata;
  if (!m) return "";
  if (entry.action === "contract.analyzed" && m.risk_level) return `Risk: ${String(m.risk_level).toUpperCase()}`;
  if (entry.action === "contract.exported" && m.format) return `Format: ${String(m.format).toUpperCase()}`;
  if (entry.action === "contract.redlined") {
    if (m.matched_count !== undefined) return `${m.matched_count} placed · ${m.unmatched_count ?? 0} unplaced`;
  }
  return "";
}

const PAGE_SIZE = 25;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(p: number) {
    setLoading(true);
    try {
      const token = await getToken();
      const { activity, total } = await getActivityLog(token, PAGE_SIZE, p * PAGE_SIZE);
      setEntries(activity);
      setTotal(total);
    } catch {
      toast.error("Failed to load activity log");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 bg-white border-b flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Activity Log
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Full audit trail of all actions in your account</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(page)} className="gap-1.5 text-xs">
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[2rem_1fr_1fr_8rem] gap-4 px-4 py-2.5 border-b bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            <div />
            <div>Action</div>
            <div>Contract</div>
            <div className="text-right">When</div>
          </div>

          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[2rem_1fr_1fr_8rem] gap-4 px-4 py-3 items-center">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Activity className="h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">No activity yet</p>
              <p className="text-xs text-gray-400 mt-1">Actions like uploading and analyzing contracts will appear here</p>
            </div>
          ) : (
            <div className="divide-y">
              {entries.map(entry => {
                const { label, icon: Icon, color } = actionMeta(entry.action);
                const detail = metaDetail(entry);
                const hasContract = !!entry.contract_id;

                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[2rem_1fr_1fr_8rem] gap-4 px-4 py-3 items-center hover:bg-gray-50 transition-colors"
                  >
                    {/* Icon */}
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Action */}
                    <div>
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      {detail && <p className="text-xs text-gray-400">{detail}</p>}
                    </div>

                    {/* Contract link */}
                    <div>
                      {hasContract ? (
                        <button
                          onClick={() => router.push(`/contracts/${entry.contract_id}`)}
                          className="text-xs text-primary hover:underline truncate max-w-[200px] block text-left"
                        >
                          View contract →
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-xs text-gray-400 text-right whitespace-nowrap">
                      {formatDate(entry.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-400">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                disabled={page === 0 || loading}
                onClick={() => setPage(p => p - 1)}
                className="gap-1 text-xs"
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </Button>
              <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
              <Button
                variant="outline" size="sm"
                disabled={page >= totalPages - 1 || loading}
                onClick={() => setPage(p => p + 1)}
                className="gap-1 text-xs"
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
