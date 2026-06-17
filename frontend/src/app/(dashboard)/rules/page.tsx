"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Upload, FileText, Trash2, Pencil, Gavel, Info, X, Loader2, CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { listRules, createRule, updateRule, deleteRule, type ReviewRule } from "@/lib/api";
import { formatDate, formatFileSize, cn } from "@/lib/utils";

const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export default function PlaybooksPage() {
  const { getToken } = useAuth();
  const [rules, setRules] = useState<ReviewRule[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Upload dialog state ───────────────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDrag, setUploadDrag] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: "", description: "", is_active: true });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Edit metadata dialog state ────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<ReviewRule | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [editSaving, setEditSaving] = useState(false);

  // ── Delete dialog state ───────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<ReviewRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Toggle state ──────────────────────────────────────────────────────────
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const token = await getToken();
      const { rules } = await listRules(token);
      setRules(rules);
    } catch {
      toast.error("Failed to load playbooks");
    } finally {
      setLoading(false);
    }
  }

  // ── File handling ─────────────────────────────────────────────────────────

  function acceptFile(f: File) {
    if (!ACCEPTED_MIME.includes(f.type)) {
      toast.error("Only PDF and DOCX files are supported");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB");
      return;
    }
    setUploadFile(f);
    // Auto-fill name from filename (strip extension)
    const autoName = f.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
    setUploadForm(p => ({ ...p, name: p.name || autoName }));
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setUploadDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openUpload() {
    setUploadFile(null);
    setUploadForm({ name: "", description: "", is_active: true });
    setUploadOpen(true);
  }

  // ── Upload submit ─────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!uploadFile || !uploadForm.name.trim()) return;
    setUploading(true);
    try {
      const token = await getToken();
      const { rule } = await createRule(token, {
        file: uploadFile,
        name: uploadForm.name.trim(),
        description: uploadForm.description.trim() || undefined,
        is_active: uploadForm.is_active,
      });
      setRules(prev => [rule, ...prev]);
      toast.success("Playbook uploaded successfully");
      setUploadOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ── Edit metadata ─────────────────────────────────────────────────────────

  function openEdit(rule: ReviewRule) {
    setEditTarget(rule);
    setEditForm({ name: rule.name, description: rule.description ?? "" });
  }

  async function handleEditSave() {
    if (!editTarget || !editForm.name.trim()) return;
    setEditSaving(true);
    try {
      const token = await getToken();
      const { rule } = await updateRule(token, editTarget.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
      });
      setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
      toast.success("Playbook updated");
      setEditTarget(null);
    } catch {
      toast.error("Failed to update playbook");
    } finally {
      setEditSaving(false);
    }
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  async function handleToggle(rule: ReviewRule) {
    setTogglingId(rule.id);
    try {
      const token = await getToken();
      const { rule: updated } = await updateRule(token, rule.id, { is_active: !rule.is_active });
      setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch {
      toast.error("Failed to update playbook");
    } finally {
      setTogglingId(null);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = await getToken();
      await deleteRule(token, deleteTarget.id);
      setRules(prev => prev.filter(r => r.id !== deleteTarget.id));
      toast.success("Playbook deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete playbook");
    } finally {
      setDeleting(false);
    }
  }

  const activeCount = rules.filter(r => r.is_active).length;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Playbooks</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload your firm's contract review playbook (DOCX or PDF). Claude reads it alongside every contract.
          </p>
        </div>
        <Button onClick={openUpload} className="shrink-0">
          <Upload className="h-4 w-4 mr-2" />
          Upload Playbook
        </Button>
      </div>

      {/* Info banner */}
      {!loading && rules.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-primary/80">
            <span className="font-semibold">
              {activeCount} active {activeCount === 1 ? "playbook" : "playbooks"}
            </span>
            {" "}will be sent to Claude alongside any new contract analysis.
            Toggle playbooks on or off without deleting them.
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState onUpload={openUpload} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map(rule => (
            <PlaybookCard
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

      {/* ── Upload dialog ───────────────────────────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={o => !uploading && setUploadOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Playbook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            {/* File dropzone */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setUploadDrag(true); }}
              onDragLeave={() => setUploadDrag(false)}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
                uploadDrag ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/40 hover:bg-gray-50",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
              />
              {uploadFile ? (
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{uploadFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(uploadFile.size)}</p>
                  </div>
                  {!uploading && (
                    <button
                      onClick={e => { e.stopPropagation(); setUploadFile(null); setUploadForm(p => ({ ...p, name: "" })); }}
                      className="ml-1 rounded-full p-1 hover:bg-gray-100 shrink-0"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-700">Drop your playbook here, or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">PDF or DOCX · up to 10 MB</p>
                </>
              )}
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="pb-name">Playbook Name *</Label>
              <Input
                id="pb-name"
                placeholder="e.g. MSA Standard Playbook"
                value={uploadForm.name}
                onChange={e => setUploadForm(p => ({ ...p, name: e.target.value }))}
                disabled={uploading}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="pb-desc">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Textarea
                id="pb-desc"
                placeholder="e.g. Standard positions for MSA and vendor agreements — US jurisdiction"
                rows={2}
                value={uploadForm.description}
                onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))}
                disabled={uploading}
                className="resize-none"
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setUploadForm(p => ({ ...p, is_active: !p.is_active }))}
                disabled={uploading}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                  uploadForm.is_active ? "bg-emerald-500" : "bg-gray-300",
                )}
              >
                <span className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform translate-x-0.5",
                  uploadForm.is_active && "translate-x-[18px]",
                )} />
              </button>
              <span className="text-sm text-gray-700">
                {uploadForm.is_active ? "Active — will be applied to contract analyses" : "Inactive"}
              </span>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</Button>
              <Button
                onClick={handleUpload}
                disabled={!uploadFile || !uploadForm.name.trim() || uploading}
              >
                {uploading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</>
                  : <><Upload className="h-4 w-4 mr-2" />Upload Playbook</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit metadata dialog ────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={o => !o && !editSaving && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Playbook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                disabled={editSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                rows={2}
                value={editForm.description}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                disabled={editSaving}
                className="resize-none"
              />
            </div>
            <p className="text-xs text-gray-400">
              To replace the playbook document, delete this entry and upload a new one.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSaving}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={!editForm.name.trim() || editSaving}>
                {editSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ─────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && !deleting && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Playbook</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-1">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>?
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Playbook card ────────────────────────────────────────────────────────────

function PlaybookCard({
  rule, toggling, onToggle, onEdit, onDelete,
}: {
  rule: ReviewRule;
  toggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className={cn("transition-opacity", !rule.is_active && "opacity-55")}>
      <CardContent className="p-5 flex flex-col gap-3 h-full">
        {/* Active badge + name */}
        <div className="flex items-start gap-2">
          <div className="mt-0.5">
            {rule.is_active
              ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
              : <div className="h-4 w-4 rounded-full border-2 border-gray-300 shrink-0" />}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{rule.name}</h3>
        </div>

        {/* File info */}
        {rule.original_filename && (
          <div className="flex items-center gap-1.5 -mt-1">
            <FileText className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 truncate">{rule.original_filename}</span>
            {rule.file_size && (
              <span className="text-xs text-gray-400 shrink-0">· {formatFileSize(rule.file_size)}</span>
            )}
          </div>
        )}

        {/* Description */}
        {rule.description && (
          <p className="text-xs text-gray-500 line-clamp-2 flex-1">{rule.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t gap-2 mt-auto">
          {/* Active toggle */}
          <button
            onClick={onToggle}
            disabled={toggling}
            className="flex items-center gap-2 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <span className={cn(
              "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0",
              rule.is_active ? "bg-emerald-500" : "bg-gray-300",
              toggling && "opacity-60",
            )}>
              <span className={cn(
                "inline-block h-3 w-3 rounded-full bg-white shadow transition-transform translate-x-0.5",
                rule.is_active && "translate-x-3.5",
              )} />
            </span>
            <span className={rule.is_active ? "text-emerald-600" : "text-gray-400"}>
              {rule.is_active ? "Active" : "Inactive"}
            </span>
          </button>

          {/* Actions */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={onEdit}
              className="rounded p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Rename playbook"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete playbook"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 -mt-1">{formatDate(rule.created_at)}</p>
      </CardContent>
    </Card>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Gavel className="h-10 w-10 text-gray-300 mb-3" />
      <p className="text-sm font-semibold text-gray-700">No playbooks yet</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">
        Upload your firm's playbook document (DOCX or PDF). Claude will review every contract against your standards.
      </p>
      <Button size="sm" className="mt-4" onClick={onUpload}>
        <Upload className="h-4 w-4 mr-1.5" />
        Upload First Playbook
      </Button>
    </div>
  );
}
