"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Users, FileText, Ticket, ArrowRight, Download } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import {
  getAdminStats, listAdminTickets, downloadAdminReport,
  type AdminStats, type AdminTicket,
} from "@/lib/admin-api";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TICKET_STATUS_COLORS: Record<string, string> = {
  open:        "bg-red-100 text-red-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved:    "bg-emerald-100 text-emerald-700",
};

const TICKET_TYPE_LABELS: Record<string, string> = {
  clause_change:   "Clause Change",
  playbook_change: "Playbook Change",
  other:           "Other",
};

const RISK_CHART_COLORS: Record<string, string> = {
  low:      "#10b981",
  medium:   "#f59e0b",
  high:     "#f97316",
  critical: "#ef4444",
};

const TYPE_LABELS: Record<string, string> = {
  nda: "NDA", msa: "MSA", saas: "SaaS", sow: "SOW",
  order_form: "Order Form", employment: "Employment",
  vendor_agreement: "Vendor", other: "Other",
};

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

export default function AdminDashboard() {
  const [stats, setStats]     = useState<AdminStats | null>(null);
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    Promise.all([getAdminStats(), listAdminTickets("open")])
      .then(([s, t]) => { setStats(s); setTickets(t.tickets.slice(0, 5)); })
      .finally(() => setLoading(false));
  }, []);

  async function handleDownloadReport() {
    setDownloading(true);
    try {
      await downloadAdminReport("dashboard");
      toast.success("Dashboard report downloaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  }

  const statCards = [
    { label: "Clients",       value: stats?.clients,      icon: Building2, color: "text-blue-600",    bg: "bg-blue-50"   },
    { label: "Total Users",   value: stats?.users,        icon: Users,     color: "text-violet-600",  bg: "bg-violet-50" },
    { label: "Contracts",     value: stats?.contracts,    icon: FileText,  color: "text-emerald-600", bg: "bg-emerald-50"},
    { label: "Open Tickets",  value: stats?.open_tickets, icon: Ticket,    color: "text-red-600",     bg: "bg-red-50"    },
  ];

  const uploads = stats?.charts?.uploads_per_month ?? [];
  const uploadData = uploads.map((u) => ({ ...u, label: monthLabel(u.month) }));
  const riskData = (stats?.charts?.risk_breakdown ?? []).filter((r) => r.count > 0);
  const totalAnalyzed = riskData.reduce((sum, r) => sum + r.count, 0);
  const typeData = stats?.charts?.contracts_by_type ?? [];
  const maxTypeCount = Math.max(1, ...typeData.map((t) => t.count));

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage clients, users, content, and change requests.</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleDownloadReport} disabled={downloading}>
          <Download className="h-4 w-4 mr-1.5" />
          {downloading ? "Preparing…" : "Download Report"}
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border shadow-sm p-5">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", bg)}>
              <Icon className={cn("h-5 w-5", color)} />
            </div>
            {loading || value === undefined
              ? <Skeleton className="h-8 w-12 mb-1" />
              : <p className="text-3xl font-bold text-gray-900 tabular-nums">{value}</p>}
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Uploads per month */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900">Contract uploads</h2>
          <p className="text-xs text-gray-400 mb-4">Last 6 months</p>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={uploadData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="count" name="Uploads" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Risk breakdown donut */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900">Risk breakdown</h2>
          <p className="text-xs text-gray-400 mb-2">Analyzed contracts</p>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : riskData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-gray-400">
              No analyses yet
            </div>
          ) : (
            <>
              <div className="h-40 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      dataKey="count"
                      nameKey="risk"
                      innerRadius={48}
                      outerRadius={68}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {riskData.map((r) => (
                        <Cell key={r.risk} fill={RISK_CHART_COLORS[r.risk] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xl font-bold text-gray-900 tabular-nums">{totalAnalyzed}</p>
                  <p className="text-[10px] text-gray-400">analyzed</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {riskData.map((r) => (
                  <div key={r.risk} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: RISK_CHART_COLORS[r.risk] ?? "#94a3b8" }} />
                    <span className="capitalize text-gray-600">{r.risk}</span>
                    <span className="ml-auto font-medium text-gray-900 tabular-nums">{r.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contracts by type */}
      {!loading && typeData.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Contracts by type</h2>
          <div className="space-y-2.5">
            {typeData.map((t) => (
              <div key={t.type} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-24 shrink-0">{TYPE_LABELS[t.type] ?? t.type}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${(t.count / maxTypeCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-900 tabular-nums w-8 text-right">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: "/admin/clients",   label: "Manage Clients",  icon: Building2 },
          { href: "/admin/users",     label: "Manage Users",    icon: Users     },
          { href: "/admin/contracts", label: "All Contracts",   icon: FileText  },
          { href: "/admin/playbooks", label: "Playbooks",       icon: FileText  },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between gap-2 rounded-xl border bg-white p-4 hover:bg-gray-50 transition-colors group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <Icon className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </Link>
        ))}
      </div>

      {/* Open tickets */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Open Change Requests</h2>
          <Link href="/admin/tickets" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {loading ? (
          <div className="divide-y">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-5 py-4 flex items-center gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No open tickets</div>
        ) : (
          <div className="divide-y">
            {tickets.map(t => (
              <Link
                key={t.id}
                href="/admin/tickets"
                className="flex items-start justify-between gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {TICKET_TYPE_LABELS[t.type] ?? t.type}
                    {t.reference_name && ` — ${t.reference_name}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.description}</p>
                  <p className="text-[11px] text-gray-300 mt-0.5">{formatDate(t.created_at)}</p>
                </div>
                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5", TICKET_STATUS_COLORS[t.status])}>
                  {t.status.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
