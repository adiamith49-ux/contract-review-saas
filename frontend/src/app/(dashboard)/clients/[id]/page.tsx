"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  Building2, ChevronLeft, Plus, FileText, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/RiskBadge";
import { getClient, type Client, type ContractListItem } from "@/lib/api";
import { formatDateShort, formatFileSize, getLifecycleBadge, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const token = await getToken();
      const { client: c, contracts: ct } = await getClient(token, id);
      setClient(c);
      setContracts(ct);
    } catch {
      toast.error("Client not found");
      router.push("/clients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-[1280px] mx-auto space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!client) return null;

  const inactive = client.status === "inactive";

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto space-y-5">

      {/* Back */}
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ChevronLeft className="h-4 w-4" />
        All Clients
      </Link>

      {/* Inactive banner */}
      {inactive && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Engagement ended / renewal needed — this client is inactive
        </div>
      )}

      {/* Client header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            inactive ? "bg-red-100" : "bg-primary/10",
          )}>
            <Building2 className={cn("h-6 w-6", inactive ? "text-red-400" : "text-primary")} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {client.industry && <span className="text-sm text-gray-400">{client.industry}</span>}
              {!inactive && (
                <Badge variant="outline" className="text-[10px] px-1.5 text-emerald-600 border-emerald-200 bg-emerald-50">
                  Active
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Button asChild size="sm" className="shrink-0">
          <Link href={`/upload?client_id=${client.id}`}>
            <Plus className="h-4 w-4 mr-1.5" />
            Upload Contract
          </Link>
        </Button>
      </div>

      {/* Notes */}
      {client.notes && (
        <div className="rounded-xl border bg-gray-50 px-5 py-3.5 text-sm text-gray-600">
          {client.notes}
        </div>
      )}

      {/* Contracts section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Contracts ({contracts.length})
          </h2>
        </div>

        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[minmax(0,2fr)_140px_150px_110px_100px] border-b bg-gray-50/80 px-5 py-2.5">
            {["Contract", "Type", "Status", "Risk", "End Date"].map((h, i) => (
              <div key={i} className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{h}</div>
            ))}
          </div>

          {contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-6">
              <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">No contracts yet</p>
              <p className="text-xs text-gray-400 mt-1">Upload a contract to get started.</p>
              <Button asChild size="sm" className="mt-4">
                <Link href={`/upload?client_id=${client.id}`}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Upload Contract
                </Link>
              </Button>
            </div>
          ) : (
            contracts.map(c => (
              <ContractRow
                key={c.id}
                contract={c}
                onNavigate={() => router.push(`/contracts/${c.id}`)}
              />
            ))
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Contract row ─────────────────────────────────────────────────────────────

function fileExt(filename: string): "pdf" | "docx" | "other" {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  return "other";
}

function ContractRow({ contract: c, onNavigate }: { contract: ContractListItem; onNavigate: () => void }) {
  const ext = fileExt(c.filename);
  const lifecycle = getLifecycleBadge(c);
  return (
    <div
      onClick={onNavigate}
      className="grid grid-cols-[minmax(0,2fr)_140px_150px_110px_100px] items-center px-5 py-3.5 border-b last:border-b-0 hover:bg-gray-50/60 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-3 min-w-0 pr-4">
        <div className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0 uppercase",
          ext === "pdf"  ? "bg-red-100 text-red-600"  :
          ext === "docx" ? "bg-blue-100 text-blue-600" :
                           "bg-gray-100 text-gray-500",
        )}>
          {ext === "other" ? <FileText className="h-4 w-4" /> : ext.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
            {c.title || c.filename}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {c.counterparty || formatFileSize(c.file_size)}
          </p>
        </div>
      </div>
      <span className="text-xs text-gray-600 truncate pr-2">{CONTRACT_TYPE_LABELS[c.contract_type]}</span>
      <div>
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", lifecycle.className)}>
          {lifecycle.label}
        </span>
      </div>
      <div>{c.analyses?.[0] ? <RiskBadge level={c.analyses[0].risk_level} /> : <span className="text-xs text-gray-300">—</span>}</div>
      <span className="text-xs text-gray-500">{c.end_date ? formatDateShort(c.end_date) : <span className="text-gray-300">—</span>}</span>
    </div>
  );
}
