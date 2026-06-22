"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Users, FileText, Ticket, ArrowRight } from "lucide-react";
import { getAdminStats, listAdminTickets, type AdminStats, type AdminTicket } from "@/lib/admin-api";
import { formatDate } from "@/lib/utils";
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

export default function AdminDashboard() {
  const [stats, setStats]     = useState<AdminStats | null>(null);
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAdminStats(), listAdminTickets("open")])
      .then(([s, t]) => { setStats(s); setTickets(t.tickets.slice(0, 5)); })
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: "Clients",       value: stats?.clients,      icon: Building2, color: "text-blue-600",    bg: "bg-blue-50"   },
    { label: "Total Users",   value: stats?.users,        icon: Users,     color: "text-violet-600",  bg: "bg-violet-50" },
    { label: "Contracts",     value: stats?.contracts,    icon: FileText,  color: "text-emerald-600", bg: "bg-emerald-50"},
    { label: "Open Tickets",  value: stats?.open_tickets, icon: Ticket,    color: "text-red-600",     bg: "bg-red-50"    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-7">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage clients, users, content, and change requests.</p>
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

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: "/admin/clients",   label: "Manage Clients",  icon: Building2 },
          { href: "/admin/users",     label: "Manage Users",    icon: Users     },
          { href: "/admin/clauses",   label: "Clause Library",  icon: FileText  },
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
