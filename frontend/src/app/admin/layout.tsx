"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard, Building2, Users, Library, Gavel,
  Ticket, LogOut, Menu, X, FileText, ClipboardList, Receipt, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrgMe } from "@/lib/org-api";
import { useAutoActiveOrg } from "@/lib/useAutoActiveOrg";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

// This is the SAME admin panel every organization uses — scoped to the
// caller's own org via Clerk's org_id claim (see backend/src/routes/org.ts).
// Auth here is Clerk, not the separate super admin bcrypt/JWT system: only a
// signed-in user with org_role "org:admin" in an active organization may in.

const nav = [
  { href: "/admin/dashboard", label: "Dashboard",      icon: LayoutDashboard },
  { href: "/admin/clients",   label: "Clients",        icon: Building2       },
  { href: "/admin/users",     label: "Users",          icon: Users           },
  { href: "/admin/contracts", label: "Contracts",      icon: FileText        },
  { href: "/admin/tasks",     label: "Tasks",          icon: ClipboardList   },
  { href: "/admin/billing",   label: "Billing",        icon: Receipt         },
  { href: "/admin/clauses",   label: "Clause Library", icon: Library         },
  { href: "/admin/playbooks", label: "Playbooks",      icon: Gavel           },
  { href: "/admin/tickets",   label: "Tickets",        icon: Ticket          },
  { href: "/admin/settings", label: "Org Settings", icon: Settings          },
];

function AdminSidebar({ orgName, onClose }: { orgName: string | null; onClose?: () => void }) {
  const pathname = usePathname();
  const { signOut } = useClerk();

  return (
    <aside className="flex h-screen w-60 flex-col bg-[#0F2A2A] text-[#D9FAF4] shrink-0">
      <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <ContralyneLogoMark className="h-8 w-8" onDark />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight truncate">{orgName ?? "Contralyne"}</p>
            <p className="text-[10px] text-[#D9FAF4]/50 -mt-0.5">Admin Panel</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-100 lg:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[#00BFA6] text-white"
                  : "text-[#D9FAF4]/55 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3 space-y-2">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[#D9FAF4]/55 hover:bg-white/10 hover:text-white transition-colors"
        >
          <ArrowLeftIcon />
          Back to workspace
        </Link>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[#D9FAF4]/55 hover:bg-white/10 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

type GateState = "checking" | "ok" | "denied";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn, orgRole } = useAuth();
  const orgReady = useAutoActiveOrg();
  const [gate, setGate] = useState<GateState>("checking");
  const [orgName, setOrgName] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    if (!orgReady) return;

    let cancelled = false;
    (async () => {
      try {
        // skipCache matters right after useAutoActiveOrg calls setActive():
        // Clerk's local session state (useAuth().orgId) updates immediately,
        // but a cached JWT minted just before that can still be served for
        // its remaining TTL, silently missing the new org_id/org_role claims.
        const token = await getToken({ skipCache: true });
        const me = await getOrgMe(token);
        if (cancelled) return;

        if (me.status === "no_organization") { router.replace("/organization/none"); return; }
        if (me.status === "pending") { router.replace("/organization/pending"); return; }
        if (me.status === "suspended" || me.status === "deleted") { router.replace("/organization/suspended"); return; }
        if (me.role !== "org:admin") { router.replace("/dashboard"); return; }

        setOrgName(me.name);
        setGate("ok");
      } catch {
        if (!cancelled) router.replace("/dashboard");
      }
    })();

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, orgReady, orgRole, getToken, router]);

  if (gate !== "ok") {
    return (
      <div className="min-h-screen bg-[#0F2A2A] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#D9FAF4]">
      <div className="hidden lg:flex">
        <AdminSidebar orgName={orgName} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50">
            <AdminSidebar orgName={orgName} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-white">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded text-gray-500">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-gray-900">{orgName ?? "Admin"}</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
