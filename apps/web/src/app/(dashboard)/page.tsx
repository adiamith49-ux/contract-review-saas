"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import { FileText, Upload, AlertTriangle, CheckCircle, Clock, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { listContracts, type ContractListItem } from "@/lib/api";
import { formatDate, formatFileSize, CONTRACT_TYPE_LABELS } from "@/lib/utils";

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const { contracts } = await listContracts(token);
        setContracts(contracts);
      } catch {
        // silently fail on dashboard — user sees empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken]);

  const total = contracts.length;
  const analyzed = contracts.filter((c) => c.status === "analyzed").length;
  const highRisk = contracts.filter(
    (c) => c.analyses?.[0]?.risk_level === "high" || c.analyses?.[0]?.risk_level === "critical"
  ).length;
  const pending = contracts.filter(
    (c) => c.status === "uploaded" || c.status === "processing"
  ).length;

  const recent = contracts.slice(0, 5);

  const firstName = user?.firstName ?? "there";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Good to see you, {firstName} 👋</h1>
          <p className="text-gray-500 mt-1">Here's what's happening with your contracts.</p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Plus className="h-4 w-4 mr-2" />
            Upload Contract
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <StatCard label="Total Contracts" value={total} icon={<FileText className="h-5 w-5 text-blue-500" />} loading={loading} />
        <StatCard label="Analyzed" value={analyzed} icon={<CheckCircle className="h-5 w-5 text-emerald-500" />} loading={loading} />
        <StatCard label="High / Critical Risk" value={highRisk} icon={<AlertTriangle className="h-5 w-5 text-orange-500" />} loading={loading} />
        <StatCard label="Pending Review" value={pending} icon={<Clock className="h-5 w-5 text-violet-500" />} loading={loading} />
      </div>

      {/* Recent contracts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Recent Contracts</CardTitle>
          <Link href="/contracts" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y">
              {recent.map((c) => (
                <Link key={c.id} href={`/contracts/${c.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.filename}</p>
                      <p className="text-xs text-gray-500">{CONTRACT_TYPE_LABELS[c.contract_type]} · {formatFileSize(c.file_size)} · {formatDate(c.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    {c.analyses?.[0] && <RiskBadge level={c.analyses[0].risk_level} />}
                    <StatusBadge status={c.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, loading }: { label: string; value: number; icon: React.ReactNode; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        {loading ? <Skeleton className="h-8 w-12" /> : <p className="text-3xl font-bold text-gray-900">{value}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Upload className="h-10 w-10 text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-600">No contracts yet</p>
      <p className="text-xs text-gray-400 mt-1">Upload your first contract to get started</p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/upload">Upload Contract</Link>
      </Button>
    </div>
  );
}
