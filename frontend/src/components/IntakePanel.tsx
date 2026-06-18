"use client";
import { useEffect, useState } from "react";
import {
  ChevronDown, ChevronUp, Save, Loader2, ClipboardList,
  Building2, User, Calendar, DollarSign, Globe, Zap, StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getIntake, saveIntake, type LegalIntake } from "@/lib/api";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  contractId: string;
  getToken: () => Promise<string | null>;
  onSaved?: () => void;
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
        <span className="text-gray-400">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow";
const selectCls = `${inputCls} appearance-none cursor-pointer`;

const JURISDICTION_LABELS: Record<string, string> = {
  us: "United States",
  uk: "United Kingdom",
  eu: "European Union",
  other: "Other",
};

const URGENCY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const URGENCY_COLORS: Record<string, string> = {
  low: "text-emerald-700",
  medium: "text-amber-700",
  high: "text-orange-700",
  critical: "text-red-700",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function IntakePanel({ contractId, getToken, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState(false);

  const [form, setForm] = useState<LegalIntake>({
    counterparty_name: "",
    department: "",
    urgency: undefined,
    deal_value: undefined,
    jurisdiction: undefined,
    renewal_date: "",
    business_owner: "",
    notes: "",
  });

  // Load existing intake on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = await getToken();
        const { intake } = await getIntake(token, contractId);
        if (intake) {
          setForm({
            counterparty_name: intake.counterparty_name ?? "",
            department: intake.department ?? "",
            urgency: intake.urgency,
            deal_value: intake.deal_value,
            jurisdiction: intake.jurisdiction,
            renewal_date: intake.renewal_date ?? "",
            business_owner: intake.business_owner ?? "",
            notes: intake.notes ?? "",
          });
          setFilled(true);
          setOpen(true); // auto-open if intake exists
        }
      } catch {
        // no intake yet — fine
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [contractId]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof LegalIntake>(key: K, value: LegalIntake[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const token = await getToken();
      // Strip empty strings → undefined so backend doesn't store blanks
      const payload: LegalIntake = {
        counterparty_name: form.counterparty_name?.trim() || undefined,
        department: form.department?.trim() || undefined,
        urgency: form.urgency,
        deal_value: form.deal_value,
        jurisdiction: form.jurisdiction,
        renewal_date: form.renewal_date?.trim() || undefined,
        business_owner: form.business_owner?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };
      await saveIntake(token, contractId, payload);
      setFilled(true);
      toast.success("Legal intake saved — AI will use this context on next analysis");
      onSaved?.();
    } catch {
      toast.error("Failed to save intake");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shrink-0 border-b bg-white">
      {/* ── Toggle header ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
      >
        <ClipboardList className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-xs font-semibold text-gray-700 flex-1">Legal Intake</span>
        {loading && <Loader2 className="h-3 w-3 text-gray-400 animate-spin" />}
        {filled && !loading && (
          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            Filled
          </span>
        )}
        {!filled && !loading && (
          <span className="text-[10px] text-gray-400">
            Provide deal context to improve AI analysis
          </span>
        )}
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
      </button>

      {/* ── Form body ──────────────────────────────────────────────────── */}
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {/* Counterparty */}
            <Field label="Counterparty" icon={<Building2 className="h-3 w-3" />}>
              <input
                className={inputCls}
                placeholder="Acme Corp"
                value={form.counterparty_name ?? ""}
                onChange={e => set("counterparty_name", e.target.value)}
              />
            </Field>

            {/* Department */}
            <Field label="Department" icon={<User className="h-3 w-3" />}>
              <input
                className={inputCls}
                placeholder="Legal / Procurement"
                value={form.department ?? ""}
                onChange={e => set("department", e.target.value)}
              />
            </Field>

            {/* Business Owner */}
            <Field label="Business Owner" icon={<User className="h-3 w-3" />}>
              <input
                className={inputCls}
                placeholder="John Smith"
                value={form.business_owner ?? ""}
                onChange={e => set("business_owner", e.target.value)}
              />
            </Field>

            {/* Jurisdiction */}
            <Field label="Jurisdiction" icon={<Globe className="h-3 w-3" />}>
              <select
                className={selectCls}
                value={form.jurisdiction ?? ""}
                onChange={e => set("jurisdiction", (e.target.value || undefined) as LegalIntake["jurisdiction"])}
              >
                <option value="">Select…</option>
                {Object.entries(JURISDICTION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>

            {/* Deal Value */}
            <Field label="Deal Value (USD)" icon={<DollarSign className="h-3 w-3" />}>
              <input
                className={inputCls}
                type="number"
                placeholder="500000"
                value={form.deal_value ?? ""}
                onChange={e => set("deal_value", e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>

            {/* Urgency */}
            <Field label="Urgency" icon={<Zap className="h-3 w-3" />}>
              <select
                className={cn(selectCls, form.urgency ? URGENCY_COLORS[form.urgency] : "")}
                value={form.urgency ?? ""}
                onChange={e => set("urgency", (e.target.value || undefined) as LegalIntake["urgency"])}
              >
                <option value="">Select…</option>
                {Object.entries(URGENCY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>

            {/* Renewal / Expiry Date */}
            <Field label="Renewal / Expiry" icon={<Calendar className="h-3 w-3" />}>
              <input
                className={inputCls}
                type="date"
                value={form.renewal_date ?? ""}
                onChange={e => set("renewal_date", e.target.value)}
              />
            </Field>
          </div>

          {/* Notes — full width */}
          <Field label="Notes" icon={<StickyNote className="h-3 w-3" />}>
            <textarea
              className={cn(inputCls, "resize-none h-16")}
              placeholder="Key deal points, negotiation priorities, or anything the AI should know…"
              value={form.notes ?? ""}
              onChange={e => set("notes", e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between pt-0.5">
            <p className="text-[10px] text-gray-400">
              Saved context is injected into every AI analysis for this contract.
            </p>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleSave} disabled={saving}>
              {saving
                ? <><Loader2 className="h-3 w-3 animate-spin" />Saving…</>
                : <><Save className="h-3 w-3" />Save Intake</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
