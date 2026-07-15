"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Clock, Play, Trash2, Loader2, CalendarDays, Timer, Tag, FileText } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { listTimeEntries, deleteTimeEntry, type TimeEntry } from "@/lib/api";

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m > 0 ? m + "m" : ""}`.trim();
}

export default function TimePage() {
  const { getToken } = useAuth();

  const [entries, setEntries]       = useState<TimeEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected]     = useState<TimeEntry | null>(null);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const token = await getToken();
      const { entries } = await listTimeEntries(token);
      setEntries(entries);
    } catch {
      toast.error("Failed to load time entries");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const token = await getToken();
      await deleteTimeEntry(token, id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {
      toast.error("Failed to delete entry");
    } finally {
      setDeletingId(null);
    }
  }

  const now   = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthEntries  = entries.filter((e) => e.date.startsWith(month));
  const totalMins     = monthEntries.reduce((s, e) => s + e.duration_mins, 0);
  const billableMins  = monthEntries.filter((e) => e.billable).reduce((s, e) => s + e.duration_mins, 0);

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="max-w-[900px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100">
            <Clock className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Time Log</h1>
            <p className="text-sm text-gray-500">{MONTHS[now.getMonth()]} {now.getFullYear()}</p>
          </div>
          <div className="ml-auto flex items-center gap-6">
            <div className="text-right">
              {loading ? <Skeleton className="h-7 w-20 ml-auto" /> : (
                <p className="text-lg font-bold text-gray-900">{fmtDuration(totalMins)}</p>
              )}
              <p className="text-xs text-gray-400">Total hours in {MONTHS[now.getMonth()]}</p>
            </div>
            <div className="text-right">
              {loading ? <Skeleton className="h-7 w-16 ml-auto" /> : (
                <p className="text-lg font-bold text-teal-600">{fmtDuration(billableMins)}</p>
              )}
              <p className="text-xs text-gray-400">Billable</p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 mt-0.5">
            <Play className="h-3 w-3 text-teal-600 fill-current" />
          </div>
          <p className="text-sm text-teal-900">
            Time is tracked with the <strong>timer in the top bar</strong> — press play when you start working
            and stop when you&apos;re done. Each session is saved here automatically.
          </p>
        </div>

        {/* Entries log */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center py-16 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No time entries yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Start the timer in the top bar when you begin working — your sessions will be logged here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-900">All Entries</p>
              <p className="text-xs text-gray-400">{entries.length} entries</p>
            </div>
            <div className="divide-y divide-gray-50">
              {entries.map((e) => {
                const isDeleting = deletingId === e.id;
                return (
                  <div
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className="flex items-center gap-3 px-5 py-3 group hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className={cn("h-2 w-2 rounded-full shrink-0", e.billable ? "bg-teal-500" : "bg-gray-300")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{e.subject}</p>
                      {(e.description || e.contract) && (
                        <p className="text-xs text-gray-400 truncate">{e.description || e.contract}</p>
                      )}
                    </div>
                    <span className={cn(
                      "text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0",
                      e.billable ? "bg-teal-50 text-teal-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {e.billable ? "Billable" : "Non-Billable"}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0 w-14 text-right">
                      {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-sm font-semibold text-gray-700 shrink-0 w-14 text-right">
                      {fmtDuration(e.duration_mins)}
                    </span>
                    <button
                      onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }}
                      disabled={isDeleting}
                      aria-label="Delete entry"
                      className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-500">Total hours in {MONTHS[now.getMonth()]}: <strong>{fmtDuration(totalMins)}</strong></p>
              <p className="text-xs text-gray-500">Billable: <strong className="text-teal-600">{fmtDuration(billableMins)}</strong></p>
            </div>
          </div>
        )}

        {/* Entry detail dialog */}
        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-8">
                <Clock className="h-4 w-4 text-teal-600 shrink-0" />
                <span className="truncate">{selected?.subject}</span>
              </DialogTitle>
            </DialogHeader>

            {selected && (
              <div className="space-y-4">
                {/* Duration hero */}
                <div className="rounded-lg bg-teal-50 border border-teal-100 px-4 py-4 text-center">
                  <p className="text-3xl font-bold text-teal-700 tabular-nums">{fmtDuration(selected.duration_mins)}</p>
                  <p className="text-xs text-teal-600 mt-1">
                    {selected.billable ? "Billable time" : "Non-billable time"}
                  </p>
                </div>

                {/* Details */}
                <div className="rounded-lg border divide-y">
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">Work date</p>
                      <p className="text-sm text-gray-900">
                        {new Date(selected.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <Timer className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">Logged at</p>
                      <p className="text-sm text-gray-900">
                        {new Date(selected.created_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <Tag className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">Category</p>
                      <p className="text-sm text-gray-900">{selected.category}</p>
                    </div>
                    <span className={cn(
                      "text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0",
                      selected.billable ? "bg-teal-50 text-teal-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {selected.billable ? "Billable" : "Non-Billable"}
                    </span>
                  </div>
                  {selected.contract && (
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-400">Related contract</p>
                        <p className="text-sm text-gray-900">{selected.contract}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selected.description && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1.5">Description</p>
                    <div className="rounded-lg bg-gray-50 border p-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selected.description}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deletingId === selected.id}
                    onClick={async () => { await handleDelete(selected.id); setSelected(null); }}
                    className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    {deletingId === selected.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                    Delete entry
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
