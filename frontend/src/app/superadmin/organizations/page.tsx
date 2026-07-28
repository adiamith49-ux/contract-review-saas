"use client";
import { useEffect, useState } from "react";
import {
  Building2, Plus, Ban, RotateCcw, Trash2, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  listOrganizations, createOrganization,
  revokeOrganization, restoreOrganization, deleteOrganization, updateOrganizationCap,
  type SuperAdminOrganization,
} from "@/lib/superadmin-api";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<SuperAdminOrganization["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-red-100 text-red-700",
  deleted: "bg-gray-100 text-gray-500",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SuperAdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<SuperAdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailTarget, setDetailTarget] = useState<SuperAdminOrganization | null>(null);
  const [capValue, setCapValue] = useState("");
  const [savingCap, setSavingCap] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [form, setForm] = useState({ name: "", admin_email: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const { organizations } = await listOrganizations();
    setOrgs(organizations);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setForm({ name: "", admin_email: "" }); setShowCreate(true); }

  async function handleCreate() {
    setSaving(true);
    try {
      await createOrganization(form);
      setShowCreate(false);
      toast.success(`Organization created — invitation sent to ${form.admin_email}`);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openDetail(org: SuperAdminOrganization) {
    setDetailTarget(org);
    setCapValue(org.monthly_analysis_cap === null ? "" : String(org.monthly_analysis_cap));
  }

  // Keeps detailTarget's own displayed values in sync after any action below,
  // since the dialog stays open across suspend/restore/cap-save.
  function patchOrg(id: string, patch: Partial<SuperAdminOrganization>) {
    setOrgs(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
    setDetailTarget(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }

  async function handleRevoke(org: SuperAdminOrganization) {
    try {
      await revokeOrganization(org.id);
      patchOrg(org.id, { status: "suspended" });
      toast.success(`${org.name} suspended`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleRestore(org: SuperAdminOrganization) {
    try {
      await restoreOrganization(org.id);
      patchOrg(org.id, { status: "active" });
      toast.success(`${org.name} restored`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    if (!detailTarget) return;
    try {
      await deleteOrganization(detailTarget.id);
      patchOrg(detailTarget.id, { status: "deleted" });
      toast.success(`${detailTarget.name} permanently deleted`);
      setDeleteConfirm(false);
      setDetailTarget(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleSaveCap() {
    if (!detailTarget) return;
    const cap = capValue.trim() === "" ? null : Number(capValue);
    if (cap !== null && (!Number.isInteger(cap) || cap < 0)) {
      toast.error("Cap must be a whole number, 0 or more");
      return;
    }
    setSavingCap(true);
    try {
      await updateOrganizationCap(detailTarget.id, cap);
      patchOrg(detailTarget.id, { monthly_analysis_cap: cap });
      toast.success(cap === null ? "Set to unlimited" : `Capped at ${cap}/month`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingCap(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Organizations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${orgs.length} organization${orgs.length !== 1 ? "s" : ""} — click one for details`}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Invite organization
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2fr)_120px_140px_90px] border-b bg-gray-50/80 px-5 py-2.5">
          {["Organization", "Onboarding", "Analyzed / Cap (this month)", "Status"].map((h, i) => (
            <div key={i} className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{h}</div>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2fr)_120px_140px_90px] items-center px-5 py-4 border-b last:border-b-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <Building2 className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No organizations yet</p>
            <p className="text-xs text-gray-400 mt-1">Invite your first firm to get started.</p>
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Invite organization
            </Button>
          </div>
        ) : (
          orgs.map(o => (
            <button
              key={o.id}
              onClick={() => openDetail(o)}
              className="grid grid-cols-[minmax(0,2fr)_120px_140px_90px] items-center px-5 py-3.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors text-left w-full"
            >
              <div className="min-w-0 pr-4">
                <p className="text-sm font-medium text-gray-900 truncate">{o.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{o.clerk_org_id}</p>
              </div>
              <span className="text-xs text-gray-500 truncate capitalize">{o.onboarding_type.replace("_", "-")}</span>
              <span className="text-xs font-medium text-gray-700">
                {o.analyses_this_month} / {o.monthly_analysis_cap ?? "∞"}
              </span>
              <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full w-fit capitalize", STATUS_COLORS[o.status])}>
                {o.status}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Creates the organization and emails its admin a Clerk invitation. They sign in
              and land directly in their own admin panel — active immediately, no approval step.
            </p>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Firm name *</label>
              <Input
                placeholder="e.g. Nexus Legal LLP"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Admin email *</label>
              <Input
                type="email"
                placeholder="admin@firm.com"
                value={form.admin_email}
                onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={saving || !form.name.trim() || !form.admin_email.trim()}>
                {saving ? "Sending…" : "Create + send invite"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Org detail dialog — the single place for everything about one org */}
      <Dialog open={!!detailTarget} onOpenChange={open => !open && setDetailTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailTarget?.name}
              {detailTarget && (
                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[detailTarget.status])}>
                  {detailTarget.status}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailTarget && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border px-3 py-2.5">
                  <p className="text-gray-400 uppercase tracking-wide text-[10px]">Org ID</p>
                  <p className="font-medium text-gray-800 mt-0.5 truncate">{detailTarget.clerk_org_id}</p>
                </div>
                <div className="rounded-lg border px-3 py-2.5">
                  <p className="text-gray-400 uppercase tracking-wide text-[10px]">Onboarding</p>
                  <p className="font-medium text-gray-800 mt-0.5 capitalize">{detailTarget.onboarding_type.replace("_", "-")}</p>
                </div>
                <div className="rounded-lg border px-3 py-2.5">
                  <p className="text-gray-400 uppercase tracking-wide text-[10px] flex items-center gap-1"><Calendar className="h-3 w-3" /> Created</p>
                  <p className="font-medium text-gray-800 mt-0.5">{formatDate(detailTarget.created_at)}</p>
                </div>
                <div className="rounded-lg border px-3 py-2.5">
                  <p className="text-gray-400 uppercase tracking-wide text-[10px]">Analyzed this month</p>
                  <p className="font-medium text-gray-800 mt-0.5 tabular-nums">{detailTarget.analyses_this_month}</p>
                </div>
              </div>

              <div className="rounded-xl border p-4 space-y-2.5">
                <p className="text-sm font-semibold text-gray-800">Contracts analyzed every month (cap)</p>
                <p className="text-xs text-gray-500">
                  {detailTarget.analyses_this_month} analyzed so far this month
                  {detailTarget.monthly_analysis_cap !== null && ` of ${detailTarget.monthly_analysis_cap}`}.
                  Leave blank for unlimited.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Unlimited"
                    value={capValue}
                    onChange={e => setCapValue(e.target.value)}
                    className="max-w-[140px]"
                  />
                  <Button size="sm" variant="outline" onClick={handleSaveCap} disabled={savingCap}>
                    {savingCap ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t">
                <div className="flex gap-2">
                  {detailTarget.status === "active" && (
                    <Button variant="outline" size="sm" onClick={() => handleRevoke(detailTarget)} className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50">
                      <Ban className="h-3.5 w-3.5" /> Suspend
                    </Button>
                  )}
                  {detailTarget.status === "suspended" && (
                    <Button variant="outline" size="sm" onClick={() => handleRestore(detailTarget)} className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </Button>
                  )}
                  {detailTarget.status !== "deleted" && (
                    <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(true)} className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                </div>
                <DialogClose asChild>
                  <Button variant="ghost" size="sm">Close</Button>
                </DialogClose>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — stacks on top of the detail dialog */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete organization permanently?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            This permanently deletes every contract, client, clause, and user record belonging to <strong>{detailTarget?.name}</strong>, and removes the organization from Clerk. This cannot be undone — use Suspend instead if you just want to block access.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete permanently</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
