"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Building2, Plus, Search, FileText, AlertTriangle, X, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listClients, createClient, type Client } from "@/lib/api";
import { cn } from "@/lib/utils";

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Legal", "Real Estate",
  "Manufacturing", "Retail", "Media", "Energy", "Education", "Other",
];

export default function ClientsPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const token = await getToken();
      const { clients: c } = await listClients(token);
      setClients(c);
    } catch {
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setName(""); setIndustry(""); setNotes("");
  }

  async function handleCreate() {
    if (!name.trim()) { toast.error("Client name is required"); return; }
    setCreating(true);
    try {
      const token = await getToken();
      const { client } = await createClient(token, {
        name: name.trim(),
        industry: industry || undefined,
        notes: notes.trim() || undefined,
      });
      setClients(prev => [{ ...client }, ...prev]);
      toast.success(`Client "${client.name}" created`);
      setOpen(false);
      resetForm();
    } catch {
      toast.error("Failed to create client");
    } finally {
      setCreating(false);
    }
  }

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${clients.length} client${clients.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          placeholder="Search clients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasSearch={!!search} onNew={() => setOpen(true)} onClear={() => setSearch("")} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ClientCard key={c.id} client={c} onClick={() => router.push(`/clients/${c.id}`)} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Client Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Acme Corporation"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select industry (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(ind => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Notes</Label>
              <Textarea
                placeholder="Any notes about this client relationship…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={creating}>Cancel</Button>
            </DialogClose>
            <Button size="sm" onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creating…</> : "Create Client"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Client card ──────────────────────────────────────────────────────────────

function ClientCard({ client, onClick }: { client: Client; onClick: () => void }) {
  const inactive = client.status === "inactive";

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-xl border bg-white p-5 cursor-pointer hover:shadow-md transition-all group",
        inactive ? "border-red-200 bg-red-50/40" : "hover:border-primary/30",
      )}
    >
      {inactive && (
        <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-red-600 bg-red-100 rounded-md px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Engagement ended / renewal needed
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          inactive ? "bg-red-100" : "bg-primary/10 group-hover:bg-primary/15 transition-colors",
        )}>
          <Building2 className={cn("h-5 w-5", inactive ? "text-red-400" : "text-primary")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
            {client.name}
          </p>
          {client.industry && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{client.industry}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <FileText className="h-3.5 w-3.5" />
          {client.contract_count} contract{client.contract_count !== 1 ? "s" : ""}
        </div>
        {!inactive && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-emerald-600 border-emerald-200 bg-emerald-50">
            Active
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  hasSearch, onNew, onClear,
}: { hasSearch: boolean; onNew: () => void; onClear: () => void }) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-700">No clients match your search</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>Clear search</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
        <Building2 className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-700">No clients yet</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">
        Create a client to organize all their contracts in one place.
      </p>
      <Button size="sm" className="mt-5" onClick={onNew}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Create your first client
      </Button>
    </div>
  );
}
