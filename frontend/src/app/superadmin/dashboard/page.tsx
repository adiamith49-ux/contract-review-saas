"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Landmark, Building2, Users, FileText, Ticket, ArrowRight, Server } from "lucide-react";
import {
  getSuperAdminStats, getSystemInfo,
  type SuperAdminStats, type SystemInfo,
} from "@/lib/superadmin-api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function SuperAdminDashboard() {
  const [stats, setStats]   = useState<SuperAdminStats | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSuperAdminStats(), getSystemInfo()])
      .then(([s, sys]) => { setStats(s); setSystem(sys); })
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: "Organizations", value: stats?.organizations, icon: Landmark,  color: "text-teal-600",    bg: "bg-teal-50"   },
    { label: "Clients",       value: stats?.clients,       icon: Building2, color: "text-blue-600",    bg: "bg-blue-50"   },
    { label: "Total Users",   value: stats?.users,         icon: Users,     color: "text-violet-600",  bg: "bg-violet-50" },
    { label: "Contracts",     value: stats?.contracts,     icon: FileText,  color: "text-emerald-600", bg: "bg-emerald-50"},
    { label: "Open Tickets",  value: stats?.open_tickets,  icon: Ticket,    color: "text-red-600",     bg: "bg-red-50"    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-7">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Super Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">Platform-wide overview across every organization.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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

      <Link
        href="/superadmin/organizations"
        className="flex items-center justify-between gap-2 rounded-xl border bg-white p-4 hover:bg-gray-50 transition-colors group shadow-sm max-w-sm"
      >
        <div className="flex items-center gap-2.5">
          <Landmark className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Manage Organizations</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </Link>

      {/* System health */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">System health</h2>
          {system && (
            <span className={cn(
              "ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full capitalize",
              system.status === "healthy" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
            )}>
              {system.status}
            </span>
          )}
        </div>
        {loading || !system ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            {Object.entries(system.services).map(([key, svc]) => (
              <div key={key} className="rounded-lg border px-3 py-2.5">
                <p className="text-gray-400 uppercase tracking-wide text-[10px]">{key}</p>
                <p className="font-medium text-gray-800 mt-0.5">{svc.provider}</p>
                <p className={cn("mt-1 text-[11px]", ("connected" in svc ? svc.connected : svc.configured) ? "text-emerald-600" : "text-red-600")}>
                  {("connected" in svc ? svc.connected : svc.configured) ? "OK" : "Not configured"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
