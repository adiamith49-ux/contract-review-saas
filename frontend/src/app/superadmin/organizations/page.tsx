"use client";
import { useEffect, useState } from "react";
import { Building2, Plus, Ban, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  listOrganizations, createOrganization,
  revokeOrganization, restoreOrganization, deleteOrganization,
  type SuperAdminOrganization,
} from "@/lib/superadmin-api";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<SuperAdminOrganization["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-red-100 text-red-700",
  deleted: "bg-gray-100 text-gray-500",
};

export default function SuperAdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<SuperAdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminOrganization | null>(null);
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

  async function handleRevoke(org: SuperAdminOrganization) {
    try {
      await revokeOrganization(org.id);
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, status: "suspended" } : o));
      toast.success(`${org.name} suspended`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleRestore(org: SuperAdminOrganization) {
    try {
      await restoreOrganization(org.id);
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, status: "active" } : o));
      toast.success(`${org.name} restored`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteOrganization(deleteTarget.id);
      setOrgs(prev => prev.map(o => o.id === deleteTarget.id ? { ...o, status: "deleted" } : o));
      setDeleteTarget(null);
      toast.success(`${deleteTarget.name} permanently deleted`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Organizations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${orgs.length} organization${orgs.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Invite organization
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2fr)_120px_100px_90px_160px] border-b bg-gray-50/80 px-5 py-2.5">
          {["Organization", "Onboarding", "Contracts", "Status", ""].map((h, i) => (
            <div key={i} className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{h}</div>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2fr)_120px_100px_90px_160px] items-center px-5 py-4 border-b last:border-b-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <div />
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
            <div key={o.id} className="grid grid-cols-[minmax(0,2fr)_120px_100px_90px_160px] items-center px-5 py-3.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
              <div className="min-w-0 pr-4">
                <p className="text-sm font-medium text-gray-900 truncate">{o.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{o.clerk_org_id}</p>
              </div>
              <span className="text-xs text-gray-500 truncate capitalize">{o.onboarding_type.replace("_", "-")}</span>
              <span className="text-sm font-semibold text-gray-700">{o.contract_count}</span>
              <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full w-fit capitalize", STATUS_COLORS[o.status])}>
                {o.status}
              </span>
              <div className="flex items-center gap-1 justify-end">
                {o.status === "active" && (
                  <button
                    onClick={() => handleRevoke(o)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    title="Suspend"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                )}
                {o.status === "suspended" && (
                  <button
                    onClick={() => handleRestore(o)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title="Restore"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                {o.status !== "deleted" && (
                  <button
                    onClick={() => setDeleteTarget(o)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete permanently"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
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

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete organization permanently?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            This permanently deletes every contract, client, clause, and user record belonging to <strong>{deleteTarget?.name}</strong>, and removes the organization from Clerk. This cannot be undone — use Suspend instead if you just want to block access.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete permanently</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
