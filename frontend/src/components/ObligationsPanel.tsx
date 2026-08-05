"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Plus, Trash2, CheckCircle2, Clock, AlertTriangle, Repeat, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  listObligations, createObligation, updateObligation, deleteObligation,
  type Obligation, type ObligationType, type ObligationRecurrence,
} from "@/lib/api";

interface Props {
  contractId: string;
  getToken: () => Promise<string | null>;
  embedded?: boolean;
}

const TYPE_LABELS: Record<ObligationType, string> = {
  milestone_payment: "Milestone payment",
  certificate_submission: "Certificate submission",
  board_update: "Board update",
  periodic_deliverable: "Periodic deliverable",
  other: "Other",
};

const RECURRENCE_LABELS: Record<ObligationRecurrence, string> = {
  none: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

const STATUS_STYLES: Record<Obligation["status"], { cls: string; icon: React.ReactNode; label: string }> = {
  pending:   { cls: "bg-blue-50 text-blue-700 border-blue-200",     icon: <Clock className="h-3 w-3" />,         label: "Pending" },
  overdue:   { cls: "bg-red-50 text-red-700 border-red-200",        icon: <AlertTriangle className="h-3 w-3" />, label: "Overdue" },
  completed: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" />, label: "Completed" },
};

const emptyForm = {
  type: "other" as ObligationType,
  title: "",
  description: "",
  due_date: "",
  recurrence: "none" as ObligationRecurrence,
  reminder_days_before: "7",
};

export function ObligationsPanel({ contractId, getToken, embedded }: Props) {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const { obligations: rows } = await listObligations(token, contractId);
      setObligations(rows);
    } catch {
      /* panel stays empty */
    } finally {
      setLoading(false);
    }
  }, [contractId, getToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(emptyForm); setShowCreate(true); }

  async function handleCreate() {
    if (!form.title.trim() || !form.due_date) { toast.error("Title and due date are required"); return; }
    setSaving(true);
    try {
      const token = await getToken();
      await createObligation(token, {
        contract_id: contractId,
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        due_date: form.due_date,
        recurrence: form.recurrence,
        reminder_days_before: Number(form.reminder_days_before) || 7,
      });
      toast.success("Obligation added");
      setShowCreate(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add obligation");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(ob: Obligation) {
    try {
      const token = await getToken();
      const { next_occurrence } = await updateObligation(token, ob.id, { status: "completed" });
      toast.success(next_occurrence ? "Marked complete — next occurrence created" : "Marked complete");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function handleDelete(ob: Obligation) {
    try {
      const token = await getToken();
      await deleteObligation(token, ob.id);
      setObligations(prev => prev.filter(o => o.id !== ob.id));
      toast.success("Obligation removed");
    } catch {
      toast.error("Failed to remove obligation");
    }
  }

  const pending = obligations.filter(o => o.status !== "completed");
  const completed = obligations.filter(o => o.status === "completed");

  return (
    <div className={cn(embedded ? "p-5" : "p-4 border rounded-xl bg-white")}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Obligations</p>
          <p className="text-xs text-gray-400 mt-0.5">Milestone payments, certificate submissions, board updates, deliverables</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : obligations.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center text-gray-400">
          <Clock className="h-8 w-8 mb-2 opacity-25" />
          <p className="text-xs font-medium">No obligations tracked yet for this contract</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="space-y-2">
              {pending.map(ob => {
                const s = STATUS_STYLES[ob.status];
                return (
                  <div key={ob.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{ob.title}</p>
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border", s.cls)}>
                          {s.icon} {s.label}
                        </span>
                        {ob.recurrence !== "none" && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                            <Repeat className="h-2.5 w-2.5" /> {RECURRENCE_LABELS[ob.recurrence]}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {TYPE_LABELS[ob.type]} · Due {new Date(ob.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      {ob.description && <p className="text-xs text-gray-500 mt-1">{ob.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleComplete(ob)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Mark complete"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(ob)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Completed</p>
              {completed.map(ob => (
                <div key={ob.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 opacity-70">
                  <p className="text-xs text-gray-500 line-through truncate">{ob.title}</p>
                  <button
                    onClick={() => handleDelete(ob)}
                    className="p-1 rounded-md text-gray-300 hover:text-red-600 transition-colors shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add obligation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as ObligationType }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPE_LABELS) as [ObligationType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Title *</Label>
              <Input
                placeholder="e.g. Q1 milestone payment"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Due date *</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Repeats</Label>
                <Select value={form.recurrence} onValueChange={v => setForm(f => ({ ...f, recurrence: v as ObligationRecurrence }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(RECURRENCE_LABELS) as [ObligationRecurrence, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Remind me (days before due)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={form.reminder_days_before}
                onChange={e => setForm(f => ({ ...f, reminder_days_before: e.target.value }))}
                className="max-w-[120px]"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Notes</Label>
              <textarea
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving}>
                {saving ? "Saving…" : "Add obligation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
