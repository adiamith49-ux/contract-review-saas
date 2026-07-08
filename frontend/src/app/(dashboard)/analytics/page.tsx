"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAnalytics, type AnalyticsData } from "@/lib/api";
import {
  CONTRACT_TYPE_LABELS,
  RISK_LEVEL_LABELS,
  STATUS_LABELS,
  RISK_COLORS,
  STATUS_COLORS,
  formatDateTime,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ContractType, RiskLevel, ContractStatus } from "@/lib/types";
import { toast } from "sonner";

export default function AnalyticsPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const result = await getAnalytics(token);
        setData(result);
      } catch {
        toast.error("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken]);

  const maxMonthCount = data
    ? Math.max(...(data.uploads_per_month.map((m) => m.count) ?? [1]), 1)
    : 1;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1 text-sm">Overview of your contract activity and risk distribution.</p>
      </div>

      {/* Stat cards — click through to the filtered repository */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Contracts"
          value={data?.totals.total}
          icon={<FileText className="h-5 w-5 text-blue-500" />}
          loading={loading}
          href="/contracts"
        />
        <StatCard
          label="High / Critical Risk"
          value={data?.totals.high_risk}
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          loading={loading}
          href="/contracts?risk=high"
        />
        <StatCard
          label="Pending Approval"
          value={data?.totals.pending_approval ?? 0}
          icon={<CheckCircle className="h-5 w-5 text-indigo-500" />}
          loading={loading}
          href="/contracts?status=pending_approval"
        />
        <StatCard
          label="Expiring ≤ 90 days"
          value={data?.totals.expiring_soon ?? 0}
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          loading={loading}
          href="/contracts?expiring=90"
        />
      </div>

      {/* Distribution row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* By Risk */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <LoadingBars />
            ) : (data?.by_risk ?? []).length === 0 ? (
              <EmptyChart />
            ) : (
              (data?.by_risk ?? []).map(({ risk_level, count }) => {
                const total = data!.totals.total || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <DistributionRow
                    key={risk_level}
                    label={RISK_LEVEL_LABELS[risk_level as RiskLevel]}
                    count={count}
                    pct={pct}
                    barColor={riskBarColor(risk_level as RiskLevel)}
                    badge={RISK_COLORS[risk_level as RiskLevel]}
                  />
                );
              })
            )}
          </CardContent>
        </Card>

        {/* By Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <LoadingBars />
            ) : (data?.by_status ?? []).length === 0 ? (
              <EmptyChart />
            ) : (
              (data?.by_status ?? []).map(({ status, count }) => {
                const total = data!.totals.total || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <DistributionRow
                    key={status}
                    label={STATUS_LABELS[status as ContractStatus]}
                    count={count}
                    pct={pct}
                    barColor={statusBarColor(status as ContractStatus)}
                    badge={STATUS_COLORS[status as ContractStatus]}
                  />
                );
              })
            )}
          </CardContent>
        </Card>

        {/* By Type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">Contract Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <LoadingBars />
            ) : (data?.by_type ?? []).length === 0 ? (
              <EmptyChart />
            ) : (
              (data?.by_type ?? []).map(({ contract_type, count }) => {
                const total = data!.totals.total || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <DistributionRow
                    key={contract_type}
                    label={CONTRACT_TYPE_LABELS[contract_type as ContractType]}
                    count={count}
                    pct={pct}
                    barColor="bg-primary"
                  />
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly uploads */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-gray-700">Monthly Uploads</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (data?.uploads_per_month ?? []).length === 0 ? (
            <EmptyChart label="No upload history yet" />
          ) : (
            <div className="flex items-end gap-2 h-36 overflow-x-auto pb-2">
              {(data?.uploads_per_month ?? []).map(({ month, count }) => {
                const heightPct = maxMonthCount > 0 ? (count / maxMonthCount) * 100 : 0;
                return (
                  <div key={month} className="flex flex-col items-center gap-1 min-w-[40px] flex-1">
                    <span className="text-[11px] font-medium text-gray-700">{count}</span>
                    <div className="w-full rounded-t-sm bg-primary/20 flex items-end" style={{ height: "96px" }}>
                      <div
                        className="w-full rounded-t-sm bg-primary transition-all"
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 text-center leading-tight">
                      {formatMonth(month)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-gray-700">Recent Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (data?.recent_activity ?? []).length === 0 ? (
            <EmptyChart label="No activity yet" />
          ) : (
            <div className="divide-y">
              {(data?.recent_activity ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{formatAction(a.action)}</p>
                      <p className="text-xs text-gray-500 capitalize">{a.entity_type}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 ml-4 shrink-0">{formatDateTime(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  loading,
  href,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  loading: boolean;
  href?: string;
}) {
  const card = (
    <Card className={href ? "hover:shadow-md transition-shadow cursor-pointer" : undefined}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-12" />
        ) : (
          <p className="text-3xl font-bold text-gray-900">{value ?? 0}</p>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function DistributionRow({
  label,
  count,
  pct,
  barColor,
  badge,
}: {
  label: string;
  count: number;
  pct: number;
  barColor: string;
  badge?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 min-w-0">
          {badge && (
            <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", dotColor(badge))} />
          )}
          <span className="text-gray-700 truncate">{label}</span>
        </div>
        <span className="text-gray-500 ml-2 shrink-0">{count} ({pct}%)</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div
          className={cn("h-1.5 rounded-full transition-all", barColor)}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

function LoadingBars() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ label = "No data yet" }: { label?: string }) {
  return (
    <p className="text-sm text-gray-400 py-4 text-center">{label}</p>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskBarColor(level: RiskLevel): string {
  return { low: "bg-emerald-500", medium: "bg-amber-500", high: "bg-orange-500", critical: "bg-red-500" }[level] ?? "bg-gray-400";
}

function statusBarColor(status: ContractStatus): string {
  return { uploaded: "bg-blue-500", processing: "bg-violet-500", analyzed: "bg-emerald-500", failed: "bg-red-500" }[status] ?? "bg-gray-400";
}

function dotColor(badgeClass: string): string {
  if (badgeClass.includes("emerald")) return "bg-emerald-500";
  if (badgeClass.includes("amber")) return "bg-amber-500";
  if (badgeClass.includes("orange")) return "bg-orange-500";
  if (badgeClass.includes("red")) return "bg-red-500";
  if (badgeClass.includes("blue")) return "bg-blue-500";
  if (badgeClass.includes("violet")) return "bg-violet-500";
  return "bg-gray-400";
}

function formatMonth(iso: string): string {
  try {
    const [year, month] = iso.split("-");
    return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
