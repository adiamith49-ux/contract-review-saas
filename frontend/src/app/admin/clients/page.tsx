"use client";
import { useEffect, useState } from "react";
import { Building2, Plus, Pencil, Trash2, Check, X, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  listAdminClients, createAdminClient, updateAdminClient, deleteAdminClient,
  listAdminUsers, assignUserToClient, removeUserFromClient,
  type AdminClient, type AdminUserRow,
} from "@/lib/admin-api";
import { cn } from "@/lib/utils";

const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Legal", "Real Estate", "Retail", "Manufacturing", "Other"];
const STATUS_COLORS = { active: "bg-emerald-100 text-emerald-700", inactive: "bg-red-100 text-red-700" };

export default function AdminClientsPage() {
  const [clients, setClients]   = useState<AdminClient[]>([]);
  const [users, setUsers]       = useState<AdminUserRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminClient | null>(null);
  const [manageTarget, setManageTarget] = useState<AdminClient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminClient | null>(null);
  const [form, setForm] = useState({ name: "", industry: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [c, u] = await Promise.all([listAdminClients(), listAdminUsers()]);
    setClients(c.clients);
    setUsers(u.users);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setForm({ name: "", industry: "", notes: "" }); setShowCreate(true); }
  function openEdit(c: AdminClient) { setEditTarget(c); setForm({ name: c.name, industry: c.industry ?? "", notes: c.notes ?? "" }); }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const { client } = await updateAdminClient(editTarget.id, form);
        setClients(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...client } : c));
        setEditTarget(null);
        toast.success("Client updated");
      } else {
        const { client } = await createAdminClient(form);
        setClients(prev => [client, ...prev]);
        setShowCreate(false);
        toast.success("Client created");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(c: AdminClient) {
    const status = c.status === "active" ? "inactive" : "active";
    try {
      const { client } = await updateAdminClient(c.id, { status });
      setClients(prev => prev.map(x => x.id === c.id ? { ...x, ...client } : x));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAdminClient(deleteTarget.id);
      setClients(prev => prev.filter(c => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Client deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleAssign(userId: string) {
    if (!manageTarget) return;
    try {
      await assignUserToClient(userId, manageTarget.id);
      setUsers(prev => prev.map(u =>
        u.clerk_user_id === userId
          ? { ...u, client_ids: [...u.client_ids, manageTarget.id] }
          : u
      ));
      toast.success("User assigned");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleRemove(userId: string) {
    if (!manageTarget) return;
    try {
      await removeUserFromClient(userId, manageTarget.id);
      setUsers(prev => prev.map(u =>
        u.clerk_user_id === userId
          ? { ...u, client_ids: u.client_ids.filter(id => id !== manageTarget.id) }
          : u
      ));
      toast.success("User removed");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const ClientForm = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Client name *</label>
        <Input
          placeholder="e.g. Nexus Technologies"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Industry</label>
        <select
          className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.industry}
          onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
        >
          <option value="">Select industry</option>
          {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Notes</label>
        <textarea
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          rows={3}
          placeholder="Internal notes about this client…"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setEditTarget(null); }} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
          {saving ? "Saving…" : editTarget ? "Save changes" : "Create client"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1000px] mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${clients.length} client${clients.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> New client
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2fr)_120px_80px_80px_100px_100px] border-b bg-gray-50/80 px-5 py-2.5">
          {["Client", "Industry", "Users", "Contracts", "Status", ""].map((h, i) => (
            <div key={i} className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{h}</div>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2fr)_120px_80px_80px_100px_100px] items-center px-5 py-4 border-b last:border-b-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <div />
            </div>
          ))
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <Building2 className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No clients yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first client to get started.</p>
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create client
            </Button>
          </div>
        ) : (
          clients.map(c => (
            <div key={c.id} className="grid grid-cols-[minmax(0,2fr)_120px_80px_80px_100px_100px] items-center px-5 py-3.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
              <div className="min-w-0 pr-4">
                <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                {c.notes && <p className="text-[11px] text-gray-400 truncate">{c.notes}</p>}
              </div>
              <span className="text-xs text-gray-500 truncate">{c.industry ?? "—"}</span>
              <span className="text-sm font-semibold text-gray-700">{c.member_count}</span>
              <span className="text-sm font-semibold text-gray-700">{c.contract_count}</span>
              <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full w-fit", STATUS_COLORS[c.status as keyof typeof STATUS_COLORS])}>
                {c.status}
              </span>
              <div className="flex items-center gap-1 justify-end">
                <button
                  onClick={() => setManageTarget(c)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Manage users"
                >
                  <Users className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => openEdit(c)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(c)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New client</DialogTitle>
          </DialogHeader>
          {ClientForm}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
          </DialogHeader>
          {editTarget && ClientForm}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete client?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Deleting <strong>{deleteTarget?.name}</strong> will remove all user assignments but contracts will remain (unassigned). This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage users dialog */}
      <Dialog open={!!manageTarget} onOpenChange={open => !open && setManageTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Users — {manageTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {users.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No users in the system yet. Invite from the Users page.</p>
            ) : (
              users.map(u => {
                const assigned = manageTarget ? u.client_ids.includes(manageTarget.id) : false;
                return (
                  <div key={u.clerk_user_id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.email}</p>
                      <p className="text-[11px] text-gray-400">{u.client_ids.length} client{u.client_ids.length !== 1 ? "s" : ""} assigned</p>
                    </div>
                    {assigned ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleRemove(u.clerk_user_id)}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Remove
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleAssign(u.clerk_user_id)}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Assign
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
