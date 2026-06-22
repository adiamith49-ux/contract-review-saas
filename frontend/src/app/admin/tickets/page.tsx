"use client";
import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { listAdminTickets, updateAdminTicket, type AdminTicket } from "@/lib/admin-api";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  open:        "bg-red-100 text-red-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved:    "bg-emerald-100 text-emerald-700",
};

const TYPE_LABELS: Record<string, string> = {
  clause_change:   "Clause Change",
  playbook_change: "Playbook Change",
  other:           "Other",
};

const STATUS_TABS = ["all", "open", "in_progress", "resolved"] as const;

export default function AdminTicketsPage() {
  const [tickets, setTickets]   = useState<AdminTicket[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<string>("all");
  const [selected, setSelected] = useState<AdminTicket | null>(null);
  const [notes, setNotes]       = useState("");
  const [status, setStatus]     = useState("open");
  const [saving, setSaving]     = useState(false);

  async function load(st?: string) {
    setLoading(true);
    const s = st ?? tab;
    const { tickets } = await listAdminTickets(s === "all" ? undefined : s);
    setTickets(tickets);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openTicket(t: AdminTicket) {
    setSelected(t);
    setNotes(t.admin_notes ?? "");
    setStatus(t.status);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const { ticket } = await updateAdminTicket(selected.id, { status, admin_notes: notes });
      setTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t));
      setSelected(null);
      toast.success("Ticket updated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function switchTab(t: string) {
    setTab(t);
    load(t);
  }

  const counts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 lg:p-8 max-w-[900px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Change Requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">User requests to modify clauses or playbooks</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
              tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t.replace("_", " ")}
            {t !== "all" && counts[t] ? ` (${counts[t]})` : ""}
          </button>
        ))}
      </div>

      {/* Tickets list */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 border-b last:border-b-0 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full ml-auto" />
              </div>
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <Ticket className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No tickets</p>
            <p className="text-xs text-gray-400 mt-1">Change requests from users will appear here.</p>
          </div>
        ) : (
          tickets.map(t => (
            <div
              key={t.id}
              onClick={() => openTicket(t)}
              className="px-5 py-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {TYPE_LABELS[t.type] ?? t.type}
                    {t.reference_name && <span className="text-gray-500 font-normal"> — {t.reference_name}</span>}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{t.users?.email ?? t.user_id} · {formatDate(t.created_at)}</p>
                </div>
                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0", STATUS_COLORS[t.status])}>
                  {t.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">{t.description}</p>
              {t.admin_notes && (
                <p className="text-xs text-primary mt-1.5 italic">Admin: {t.admin_notes}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Ticket detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selected && (TYPE_LABELS[selected.type] ?? selected.type)}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 border p-3 space-y-1">
                <p className="text-xs text-gray-500 font-medium">From</p>
                <p className="text-sm text-gray-900">{selected.users?.email ?? selected.user_id}</p>
                {selected.reference_name && (
                  <>
                    <p className="text-xs text-gray-500 font-medium mt-2">Reference</p>
                    <p className="text-sm text-gray-900">{selected.reference_name}</p>
                  </>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">User's request</p>
                <div className="rounded-lg bg-gray-50 border p-3 text-sm text-gray-700 leading-relaxed">
                  {selected.description}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Status</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Admin notes (visible to user)</label>
                <textarea
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  rows={3}
                  placeholder="Explain what action was taken or why the request was declined…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <DialogClose asChild>
                  <Button variant="outline" size="sm" disabled={saving}>Cancel</Button>
                </DialogClose>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
