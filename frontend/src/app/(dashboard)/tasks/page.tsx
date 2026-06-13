"use client";
import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  ClipboardList, Plus, Trash2, CheckCircle2,
  Circle, Calendar, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { listTasks, createTask, updateTask, deleteTask, type Task } from "@/lib/api";

type Priority = "low" | "medium" | "high";

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  low:    { label: "Low",    color: "text-emerald-600 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  medium: { label: "Medium", color: "text-amber-600   bg-amber-50   border-amber-200",   dot: "bg-amber-500"   },
  high:   { label: "High",   color: "text-red-600     bg-red-50     border-red-200",     dot: "bg-red-500"     },
};

export default function TasksPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "pending" | "done">("all");
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle]       = useState("");
  const [notes, setNotes]       = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate]   = useState("");
  const [saving, setSaving]     = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const token = await getToken();
      const { tasks } = await listTasks(token);
      setTasks(tasks);
    } catch {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function addTask() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const token = await getToken();
      const { task } = await createTask(token, {
        title: title.trim(),
        notes: notes.trim(),
        priority,
        due_date: dueDate || null,
      });
      setTasks(prev => [task, ...prev]);
      setTitle(""); setNotes(""); setPriority("medium"); setDueDate("");
      setShowForm(false);
    } catch {
      toast.error("Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(task: Task) {
    setTogglingId(task.id);
    try {
      const token = await getToken();
      const { task: updated } = await updateTask(token, task.id, { done: !task.done });
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch {
      toast.error("Failed to update task");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const token = await getToken();
      await deleteTask(token, id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = tasks.filter(t =>
    filter === "all" ? true : filter === "pending" ? !t.done : t.done
  );
  const pending = tasks.filter(t => !t.done).length;
  const done    = tasks.filter(t => t.done).length;
  const firstName = user?.firstName ?? "there";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                <ClipboardList className="h-5 w-5 text-violet-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
            </div>
            <p className="text-gray-500 text-sm ml-12">Keep track of your work, {firstName}.</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total",   value: tasks.length, color: "text-gray-900"    },
            { label: "Pending", value: pending,       color: "text-amber-600"   },
            { label: "Done",    value: done,          color: "text-emerald-600" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              {loading ? <Skeleton className="h-8 w-10 mx-auto" /> : <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>}
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Add task form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-primary/30 shadow-sm p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Add New Task</h2>
            <div className="space-y-3">
              <Input
                placeholder="Task title…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTask()}
                autoFocus
                className="font-medium"
                disabled={saving}
              />
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={saving}
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as Priority)}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Due date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={addTask} disabled={!title.trim() || saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add Task"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 bg-white rounded-lg border border-gray-100 p-1 w-fit">
          {(["all", "pending", "done"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
                filter === f ? "bg-primary text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 to-primary" />

          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No tasks here</p>
              <p className="text-xs text-gray-400 mt-1">Click "New Task" to get started</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {filtered.map(task => {
                const p = PRIORITY_CONFIG[task.priority];
                const overdue = task.due_date && !task.done && task.due_date < new Date().toISOString().split("T")[0];
                const isToggling = togglingId === task.id;
                const isDeleting = deletingId === task.id;
                return (
                  <li
                    key={task.id}
                    className={cn(
                      "flex items-start gap-3 px-5 py-4 group transition-colors",
                      task.done ? "bg-gray-50/50" : "hover:bg-gray-50/50"
                    )}
                  >
                    <button
                      onClick={() => toggleDone(task)}
                      disabled={isToggling}
                      className="mt-0.5 shrink-0 text-gray-300 hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {isToggling
                        ? <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
                        : task.done
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          : <Circle className="h-5 w-5" />
                      }
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium text-gray-900", task.done && "line-through text-gray-400")}>
                        {task.title}
                      </p>
                      {task.notes && <p className="text-xs text-gray-400 mt-0.5">{task.notes}</p>}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", p.color)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />
                          {p.label}
                        </span>
                        {task.due_date && (
                          <span className={cn("inline-flex items-center gap-1 text-[11px]", overdue ? "text-red-500 font-medium" : "text-gray-400")}>
                            <Calendar className="h-3 w-3" />
                            {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {overdue && " · Overdue"}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(task.id)}
                      disabled={isDeleting}
                      className="mt-0.5 shrink-0 text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {done > 0 && filter !== "pending" && (
          <p className="text-xs text-gray-400 text-center mt-4">
            {done} task{done !== 1 ? "s" : ""} completed · great work!
          </p>
        )}
      </div>
    </div>
  );
}
