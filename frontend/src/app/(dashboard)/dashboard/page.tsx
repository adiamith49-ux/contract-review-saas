"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  FileText, Upload, CheckCircle2, Clock, ShieldAlert, Plus,
  ArrowRight, TrendingUp, LineChart, Library, Gavel, Building2,
  CalendarCheck2, CalendarX2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { listContracts, type ContractListItem } from "@/lib/api";
import { formatDate, formatFileSize, CONTRACT_TYPE_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/types";

// ─── Risk visual config ───────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, { bar: string; dot: string; label: string }> = {
  critical: { bar: "bg-red-500",    dot: "bg-red-500",    label: "Critical" },
  high:     { bar: "bg-orange-500", dot: "bg-orange-500", label: "High"     },
  medium:   { bar: "bg-amber-400",  dot: "bg-amber-400",  label: "Medium"   },
  low:      { bar: "bg-emerald-500",dot: "bg-emerald-500",label: "Low"      },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

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
        // silently fail on dashboard
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const total    = contracts.length;
  const analyzed = contracts.filter(c => c.status === "analyzed").length;
  const highRisk = contracts.filter(
    c => c.analyses?.[0]?.risk_level === "high" || c.analyses?.[0]?.risk_level === "critical"
  ).length;
  const pending  = contracts.filter(c => c.status === "uploaded" || c.status === "processing").length;

  // Mirrors the backend lifecycle filters (GET /api/contracts?lifecycle=…)
  const today   = new Date().toISOString().slice(0, 10);
  const active  = contracts.filter(
    c => c.contract_status === "executed" && (!c.end_date || c.end_date.slice(0, 10) >= today)
  ).length;
  const expired = contracts.filter(
    c => c.end_date !== null && c.end_date.slice(0, 10) < today
  ).length;

  const recent = contracts.slice(0, 6);

  const riskCounts = contracts.reduce((acc, c) => {
    const level = c.analyses?.[0]?.risk_level as RiskLevel | undefined;
    if (level) acc[level] = (acc[level] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<RiskLevel, number>>);

  const firstName = user?.firstName ?? "there";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const analyzeRate = total > 0 ? Math.round((analyzed / total) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1280px] mx-auto space-y-7">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{todayLabel}</p>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{greeting}, {firstName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading your workspace…" :
             total === 0 ? "Upload your first contract to get started." :
             `${total} contract${total !== 1 ? "s" : ""}${pending > 0 ? ` · ${pending} pending review` : " · all up to date"}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm">
            <Link href="/upload">
              <Plus className="h-4 w-4 mr-1.5" />
              New Contract Request
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total"
          value={loading ? undefined : total}
          sub="All uploaded contracts"
          icon={<FileText className="h-5 w-5" />}
          iconColor="bg-blue-100 text-blue-600"
          accent="border-l-blue-500"
        />
        <StatCard
          label="Analyzed"
          value={loading ? undefined : analyzed}
          sub={loading ? "" : `${analyzeRate}% completion rate`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="bg-emerald-100 text-emerald-600"
          accent="border-l-emerald-500"
        />
        <StatCard
          label="Active"
          value={loading ? undefined : active}
          sub="Executed & in force"
          icon={<CalendarCheck2 className="h-5 w-5" />}
          iconColor="bg-teal-100 text-teal-600"
          accent="border-l-teal-500"
        />
        <StatCard
          label="Expired"
          value={loading ? undefined : expired}
          sub="Past their end date"
          icon={<CalendarX2 className="h-5 w-5" />}
          iconColor="bg-amber-100 text-amber-600"
          accent="border-l-amber-500"
        />
        <StatCard
          label="High Risk"
          value={loading ? undefined : highRisk}
          sub="High or critical risk — requires attention"
          icon={<ShieldAlert className="h-5 w-5" />}
          iconColor="bg-red-100 text-red-600"
          accent="border-l-red-500"
        />
        <StatCard
          label="Pending"
          value={loading ? undefined : pending}
          sub="Awaiting AI analysis"
          icon={<Clock className="h-5 w-5" />}
          iconColor="bg-violet-100 text-violet-600"
          accent="border-l-violet-500"
        />
      </div>

      {/* ── Main content grid ────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Recent contracts (left, 3/5) */}
        <div className="lg:col-span-3 rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold text-gray-900">Recent Contracts</h2>
            <Link href="/contracts" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-4">
                  <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyContracts />
          ) : (
            <div className="divide-y">
              {recent.map(c => (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.filename}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {CONTRACT_TYPE_LABELS[c.contract_type]} · {formatFileSize(c.file_size)} · {formatDate(c.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.analyses?.[0] && <RiskBadge level={c.analyses[0].risk_level} />}
                    <StatusBadge status={c.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column (2/5) */}
        <div className="lg:col-span-2 space-y-4">

          {/* Quick actions */}
          <div className="rounded-xl border bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href="/upload"
                className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white bg-primary hover:opacity-90 transition-opacity"
              >
                <Upload className="h-4 w-4 shrink-0" />
                New Contract Request
              </Link>
              {[
                { label: "Clients",               href: "/clients",   icon: Building2 },
                { label: "Browse All Contracts",  href: "/contracts", icon: FileText  },
                { label: "Clause Library",        href: "/clauses",   icon: Library   },
                { label: "Playbooks",             href: "/rules",     icon: Gavel     },
                { label: "Analytics",             href: "/analytics", icon: LineChart },
              ].map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Risk snapshot */}
          <div className="rounded-xl border bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-gray-900">Risk Snapshot</h2>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : Object.keys(riskCounts).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-5">
                No analyzed contracts yet — risk distribution will appear here
              </p>
            ) : (
              <div className="space-y-3">
                {(["critical", "high", "medium", "low"] as RiskLevel[]).map(level => {
                  const count = riskCounts[level] ?? 0;
                  if (!count) return null;
                  const riskTotal = Object.values(riskCounts).reduce((a, b) => a + (b ?? 0), 0);
                  const pct = riskTotal > 0 ? Math.round((count / riskTotal) * 100) : 0;
                  const { bar, dot, label } = RISK_CONFIG[level];
                  return (
                    <div key={level} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                          <span className="text-gray-600 font-medium">{label}</span>
                        </div>
                        <span className="text-gray-400">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div
                          className={cn("h-1.5 rounded-full transition-all duration-500", bar)}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, iconColor, accent,
}: {
  label: string;
  value: number | undefined;
  sub: string;
  icon: React.ReactNode;
  iconColor: string;
  accent: string;
}) {
  return (
    <div
      className={cn("rounded-lg border bg-white shadow-sm border-l-4 px-3.5 py-3 flex items-center gap-3", accent)}
      title={sub}
    >
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", iconColor)}>
        {icon}
      </div>
      <div className="min-w-0">
        {value === undefined
          ? <Skeleton className="h-6 w-10" />
          : <p className="text-xl font-bold text-gray-900 leading-none tabular-nums">{value}</p>}
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyContracts() {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
        <Upload className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-700">No contracts yet</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">
        Upload a PDF or DOCX contract to get AI-powered risk analysis and negotiation guidance.
      </p>
      <Button asChild size="sm" className="mt-5">
        <Link href="/upload">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Upload your first contract
        </Link>
      </Button>
    </div>
  );
}
