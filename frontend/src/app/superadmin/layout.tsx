"use client";
import { useEffect, useState, createContext, useContext } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, Landmark, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { superAdminMe, clearSuperAdminToken, getSuperAdminToken } from "@/lib/superadmin-api";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

// ─── Auth context ─────────────────────────────────────────────────────────────

interface SuperAdminContext { email: string }
const Ctx = createContext<SuperAdminContext | null>(null);
const useSuperAdmin = () => useContext(Ctx);

// ─── Sidebar nav ──────────────────────────────────────────────────────────────
// Deliberately small — everything org-specific (clients, users, contracts,
// clauses, playbooks, tasks, billing, tickets) lives in the per-org /admin
// panel now. This tier only invites/oversees organizations.

const nav = [
  { href: "/superadmin/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/superadmin/organizations", label: "Organizations", icon: Landmark        },
];

function SuperAdminSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const admin    = useSuperAdmin();

  function logout() {
    clearSuperAdminToken();
    router.push("/superadmin/login");
  }

  return (
    <aside className="flex h-screen w-60 flex-col bg-[#0F2A2A] text-[#D9FAF4] shrink-0">
      <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <ContralyneLogoMark className="h-8 w-8" onDark />
          <div>
            <p className="text-sm font-bold tracking-tight">Contralyne</p>
            <p className="text-[10px] text-[#D9FAF4]/50 -mt-0.5">Super Admin</p>
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

      <div className="border-t border-white/10 px-3 py-3">
        <div className="px-3 py-1.5 mb-1">
          <p className="text-[11px] text-[#D9FAF4]/50 truncate">{admin?.email}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[#D9FAF4]/55 hover:bg-white/10 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin]       = useState<SuperAdminContext | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/superadmin/login" || pathname === "/superadmin/setup") {
      setChecking(false);
      return;
    }

    const token = getSuperAdminToken();
    if (!token) {
      router.replace("/superadmin/login");
      return;
    }

    superAdminMe()
      .then(data => { setAdmin({ email: data.email }); setChecking(false); })
      .catch(() => { clearSuperAdminToken(); router.replace("/superadmin/login"); });
  }, [pathname, router]);

  if (pathname === "/superadmin/login" || pathname === "/superadmin/setup") {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0F2A2A] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!admin) return null;

  return (
    <Ctx.Provider value={admin}>
      <div className="flex h-screen overflow-hidden bg-[#D9FAF4]">
        <div className="hidden lg:flex">
          <SuperAdminSidebar />
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <div className="relative z-50">
              <SuperAdminSidebar onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-white">
            <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded text-gray-500">
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-gray-900">Contralyne Super Admin</span>
          </div>

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </Ctx.Provider>
  );
}
