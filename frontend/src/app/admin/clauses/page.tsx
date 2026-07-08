"use client";
import { useEffect, useState } from "react";
import { Library, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  listAdminClauses, createAdminClause, updateAdminClause, deleteAdminClause,
  type AdminClause,
} from "@/lib/admin-api";
import { cn } from "@/lib/utils";

const TYPE_LABELS = { approved: "Approved", fallback: "Fallback", unacceptable: "Unacceptable" };
const TYPE_COLORS = {
  approved: "bg-emerald-100 text-emerald-700",
  fallback: "bg-amber-100 text-amber-700",
  unacceptable: "bg-red-100 text-red-700",
};

const CONTRACT_TYPE_OPTIONS = ["nda", "msa", "saas", "sow", "order_form", "employment", "vendor_agreement", "other"];

const emptyForm = { title: "", clause_type: "approved" as "approved" | "fallback" | "unacceptable", content: "", tags: [] as string[], jurisdiction: null as string | null, contract_types: [] as string[], status: "approved" as "draft" | "approved", source: "" };

export default function AdminClausesPage() {
  const [clauses, setClauses]   = useState<AdminClause[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminClause | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminClause | null>(null);
  const [form, setForm]   = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listAdminClauses().then(r => { setClauses(r.clauses); setLoading(false); });
  }, []);

  function openCreate() { setForm(emptyForm); setShowCreate(true); }
  function openEdit(c: AdminClause) {
    setEditTarget(c);
    setForm({ title: c.title, clause_type: c.clause_type as "approved" | "fallback" | "unacceptable", content: c.content, tags: c.tags, jurisdiction: c.jurisdiction, contract_types: c.contract_types ?? [], status: c.status ?? "approved", source: c.source ?? "" });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { ...form, source: form.source.trim() || null };
      if (editTarget) {
        const { clause } = await updateAdminClause(editTarget.id, payload);
        setClauses(prev => prev.map(c => c.id === editTarget.id ? clause : c));
        setEditTarget(null);
        toast.success("Clause updated");
      } else {
        const { clause } = await createAdminClause(payload);
        setClauses(prev => [...prev, clause]);
        setShowCreate(false);
        toast.success("Clause created");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAdminClause(deleteTarget.id);
      setClauses(prev => prev.filter(c => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Clause deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const ClauseForm = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Title *</label>
        <Input placeholder="e.g. Standard Limitation of Liability" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Type</label>
        <select
          className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.clause_type}
          onChange={e => setForm(f => ({ ...f, clause_type: e.target.value as "approved" | "fallback" | "unacceptable" }))}
        >
          <option value="approved">Approved</option>
          <option value="fallback">Fallback</option>
          <option value="unacceptable">Unacceptable / Walk-away</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Status</label>
          <select
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value as "draft" | "approved" }))}
          >
            <option value="approved">Approved — used in AI reviews</option>
            <option value="draft">Draft — hidden from AI reviews</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Source</label>
          <Input placeholder="e.g. MSA Playbook v3" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Applies to contract types</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CONTRACT_TYPE_OPTIONS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setForm(f => ({ ...f, contract_types: f.contract_types.includes(t) ? f.contract_types.filter(x => x !== t) : [...f.contract_types, t] }))}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase transition-colors",
                form.contract_types.includes(t) ? "bg-primary/10 text-primary border-primary/30" : "bg-white text-gray-500 hover:bg-gray-50",
              )}
            >
              {t.replace("_", " ")}
            </button>
          ))}
          <span className="text-[10px] text-gray-400 ml-1">none selected = all types</span>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Clause text *</label>
        <textarea
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono text-xs leading-relaxed"
          rows={8}
          placeholder="Paste the full clause text here…"
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setEditTarget(null); }} disabled={saving}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()}>
          {saving ? "Saving…" : editTarget ? "Save changes" : "Create clause"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-[900px] mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clause Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${clauses.length} clause${clauses.length !== 1 ? "s" : ""}`} — global, read-only for all users
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Add clause
        </Button>
      </div>

      <div className="rounded-xl border bg-white shadow-sm divide-y overflow-hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-16 rounded-full ml-2" />
              <div className="ml-auto flex gap-1.5">
                <Skeleton className="h-7 w-7 rounded" />
                <Skeleton className="h-7 w-7 rounded" />
              </div>
            </div>
          ))
        ) : clauses.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <Library className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No clauses yet</p>
            <p className="text-xs text-gray-400 mt-1">Add standard clauses to the global library.</p>
            <Button size="sm" className="mt-4" onClick={openCreate}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add first clause</Button>
          </div>
        ) : (
          clauses.map(c => (
            <div key={c.id}>
              <div
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              >
                <div className="flex-1 min-w-0 flex items-center gap-2.5">
                  <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0", TYPE_COLORS[c.clause_type as keyof typeof TYPE_COLORS])}>
                    {TYPE_LABELS[c.clause_type as keyof typeof TYPE_LABELS]}
                  </span>
                  <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                  {c.status === "draft" && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 shrink-0">Draft</span>
                  )}
                  <span className="text-[10px] text-gray-400 shrink-0">v{c.version ?? 1}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(c); }}
                    className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}
                    className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {expanded === c.id
                    ? <ChevronUp className="h-4 w-4 text-gray-300 ml-1" />
                    : <ChevronDown className="h-4 w-4 text-gray-300 ml-1" />}
                </div>
              </div>
              {expanded === c.id && (
                <div className="px-5 pb-4 border-t bg-gray-50/60">
                  <pre className="text-xs text-gray-700 font-mono leading-relaxed whitespace-pre-wrap mt-3">{c.content}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add clause</DialogTitle></DialogHeader>
          {ClauseForm}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit clause</DialogTitle></DialogHeader>
          {editTarget && ClauseForm}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete clause?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">
            <strong>{deleteTarget?.title}</strong> will be permanently removed from the library. Users will no longer see it.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
