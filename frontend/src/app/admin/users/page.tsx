"use client";
import { useEffect, useState } from "react";
import { Users, Mail, Plus, X, Building2, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  listAdminUsers, listAdminClients, assignUserToClient, removeUserFromClient,
  inviteUser, addUser, deleteAdminUser, type AdminUserRow, type AdminClient,
} from "@/lib/admin-api";
import { formatDate } from "@/lib/utils";

export default function AdminUsersPage() {
  const [users, setUsers]     = useState<AdminUserRow[]>([]);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignTarget, setAssignTarget] = useState<AdminUserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // Add user dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    const [u, c] = await Promise.all([listAdminUsers(), listAdminClients()]);
    setUsers(u.users);
    setClients(c.clients);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      await inviteUser(inviteEmail);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await addUser({
        email: addEmail,
        first_name: addFirstName || undefined,
        last_name: addLastName || undefined,
      });
      toast.success(`User ${addEmail} created. They can sign in via "Forgot Password" to set their password.`);
      setAddEmail("");
      setAddFirstName("");
      setAddLastName("");
      setAddOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleAssign(clientId: string) {
    if (!assignTarget) return;
    try {
      await assignUserToClient(assignTarget.clerk_user_id, clientId);
      setUsers(prev => prev.map(u =>
        u.clerk_user_id === assignTarget.clerk_user_id
          ? { ...u, client_ids: [...u.client_ids, clientId] }
          : u
      ));
      setAssignTarget(prev => prev ? { ...prev, client_ids: [...prev.client_ids, clientId] } : null);
      toast.success("Client assigned");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleRemove(clientId: string) {
    if (!assignTarget) return;
    try {
      await removeUserFromClient(assignTarget.clerk_user_id, clientId);
      setUsers(prev => prev.map(u =>
        u.clerk_user_id === assignTarget.clerk_user_id
          ? { ...u, client_ids: u.client_ids.filter(id => id !== clientId) }
          : u
      ));
      setAssignTarget(prev => prev ? { ...prev, client_ids: prev.client_ids.filter(id => id !== clientId) } : null);
      toast.success("Client removed");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminUser(deleteTarget.clerk_user_id);
      setUsers(prev => prev.filter(u => u.clerk_user_id !== deleteTarget.clerk_user_id));
      toast.success(`User ${deleteTarget.email} deleted`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const assignedForTarget = assignTarget?.client_ids ?? [];
  const unassigned = clients.filter(c => !assignedForTarget.includes(c.id));
  const assigned   = clients.filter(c =>  assignedForTarget.includes(c.id));

  return (
    <div className="p-6 lg:p-8 max-w-[900px] mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${users.length} user${users.length !== 1 ? "s" : ""} in the system`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
            <Mail className="h-4 w-4 mr-1.5" /> Invite user
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" /> Add user
          </Button>
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2fr)_120px_100px_40px] border-b bg-gray-50/80 px-5 py-2.5">
          {["User", "Joined", "Clients", ""].map((h, i) => (
            <div key={i} className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{h}</div>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2fr)_120px_100px_40px] items-center px-5 py-4 border-b last:border-b-0">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <Users className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No users yet</p>
            <p className="text-xs text-gray-400 mt-1">Add or invite users to get them onboarded.</p>
            <div className="flex items-center gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                <Mail className="h-3.5 w-3.5 mr-1.5" /> Invite user
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add user
              </Button>
            </div>
          </div>
        ) : (
          users.map(u => (
            <div
              key={u.clerk_user_id}
              className="grid grid-cols-[minmax(0,2fr)_120px_100px_40px] items-center px-5 py-3.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer group"
              onClick={() => setAssignTarget(u)}
            >
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-primary uppercase">{u.email[0]}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">{u.email}</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">{formatDate(u.created_at)}</span>
              <div className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">{u.client_ids.length}</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setDeleteTarget(u); }}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors justify-self-end"
                title="Delete user"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 mt-1">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email address</label>
              <Input
                type="email"
                placeholder="colleague@lawfirm.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-400">
              They'll receive an email invitation to create their Contralyne account. Once they sign up, assign them to their clients here.
            </p>
            <div className="flex justify-end gap-3">
              <DialogClose asChild>
                <Button variant="outline" size="sm" type="button">Cancel</Button>
              </DialogClose>
              <Button size="sm" type="submit" disabled={inviting}>
                {inviting ? "Sending…" : "Send invitation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) { setAddEmail(""); setAddFirstName(""); setAddLastName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4 mt-1">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email address <span className="text-red-500">*</span></label>
              <Input
                type="email"
                placeholder="user@lawfirm.com"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">First name</label>
                <Input
                  placeholder="Jane"
                  value={addFirstName}
                  onChange={e => setAddFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Last name</label>
                <Input
                  placeholder="Smith"
                  value={addLastName}
                  onChange={e => setAddLastName(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Creates the account immediately — no invitation email is sent. The user can sign in via <strong>Forgot Password</strong> to set their password.
            </p>
            <div className="flex justify-end gap-3">
              <DialogClose asChild>
                <Button variant="outline" size="sm" type="button">Cancel</Button>
              </DialogClose>
              <Button size="sm" type="submit" disabled={adding}>
                {adding ? "Creating…" : "Create user"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete user dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Deleting <strong>{deleteTarget?.email}</strong> permanently removes their account and all
            their data — contracts, analyses, chat history, and client assignments. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={deleting}>Cancel</Button>
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDeleteUser} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete user"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign clients dialog */}
      <Dialog open={!!assignTarget} onOpenChange={open => !open && setAssignTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Client access — {assignTarget?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1 max-h-96 overflow-y-auto">
            {assigned.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Assigned ({assigned.length})</p>
                {assigned.map(c => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2 mb-1.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      {c.industry && <p className="text-[11px] text-gray-400">{c.industry}</p>}
                    </div>
                    <button
                      onClick={() => handleRemove(c.id)}
                      className="p-1 rounded text-red-500 hover:bg-red-100 transition-colors"
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {unassigned.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Available to assign</p>
                {unassigned.map(c => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 mb-1.5 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      {c.industry && <p className="text-[11px] text-gray-400">{c.industry}</p>}
                    </div>
                    <button
                      onClick={() => handleAssign(c.id)}
                      className="flex items-center gap-1 text-xs font-medium text-primary px-2 py-1 rounded border border-primary/30 hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Assign
                    </button>
                  </div>
                ))}
              </div>
            )}
            {clients.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No clients created yet. Create clients first.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
