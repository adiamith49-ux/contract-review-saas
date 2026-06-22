"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Gavel, MessageSquarePlus, Lock, ToggleRight, ToggleLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { listRules, submitTicket, type ReviewRule } from "@/lib/api";
import { formatDate, formatFileSize, cn } from "@/lib/utils";

export default function PlaybooksPage() {
  const { getToken } = useAuth();
  const [rules, setRules]         = useState<ReviewRule[]>([]);
  const [loading, setLoading]     = useState(true);
  const [ticketTarget, setTicketTarget] = useState<ReviewRule | null>(null);
  const [ticketDesc, setTicketDesc]     = useState("");
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    getToken().then(t => listRules(t))
      .then(({ rules }) => setRules(rules))
      .catch(() => toast.error("Failed to load playbooks"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmitTicket() {
    if (!ticketTarget || !ticketDesc.trim()) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      await submitTicket(token, {
        type: "playbook_change",
        reference_id: ticketTarget.id,
        reference_name: ticketTarget.name,
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

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Playbooks</h1>
          <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            <Lock className="h-2.5 w-2.5" /> Admin-managed
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? "Loading…" : `${rules.length} playbook${rules.length !== 1 ? "s" : ""}`} — injected into every AI contract review
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
            <Gavel className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No playbooks yet</p>
          <p className="text-xs text-gray-400 mt-1">Contact your admin to add playbooks to the library.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm divide-y overflow-hidden">
          {rules.map(r => (
            <div key={r.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors group">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                  {r.is_active
                    ? <span className="flex items-center gap-0.5 text-[11px] font-medium text-emerald-700"><ToggleRight className="h-3.5 w-3.5" /> Active</span>
                    : <span className="flex items-center gap-0.5 text-[11px] font-medium text-gray-400"><ToggleLeft  className="h-3.5 w-3.5" /> Inactive</span>}
                </div>
                {r.description && <p className="text-xs text-gray-500 line-clamp-1">{r.description}</p>}
                <div className="flex items-center gap-3 mt-1">
                  {r.original_filename && <span className="text-[11px] text-gray-400 truncate">{r.original_filename}</span>}
                  {r.file_size && <span className="text-[11px] text-gray-400">{formatFileSize(r.file_size)}</span>}
                  <span className="text-[11px] text-gray-300">{formatDate(r.created_at)}</span>
                </div>
              </div>
              <button
                onClick={() => { setTicketTarget(r); setTicketDesc(""); }}
                className="flex items-center gap-1.5 text-xs font-medium text-primary px-2.5 py-1.5 rounded-lg border border-primary/25 hover:bg-primary/5 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                title="Request a change to this playbook"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                Request change
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Request change dialog */}
      <Dialog open={!!ticketTarget} onOpenChange={open => !open && setTicketTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request playbook change</DialogTitle>
          </DialogHeader>
          {ticketTarget && (
            <div className="space-y-4 mt-1">
              <div className="rounded-lg bg-gray-50 border px-3 py-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Playbook</p>
                <p className="text-sm font-medium text-gray-900">{ticketTarget.name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Describe the change you need *</label>
                <textarea
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  rows={4}
                  placeholder="What should be changed and why? Be as specific as possible…"
                  value={ticketDesc}
                  onChange={e => setTicketDesc(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400">Your admin will review this request and update the playbook.</p>
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
