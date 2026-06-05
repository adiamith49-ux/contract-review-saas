"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Pencil, Trash2, ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { listRules, createRule, updateRule, deleteRule, type ReviewRule } from "@/lib/api";
import { MOCK_RULES } from "@/lib/mock-data";

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
import { RISK_LEVEL_LABELS, RISK_COLORS, formatDate, cn } from "@/lib/utils";
import type { RiskLevel } from "@contralyn/shared";

const EMPTY_FORM = {
  name: "",
  description: "",
  severity: "medium" as RiskLevel,
  is_active: true,
};

export default function RulesPage() {
  const { getToken } = useAuth();
  const [rules, setRules] = useState<ReviewRule[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ReviewRule | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ReviewRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    if (DEMO) {
      setRules(MOCK_RULES);
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const { rules } = await listRules(token);
      setRules(rules);
    } catch {
      toast.error("Failed to load review rules");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(rule: ReviewRule) {
    setEditTarget(rule);
    setForm({
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        severity: form.severity,
        is_active: form.is_active,
      };

      if (DEMO) {
        if (editTarget) {
          const updated = { ...editTarget, ...payload };
          setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          toast.success("Rule updated (demo)");
        } else {
          const fakeRule: ReviewRule = { id: `rr-${Date.now()}`, user_id: "demo", created_at: new Date().toISOString(), ...payload };
          setRules((prev) => [fakeRule, ...prev]);
          toast.success("Rule added (demo)");
        }
        setDialogOpen(false);
        return;
      }

      const token = await getToken();
      if (editTarget) {
        const { rule } = await updateRule(token, editTarget.id, payload);
        setRules((prev) => prev.map((r) => (r.id === rule.id ? rule : r)));
        toast.success("Rule updated");
      } else {
        const { rule } = await createRule(token, payload);
        setRules((prev) => [rule, ...prev]);
        toast.success("Rule added");
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: ReviewRule) {
    setTogglingId(rule.id);
    try {
      if (DEMO) {
        setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r)));
        return;
      }
      const token = await getToken();
      const { rule: updated } = await updateRule(token, rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      toast.error("Failed to update rule");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (DEMO) {
        setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        toast.success("Rule deleted (demo)");
        setDeleteTarget(null);
        return;
      }
      const token = await getToken();
      await deleteRule(token, deleteTarget.id);
      setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success("Rule deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete rule");
    } finally {
      setDeleting(false);
    }
  }

  const activeCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Rules</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Playbook rules injected into every AI contract analysis.
          </p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Info banner */}
      {!loading && rules.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-primary/80">
            <span className="font-semibold">{activeCount} active {activeCount === 1 ? "rule" : "rules"}</span>
            {" "}will be applied to the next AI analysis. Toggle rules on or off without deleting them.
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              toggling={togglingId === rule.id}
              onToggle={() => handleToggle(rule)}
              onEdit={() => openEdit(rule)}
              onDelete={() => setDeleteTarget(rule)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Rule" : "Add Review Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Rule Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Mutual NDA Required"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What should this rule flag or enforce?"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="severity">Severity</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm((f) => ({ ...f, severity: v as RiskLevel }))}
                >
                  <SelectTrigger id="severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-md border px-3 h-9 text-sm transition-colors",
                    form.is_active
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-white text-gray-500"
                  )}
                >
                  <Toggle active={form.is_active} size="sm" />
                  {form.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Rule"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-1">
            Are you sure you want to delete{" "}
            <span className="font-medium text-gray-900">{deleteTarget?.name}</span>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Rule card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: ReviewRule;
  toggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className={cn("transition-opacity", !rule.is_active && "opacity-60")}>
      <CardContent className="p-5 flex flex-col h-full gap-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{rule.name}</h3>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 mt-0.5",
              RISK_COLORS[rule.severity as RiskLevel]
            )}
          >
            {RISK_LEVEL_LABELS[rule.severity as RiskLevel].replace(" Risk", "")}
          </span>
        </div>

        {/* Description */}
        {rule.description && (
          <p className="text-xs text-gray-500 line-clamp-3 flex-1">{rule.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              disabled={toggling}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              aria-label={rule.is_active ? "Deactivate rule" : "Activate rule"}
            >
              <Toggle active={rule.is_active} disabled={toggling} />
              <span className={rule.is_active ? "text-emerald-600" : "text-gray-400"}>
                {rule.is_active ? "Active" : "Inactive"}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onEdit}
              className="rounded p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Edit rule"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              aria-label="Delete rule"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 -mt-2">{formatDate(rule.created_at)}</p>
      </CardContent>
    </Card>
  );
}

// ─── Toggle pill ──────────────────────────────────────────────────────────────

function Toggle({
  active,
  disabled,
  size = "md",
}: {
  active: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const track = size === "sm" ? "h-4 w-7" : "h-5 w-9";
  const thumb = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const translate = size === "sm" ? "translate-x-3.5" : "translate-x-[18px]";
  return (
    <span
      className={cn(
        "relative inline-flex items-center rounded-full transition-colors shrink-0",
        track,
        active ? "bg-emerald-500" : "bg-gray-300",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow transition-transform translate-x-0.5",
          thumb,
          active && translate
        )}
      />
    </span>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <ShieldCheck className="h-10 w-10 text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-600">No review rules yet</p>
      <p className="text-xs text-gray-400 mt-1">
        Create rules to standardise your contract reviews and flag deviations
      </p>
      <Button size="sm" className="mt-4" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-1" />
        Add First Rule
      </Button>
    </div>
  );
}
