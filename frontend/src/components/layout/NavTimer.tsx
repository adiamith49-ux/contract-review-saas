"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Play, Square, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createTimeEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

// Survives page refresh / navigation — the timer keeps running from this timestamp
const START_KEY = "contralyne_timer_started_at";

function fmtElapsed(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
}

export function NavTimer() {
  const { getToken } = useAuth();

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Save dialog state
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [pendingSecs, setPendingSecs] = useState(0);
  const [name, setName]               = useState("");
  const [billable, setBillable]       = useState(true);
  const [description, setDescription] = useState("");
  const [saving, setSaving]           = useState(false);

  // Resume a timer that was running before a refresh
  useEffect(() => {
    const stored = localStorage.getItem(START_KEY);
    if (stored) {
      const t = parseInt(stored, 10);
      if (!isNaN(t) && t <= Date.now()) setStartedAt(t);
      else localStorage.removeItem(START_KEY);
    }
  }, []);

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsed = startedAt !== null ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  function start() {
    const t = Date.now();
    localStorage.setItem(START_KEY, String(t));
    setStartedAt(t);
    setNow(t);
  }

  function stop() {
    if (startedAt === null) return;
    const secs = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    localStorage.removeItem(START_KEY);
    setStartedAt(null);
    setPendingSecs(secs);
    setName("");
    setBillable(true);
    setDescription("");
    setDialogOpen(true);
  }

  const pendingMins = Math.max(1, Math.round(pendingSecs / 60));

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const h = Math.floor(pendingMins / 60);
      const m = pendingMins % 60;
      const token = await getToken();
      await createTimeEntry(token, {
        subject: name.trim(),
        contract: "",
        date: new Date().toISOString().slice(0, 10),
        duration: `${h}:${String(m).padStart(2, "0")}`,
        duration_mins: pendingMins,
        billable,
        category: billable ? "Billable Work" : "Internal",
        description: description.trim(),
      });
      setDialogOpen(false);
      toast.success("Time entry saved to your Time log");
    } catch {
      toast.error("Failed to save time entry — it was not recorded");
    } finally {
      setSaving(false);
    }
  }

  const running = startedAt !== null;

  return (
    <>
      {/* Timer chip */}
      <div
        className={cn(
          "hidden lg:flex items-center gap-1 rounded-md pl-1.5 pr-2.5 py-1 mr-1 transition-colors",
          running ? "bg-emerald-500/15 ring-1 ring-emerald-400/40" : "bg-white/10"
        )}
      >
        <button
          onClick={running ? stop : start}
          aria-label={running ? "Stop timer" : "Start timer"}
          title={running ? "Stop and save time entry" : "Start time tracking"}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded transition-colors",
            running
              ? "text-red-400 hover:text-red-300 hover:bg-white/10"
              : "text-emerald-400 hover:text-emerald-300 hover:bg-white/10"
          )}
        >
          {running ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
        </button>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums select-none",
            running ? "text-white" : "text-slate-400"
          )}
        >
          {running ? fmtElapsed(elapsed) : "00:00"}
        </span>
        {running && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />}
      </div>

      {/* Save dialog — shown when the user stops the timer */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && !saving && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-600" />
              Save time entry
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-teal-50 border border-teal-100 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-teal-800">Time recorded</span>
              <span className="text-lg font-bold text-teal-700 tabular-nums">
                {fmtElapsed(pendingSecs)} <span className="text-xs font-medium text-teal-600">(saved as {fmtMins(pendingMins)})</span>
              </span>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                What were you working on? <span className="text-red-500">*</span>
              </label>
              <Input
                autoFocus
                placeholder="e.g. Contract review — Acme MSA"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                maxLength={200}
              />
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
              <label className="text-sm text-gray-700 font-medium cursor-pointer" onClick={() => !saving && setBillable(!billable)}>
                {billable ? "Billable" : "Non-Billable"}
              </label>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                rows={3}
                placeholder="Notes about this work session…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Link href="/time" className="text-xs text-primary hover:underline" onClick={() => setDialogOpen(false)}>
                View Time log
              </Link>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" disabled={saving} onClick={() => setDialogOpen(false)}>
                  Discard
                </Button>
                <Button size="sm" onClick={save} disabled={!name.trim() || saving} className="gap-1.5 bg-teal-600 hover:bg-teal-700">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {saving ? "Saving…" : "Save entry"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
