"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Plus, Trash2, Loader2, UserCheck, ShieldAlert, DollarSign, Building2, Globe, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { cn, CONTRACT_TYPE_LABELS, formatCurrency } from "@/lib/utils";
import {
  listApprovalRules, createApprovalRule, updateApprovalRule, deleteApprovalRule,
  type ApprovalRule,
} from "@/lib/api";
import type { ContractType } from "@/lib/types";

const RISKS = ["low", "medium", "high", "critical"] as const;
const JURISDICTIONS = [
  { value: "us", label: "US" }, { value: "uk", label: "UK" },
  { value: "eu", label: "EU" }, { value: "india", label: "India" }, { value: "other", label: "Other" },
];
const RISK_CHIP: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700", medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700",
};

export default function ApprovalMatrixPage() {
  const { getToken } = useAuth();
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const { rules } = await listApprovalRules(token);
      setRules(rules);
    } catch {
      toast.error("Failed to load approval matrix");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const token = await getToken();
      await deleteApprovalRule(token, id);
      toast.success("Rule deleted");
      await load();
    } catch {
      toast.error("Failed to delete rule");
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggle(rule: ApprovalRule) {
    try {
      const token = await getToken();
      await updateApprovalRule(token, rule.id, { is_active: !rule.is_active });
      await load();
    } catch {
      toast.error("Failed to update rule");
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Approval Matrix
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Define who must approve a contract based on value, risk, department and jurisdiction.
            When a contract is submitted, matching rules build the approval chain in step order.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Add Rule
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50/60 py-16 text-center">
          <UserCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">No approval rules yet</p>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            Example: “Contracts over $100,000 need Finance sign-off” or “High-risk contracts route to the Legal Director”.
          </p>
          <Button size="sm" className="mt-5" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Create your first rule
          </Button>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {[...rules].sort((a, b) => a.step_order - b.step_order).map(rule => (
            <li key={rule.id} className={cn("rounded-xl border bg-white shadow-sm px-4 py-3.5", !rule.is_active && "opacity-50")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {rule.step_order}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{rule.name}</span>
                    {!rule.is_active && <span className="text-[10px] font-medium text-gray-400 uppercase">Inactive</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-7">
                    Approver: <span className="font-medium text-gray-700">{rule.approver_name}</span>
                    {rule.approver_email && <span className="text-gray-400"> · {rule.approver_email}</span>}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-2 ml-7">
                    {rule.min_value != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-medium">
                        <DollarSign className="h-2.5 w-2.5" />value ≥ {formatCurrency(Number(rule.min_value))}
                      </span>
                    )}
                    {rule.risk_levels.map(r => (
                      <span key={r} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", RISK_CHIP[r])}>
                        <ShieldAlert className="h-2.5 w-2.5" />{r} risk
                      </span>
                    ))}
                    {rule.departments.map(d => (
                      <span key={d} className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-medium">
                        <Building2 className="h-2.5 w-2.5" />{d}
                      </span>
                    ))}
                    {rule.jurisdictions.map(j => (
                      <span key={j} className="inline-flex items-center gap-1 rounded-full bg-teal-100 text-teal-700 px-2 py-0.5 text-[10px] font-medium">
                        <Globe className="h-2.5 w-2.5" />{j.toUpperCase()}
                      </span>
                    ))}
                    {rule.contract_types.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-medium">
                        <FileText className="h-2.5 w-2.5" />{CONTRACT_TYPE_LABELS[t as ContractType] ?? t}
                      </span>
                    ))}
                    {rule.min_value == null && rule.risk_levels.length === 0 && rule.departments.length === 0 && rule.jurisdictions.length === 0 && rule.contract_types.length === 0 && (
                      <span className="text-[10px] text-gray-400 italic">Applies to all contracts</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleToggle(rule)}>
                    {rule.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50" disabled={deleting === rule.id} onClick={() => handleDelete(rule.id)}>
                    {deleting === rule.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {dialogOpen && (
        <AddRuleDialog
          onClose={() => setDialogOpen(false)}
          onCreated={async () => { setDialogOpen(false); await load(); }}
          getToken={getToken}
          nextOrder={rules.length + 1}
        />
      )}
    </div>
  );
}

// ─── Add rule dialog ──────────────────────────────────────────────────────────

function AddRuleDialog({
  onClose, onCreated, getToken, nextOrder,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  getToken: () => Promise<string | null>;
  nextOrder: number;
}) {
  const [name, setName] = useState("");
  const [approverName, setApproverName] = useState("");
  const [approverEmail, setApproverEmail] = useState("");
  const [stepOrder, setStepOrder] = useState(String(nextOrder));
  const [minValue, setMinValue] = useState("");
  const [risks, setRisks] = useState<string[]>([]);
  const [departments, setDepartments] = useState("");
  const [jurisdictions, setJurisdictions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  }

  async function handleSave() {
    if (!name.trim() || !approverName.trim()) {
      toast.error("Rule name and approver name are required");
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      await createApprovalRule(token, {
        name: name.trim(),
        approver_name: approverName.trim(),
        approver_email: approverEmail.trim() || null,
        step_order: Number(stepOrder) || 1,
        min_value: minValue ? Number(minValue) : null,
        risk_levels: risks,
        departments: departments.split(",").map(d => d.trim()).filter(Boolean),
        jurisdictions,
        contract_types: [],
        is_active: true,
      });
      toast.success("Approval rule created");
      await onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />New Approval Rule
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Rule Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Finance sign-off over $100k" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Approver Name</Label>
            <Input value={approverName} onChange={e => setApproverName(e.target.value)} placeholder="e.g. Finance Director" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Approver Email</Label>
            <Input type="email" value={approverEmail} onChange={e => setApproverEmail(e.target.value)} placeholder="finance@firm.com" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Chain Position</Label>
            <Input type="number" min="1" value={stepOrder} onChange={e => setStepOrder(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Min Contract Value (USD)</Label>
            <Input type="number" min="0" value={minValue} onChange={e => setMinValue(e.target.value)} placeholder="e.g. 100000" className="h-9" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Trigger on Risk Level</Label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {RISKS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle(risks, setRisks, r)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                    risks.includes(r) ? RISK_CHIP[r] + " border-transparent" : "bg-white text-gray-500 hover:bg-gray-50",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Trigger on Jurisdiction</Label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {JURISDICTIONS.map(j => (
                <button
                  key={j.value}
                  type="button"
                  onClick={() => toggle(jurisdictions, setJurisdictions, j.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    jurisdictions.includes(j.value) ? "bg-teal-100 text-teal-700 border-transparent" : "bg-white text-gray-500 hover:bg-gray-50",
                  )}
                >
                  {j.label}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Trigger on Departments</Label>
            <Input value={departments} onChange={e => setDepartments(e.target.value)} placeholder="Comma-separated, e.g. Sales, Procurement" className="h-9" />
          </div>
          <p className="col-span-2 text-[11px] text-gray-400">
            Leave all triggers empty to make this approver required on every contract.
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : "Create Rule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
