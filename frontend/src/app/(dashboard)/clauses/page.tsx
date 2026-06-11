"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Search, Pencil, Trash2, BookOpen, Tag, Globe } from "lucide-react";
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
import { listClauses, createClause, updateClause, deleteClause, type Clause } from "@/lib/api";
import { MOCK_CLAUSES } from "@/lib/mock-data";

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
import { formatDate, cn } from "@/lib/utils";

const EMPTY_FORM = {
  title: "",
  clause_type: "approved" as Clause["clause_type"],
  jurisdiction: "",
  content: "",
  tags: "",
};

export default function ClausesPage() {
  const { getToken } = useAuth();
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | Clause["clause_type"]>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Clause | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Clause | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    if (DEMO) {
      setClauses(MOCK_CLAUSES);
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const { clauses } = await listClauses(token);
      setClauses(clauses);
    } catch {
      toast.error("Failed to load clauses");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(clause: Clause) {
    setEditTarget(clause);
    setForm({
      title: clause.title,
      clause_type: clause.clause_type,
      jurisdiction: clause.jurisdiction ?? "",
      content: clause.content,
      tags: clause.tags.join(", "),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        clause_type: form.clause_type,
        jurisdiction: form.jurisdiction.trim() || null,
        content: form.content.trim(),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };

      if (DEMO) {
        if (editTarget) {
          const updated = { ...editTarget, ...payload };
          setClauses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          toast.success("Clause updated (demo)");
        } else {
          const fakeClause: Clause = { id: `cl-${Date.now()}`, user_id: "demo", created_at: new Date().toISOString(), ...payload };
          setClauses((prev) => [fakeClause, ...prev]);
          toast.success("Clause added (demo)");
        }
        setDialogOpen(false);
        return;
      }

      const token = await getToken();
      if (editTarget) {
        const { clause } = await updateClause(token, editTarget.id, payload);
        setClauses((prev) => prev.map((c) => (c.id === clause.id ? clause : c)));
        toast.success("Clause updated");
      } else {
        const { clause } = await createClause(token, payload);
        setClauses((prev) => [clause, ...prev]);
        toast.success("Clause added");
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save clause");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (DEMO) {
        setClauses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        toast.success("Clause deleted (demo)");
        setDeleteTarget(null);
        return;
      }
      const token = await getToken();
      await deleteClause(token, deleteTarget.id);
      setClauses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Clause deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete clause");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = clauses.filter((c) => {
    const matchSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchType = filterType === "all" || c.clause_type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clause Library</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Store approved and fallback clauses to reuse across contracts.
          </p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Add Clause
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search clauses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="fallback">Fallback</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasSearch={!!search || filterType !== "all"} onAdd={openAdd} />
      ) : (
        <div className="space-y-3">
          {filtered.map((clause) => (
            <Card key={clause.id} className="group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">{clause.title}</h3>
                      <TypeBadge type={clause.clause_type} />
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{clause.content}</p>
                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      {clause.jurisdiction && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Globe className="h-3 w-3" />
                          {clause.jurisdiction}
                        </span>
                      )}
                      {clause.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <Tag className="h-3 w-3 text-gray-400" />
                          {clause.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{formatDate(clause.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => openEdit(clause)}
                      className="rounded p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      aria-label="Edit clause"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(clause)}
                      className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="Delete clause"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Clause" : "Add Clause"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Limitation of Liability"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="clause_type">Type *</Label>
                <Select
                  value={form.clause_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, clause_type: v as Clause["clause_type"] }))}
                >
                  <SelectTrigger id="clause_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="fallback">Fallback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jurisdiction">Jurisdiction</Label>
                <Input
                  id="jurisdiction"
                  placeholder="e.g. England & Wales"
                  value={form.jurisdiction}
                  onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="content">Clause Text *</Label>
              <Textarea
                id="content"
                placeholder="Paste the full clause text here…"
                rows={5}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags <span className="text-gray-400 font-normal">(comma-separated)</span></Label>
              <Input
                id="tags"
                placeholder="e.g. liability, indemnity, SaaS"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Clause"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Clause</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-1">
            Are you sure you want to delete{" "}
            <span className="font-medium text-gray-900">{deleteTarget?.title}</span>? This cannot be undone.
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

function TypeBadge({ type }: { type: Clause["clause_type"] }) {
  return (
    <span
      className={cn(
        "text-xs font-medium px-2 py-0.5 rounded-full border",
        type === "approved"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      )}
    >
      {type === "approved" ? "Approved" : "Fallback"}
    </span>
  );
}

function EmptyState({ hasSearch, onAdd }: { hasSearch: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-600">
        {hasSearch ? "No clauses match your search" : "No clauses yet"}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        {hasSearch
          ? "Try adjusting your search or filter"
          : "Build your library of approved and fallback clauses"}
      </p>
      {!hasSearch && (
        <Button size="sm" className="mt-4" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add First Clause
        </Button>
      )}
    </div>
  );
}
