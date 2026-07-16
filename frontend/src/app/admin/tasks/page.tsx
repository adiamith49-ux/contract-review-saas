"use client";
import { useEffect, useState } from "react";
import { ClipboardList, Plus, Trash2, Loader2, CheckCircle2, Circle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  listAdminTasks, createAdminTask, deleteAdminTask, listAdminUsers,
  type AdminTask, type AdminUserRow,
} from "@/lib/admin-api";
import { cn, formatDate } from "@/lib/utils";

const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-emerald-50 text-emerald-600 border-emerald-200",
  medium: "bg-amber-50 text-amber-600 border-amber-200",
  high:   "bg-red-50 text-red-600 border-red-200",
};

const STATUS_TABS = ["all", "pending", "done"] as const;

export default function AdminTasksPage() {
  const [tasks, setTasks]     = useState<AdminTask[]>([]);
  const [users, setUsers]     = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<string>("all");

  // Assign dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userId, setUserId]         = useState("");
  const [title, setTitle]           = useState("");
  const [notes, setNotes]           = useState("");
  const [priority, setPriority]     = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate]       = useState("");
  const [saving, setSaving]         = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listAdminTasks(), listAdminUsers()])
      .then(([t, u]) => {
        setTasks(t.tasks);
        setUsers(u.users);
        if (u.users.length > 0) setUserId(u.users[0].clerk_user_id);
      })
      .catch((err: any) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  function openDialog() {
    setTitle("");
    setNotes("");
    setPriority("medium");
    setDueDate("");
    setDialogOpen(true);
  }

  async function handleAssign() {
    if (!title.trim() || !userId) return;
    setSaving(true);
    try {
      const { task, email_sent } = await createAdminTask({
        user_id: userId,
        title: title.trim(),
        notes: notes.trim() || undefined,
        priority,
        due_date: dueDate || null,
      });
      setTasks(prev => [task, ...prev]);
      setDialogOpen(false);
      if (email_sent) {
        toast.success(`Task assigned to ${task.user_email} — notification email sent.`);
      } else {
        toast.warning(`Task assigned to ${task.user_email}, but the notification email could not be sent.`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteAdminTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success("Task deleted");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = tasks.filter(t =>
    tab === "all" ? true : tab === "pending" ? !t.done : t.done
  );
  const counts = {
    pending: tasks.filter(t => !t.done).length,
    done: tasks.filter(t => t.done).length,
  };

  return (
    <div className="p-6 lg:p-8 max-w-[900px] mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">Assign work to users — they see it on their Tasks page and get an email.</p>
        </div>
        <Button size="sm" onClick={openDialog} disabled={loading || users.length === 0}>
          <Plus className="h-4 w-4 mr-1.5" />
          Assign Task
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
              tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t}
            {t !== "all" && counts[t as "pending" | "done"] ? ` (${counts[t as "pending" | "done"]})` : ""}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 border-b last:border-b-0 flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-5 w-24 rounded-full ml-auto" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <ClipboardList className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {tasks.length === 0 ? "No tasks yet" : "No tasks in this view"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {tasks.length === 0 ? "Assign a task to a user to get started." : "Try another filter."}
            </p>
          </div>
        ) : (
          filtered.map(t => {
            const isDeleting = deletingId === t.id;
            const overdue = t.due_date && !t.done && t.due_date < new Date().toISOString().split("T")[0];
            return (
              <div key={t.id} className="px-5 py-3.5 border-b last:border-b-0 flex items-start gap-3 group hover:bg-gray-50 transition-colors">
                {t.done
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  : <Circle className="h-5 w-5 text-gray-300 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium text-gray-900", t.done && "line-through text-gray-400")}>
                    {t.title}
                  </p>
                  {t.notes && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.notes}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[11px] text-gray-500 font-medium">{t.user_email}</span>
                    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize", PRIORITY_COLORS[t.priority])}>
                      {t.priority}
                    </span>
                    {t.due_date && (
                      <span className={cn("inline-flex items-center gap-1 text-[11px]", overdue ? "text-red-500 font-medium" : "text-gray-400")}>
                        <Calendar className="h-3 w-3" />
                        {formatDate(t.due_date)}{overdue && " · Overdue"}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-gray-300 shrink-0 mt-1">{formatDate(t.created_at)}</span>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={isDeleting}
                  aria-label="Delete task"
                  className="mt-0.5 shrink-0 text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Assign task dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => !open && !saving && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign a task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Assign to <span className="text-red-500">*</span></label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                disabled={saving}
              >
                {users.map(u => (
                  <option key={u.clerk_user_id} value={u.clerk_user_id}>{u.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Task <span className="text-red-500">*</span></label>
              <Input
                autoFocus
                placeholder="e.g. Review the Acme MSA renewal terms"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={saving}
                maxLength={500}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Priority</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={priority}
                  onChange={e => setPriority(e.target.value as "low" | "medium" | "high")}
                  disabled={saving}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Due date</label>
                <input
                  type="date"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Details <span className="text-gray-400 font-normal">(optional — included in the email)</span></label>
              <textarea
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder="Anything the user needs to know to complete this task…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={saving}
                maxLength={2000}
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <DialogClose asChild>
                <Button variant="outline" size="sm" disabled={saving}>Cancel</Button>
              </DialogClose>
              <Button size="sm" onClick={handleAssign} disabled={!title.trim() || !userId || saving} className="gap-1.5">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? "Assigning…" : "Assign task"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
