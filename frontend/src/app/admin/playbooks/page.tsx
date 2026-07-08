"use client";
import { useEffect, useState } from "react";
import { Gavel, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  listAdminPlaybooks, createAdminPlaybook, updateAdminPlaybook, deleteAdminPlaybook,
  type AdminPlaybook,
} from "@/lib/admin-api";
import { formatDate, formatFileSize } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function AdminPlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<AdminPlaybook[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminPlaybook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPlaybook | null>(null);
  const [form, setForm] = useState({ name: "", description: "", is_active: true, jurisdiction: "" as string, file: null as File | null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listAdminPlaybooks().then(r => { setPlaybooks(r.rules); setLoading(false); });
  }, []);

  function openCreate() { setForm({ name: "", description: "", is_active: true, jurisdiction: "", file: null }); setShowCreate(true); }
  function openEdit(p: AdminPlaybook) {
    setEditTarget(p);
    setForm({ name: p.name, description: p.description ?? "", is_active: p.is_active, jurisdiction: p.jurisdiction ?? "", file: null });
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const { rule } = await updateAdminPlaybook(editTarget.id, {
          name: form.name, description: form.description || undefined, is_active: form.is_active,
          jurisdiction: form.jurisdiction || null,
        });
        setPlaybooks(prev => prev.map(p => p.id === editTarget.id ? rule : p));
        setEditTarget(null);
        toast.success("Playbook updated");
      } else {
        if (!form.file) { toast.error("Please select a PDF or DOCX file"); return; }
        const { rule } = await createAdminPlaybook({ name: form.name, description: form.description || undefined, is_active: form.is_active, jurisdiction: form.jurisdiction || null, file: form.file });
        setPlaybooks(prev => [rule, ...prev]);
        setShowCreate(false);
        toast.success("Playbook uploaded");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(p: AdminPlaybook) {
    try {
      const { rule } = await updateAdminPlaybook(p.id, { is_active: !p.is_active });
      setPlaybooks(prev => prev.map(x => x.id === p.id ? rule : x));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAdminPlaybook(deleteTarget.id);
      setPlaybooks(prev => prev.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Playbook deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const PlaybookForm = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Playbook name *</label>
        <Input placeholder="e.g. SaaS Vendor Playbook" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Description</label>
        <Input placeholder="Optional short description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Jurisdiction</label>
        <select
          className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.jurisdiction}
          onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))}
        >
          <option value="">All jurisdictions</option>
          <option value="us">United States</option>
          <option value="uk">United Kingdom</option>
          <option value="eu">European Union</option>
          <option value="india">India</option>
        </select>
        <p className="text-[11px] text-gray-400 mt-1">Only applied to contracts whose governing law matches (or to all if left blank).</p>
      </div>
      {!editTarget && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Upload PDF or DOCX *</label>
          <input
            type="file"
            accept=".pdf,.docx,.doc"
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:text-xs file:font-medium file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
            onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
          />
          <p className="text-xs text-gray-400 mt-1">The document text will be extracted and used in AI reviews. Max 10MB.</p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={form.is_active}
          onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
          className="rounded border-gray-300"
        />
        <label htmlFor="is_active" className="text-sm text-gray-700">Active — inject into AI reviews</label>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setEditTarget(null); }} disabled={saving}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
          {saving ? "Saving…" : editTarget ? "Save changes" : "Upload playbook"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[900px] mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Playbooks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${playbooks.length} playbook${playbooks.length !== 1 ? "s" : ""}`} — injected into all AI contract reviews
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Upload playbook
        </Button>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2fr)_100px_80px_80px_100px] border-b bg-gray-50/80 px-5 py-2.5">
          {["Playbook", "Uploaded", "Size", "Active", ""].map((h, i) => (
            <div key={i} className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{h}</div>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2fr)_100px_80px_80px_100px] items-center px-5 py-4 border-b last:border-b-0">
              <div className="space-y-1.5"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-10 rounded-full" />
              <div />
            </div>
          ))
        ) : playbooks.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <Gavel className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No playbooks yet</p>
            <p className="text-xs text-gray-400 mt-1">Upload PDF or DOCX playbooks to inject into AI reviews.</p>
            <Button size="sm" className="mt-4" onClick={openCreate}><Plus className="h-3.5 w-3.5 mr-1.5" /> Upload playbook</Button>
          </div>
        ) : (
          playbooks.map(p => (
            <div key={p.id} className="grid grid-cols-[minmax(0,2fr)_100px_80px_80px_100px] items-center px-5 py-3.5 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                    {p.jurisdiction ? p.jurisdiction.toUpperCase() : "All"}
                  </span>
                </div>
                {p.description && <p className="text-[11px] text-gray-400 truncate mt-0.5">{p.description}</p>}
                {p.original_filename && <p className="text-[10px] text-gray-300 truncate">{p.original_filename}</p>}
              </div>
              <span className="text-xs text-gray-500">{formatDate(p.created_at)}</span>
              <span className="text-xs text-gray-500">{p.file_size ? formatFileSize(p.file_size) : "—"}</span>
              <button onClick={() => handleToggle(p)} className="transition-colors" title={p.is_active ? "Deactivate" : "Activate"}>
                {p.is_active
                  ? <ToggleRight className="h-5 w-5 text-emerald-500" />
                  : <ToggleLeft  className="h-5 w-5 text-gray-300"    />}
              </button>
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => openEdit(p)} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Upload playbook</DialogTitle></DialogHeader>{PlaybookForm}</DialogContent>
      </Dialog>
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Edit playbook</DialogTitle></DialogHeader>{editTarget && PlaybookForm}</DialogContent>
      </Dialog>
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete playbook?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500"><strong>{deleteTarget?.name}</strong> will be removed from all future AI reviews.</p>
          <div className="flex justify-end gap-3 mt-4">
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
