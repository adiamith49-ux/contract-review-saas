"use client";
import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Clock, ChevronLeft, ChevronRight, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  listTimeEntries, createTimeEntry, deleteTimeEntry, type TimeEntry,
} from "@/lib/api";

const SUBJECTS   = ["Contract Review", "Document Analysis", "Legal Research", "Client Meeting", "Negotiation Prep", "Drafting / Redlining", "Other"];
const CATEGORIES = ["Billable Work", "Admin", "Internal", "Training", "Other"];

function parseDuration(s: string): number {
  const [h = "0", m = "0"] = s.split(":");
  return parseInt(h) * 60 + parseInt(m);
}

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m > 0 ? m + "m" : ""}`.trim();
}

// ─── Mini calendar ────────────────────────────────────────────────────────────

function MiniCalendar({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const today = new Date();
  const [viewing, setViewing] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const { year, month } = viewing;
  const firstDay     = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const todayStr     = today.toISOString().split("T")[0];

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <button onClick={() => setViewing(v => {
          const d = new Date(v.year, v.month - 1);
          return { year: d.getFullYear(), month: d.getMonth() };
        })} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-gray-900">{MONTHS[month]} {year}</span>
        <button onClick={() => setViewing(v => {
          const d = new Date(v.year, v.month + 1);
          return { year: d.getFullYear(), month: d.getMonth() };
        })} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 px-2 pt-2">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 px-2 pb-3 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const ds = dateStr(day);
          const isToday    = ds === todayStr;
          const isSelected = ds === selected;
          return (
            <button
              key={ds}
              onClick={() => onSelect(ds)}
              className={cn(
                "h-8 w-8 mx-auto rounded-full text-sm transition-colors flex items-center justify-center",
                isSelected ? "bg-primary text-white font-semibold"
                  : isToday ? "bg-primary/10 text-primary font-semibold"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="border-t border-gray-50 px-4 py-2">
        <button
          onClick={() => {
            setViewing({ year: today.getFullYear(), month: today.getMonth() });
            onSelect(todayStr);
          }}
          className="text-xs text-primary hover:underline font-medium"
        >
          Today
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimePage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const todayStr  = new Date().toISOString().split("T")[0];

  const [entries, setEntries]   = useState<TimeEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [date, setDate]         = useState(todayStr);
  const [subject, setSubject]   = useState(SUBJECTS[0]);
  const [contract, setContract] = useState("");
  const [duration, setDuration] = useState("");
  const [billable, setBillable] = useState(true);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDesc]  = useState("");
  const [saving, setSaving]     = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";

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

  async function addEntry() {
    if (!duration.trim()) return;
    const mins = parseDuration(duration);
    if (isNaN(mins) || mins <= 0) return;
    setSaving(true);
    try {
      const token = await getToken();
      const { entry } = await createTimeEntry(token, {
        subject, contract, date, duration,
        duration_mins: mins,
        billable, category,
        description: description.trim(),
      });
      setEntries(prev => [entry, ...prev]);
      setContract(""); setDuration(""); setDesc("");
      toast.success("Entry saved");
    } catch {
      toast.error("Failed to save entry");
    } finally {
      setSaving(false);
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

  const selectClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100">
          <Clock className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Time Entry</h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: calendar */}
        <div className="space-y-4">
          <MiniCalendar selected={date} onSelect={setDate} />
          <div className="flex items-center gap-4 px-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="h-3 w-3 rounded-full bg-teal-500 inline-block" />
              Billable
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="h-3 w-3 rounded-full bg-gray-300 inline-block" />
              Non-Billable
            </div>
          </div>
        </div>

        {/* Right: form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-50">
              <Clock className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-gray-900">Add Time Entry</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Subject</label>
                  <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectClass} disabled={saving}>
                    {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Related Contract</label>
                  <Input
                    placeholder="Contract name or reference…"
                    value={contract}
                    onChange={(e) => setContract(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={selectClass} disabled={saving} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                    Duration <span className="text-gray-400 font-normal">(H:MM)</span>
                  </label>
                  <Input
                    placeholder="e.g. 2:30"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">User</label>
                  <Input value={fullName} readOnly className="bg-gray-50 text-gray-600 cursor-default" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass} disabled={saving}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={billable}
                  onClick={() => setBillable(!billable)}
                  disabled={saving}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 disabled:opacity-50"
                  style={{ backgroundColor: billable ? "hsl(243 75% 59%)" : "#d1d5db" }}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    billable ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </button>
                <label className="text-sm text-gray-700 font-medium cursor-pointer" onClick={() => setBillable(!billable)}>
                  {billable ? "Billable" : "Non-Billable"}
                </label>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Description</label>
                <textarea
                  rows={3}
                  placeholder="Optional notes about this time entry…"
                  value={description}
                  onChange={(e) => setDesc(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  onClick={addEntry}
                  disabled={!duration.trim() || saving}
                  className="gap-2 bg-teal-600 hover:bg-teal-700"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {saving ? "Saving…" : "Save Entry"}
                </Button>
              </div>
            </div>
          </div>

          {/* Entries list */}
          {loading ? (
            <div className="mt-6 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : entries.length > 0 && (
            <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-900">All Entries</p>
                <p className="text-xs text-gray-400">{entries.length} entries</p>
              </div>
              <div className="divide-y divide-gray-50">
                {entries.map((e) => {
                  const isDeleting = deletingId === e.id;
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-gray-50 transition-colors">
                      <div className={cn("h-2 w-2 rounded-full shrink-0", e.billable ? "bg-teal-500" : "bg-gray-300")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{e.subject}</p>
                        {e.contract && <p className="text-xs text-gray-400 truncate">{e.contract}</p>}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <span className="text-sm font-semibold text-gray-700 shrink-0 w-14 text-right">
                        {fmtDuration(e.duration_mins)}
                      </span>
                      <button
                        onClick={() => handleDelete(e.id)}
                        disabled={isDeleting}
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
        </div>
      </div>
    </div>
  );
}
