"use client";
import { useEffect, useState, createContext, useContext } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, Library, Gavel,
  Ticket, LogOut, Menu, X, Server, FileText, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminMe, clearAdminToken, getAdminToken } from "@/lib/admin-api";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

// ─── Auth context ─────────────────────────────────────────────────────────────

interface AdminContext { email: string }
const Ctx = createContext<AdminContext | null>(null);
const useAdmin = () => useContext(Ctx);

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

const nav = [
  { href: "/admin/dashboard", label: "Dashboard",     icon: LayoutDashboard },
  { href: "/admin/clients",   label: "Clients",       icon: Building2       },
  { href: "/admin/users",     label: "Users",         icon: Users           },
  { href: "/admin/contracts", label: "Contracts",     icon: FileText        },
  { href: "/admin/tasks",     label: "Tasks",         icon: ClipboardList   },
  { href: "/admin/clauses",   label: "Clause Library",icon: Library         },
  { href: "/admin/playbooks", label: "Playbooks",     icon: Gavel           },
  { href: "/admin/tickets",   label: "Tickets",       icon: Ticket          },
  { href: "/admin/system",    label: "System",        icon: Server          },
];

function AdminSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const admin    = useAdmin();

  function logout() {
    clearAdminToken();
    router.push("/admin/login");
  }

  return (
    <aside className="flex h-screen w-60 flex-col bg-[#0F2A2A] text-[#D9FAF4] shrink-0">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <ContralyneLogoMark className="h-8 w-8" onDark />
          <div>
            <p className="text-sm font-bold tracking-tight">Contralyne</p>
            <p className="text-[10px] text-[#D9FAF4]/50 -mt-0.5">Admin Panel</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-100 lg:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
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

      {/* Bottom */}
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin]       = useState<AdminContext | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login" || pathname === "/admin/setup") {
      setChecking(false);
      return;
    }

    const token = getAdminToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }

    adminMe()
      .then(data => { setAdmin({ email: data.email }); setChecking(false); })
      .catch(() => { clearAdminToken(); router.replace("/admin/login"); });
  }, [pathname, router]);

  // Login and setup pages render without the sidebar
  if (pathname === "/admin/login" || pathname === "/admin/setup") {
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
        {/* Desktop sidebar */}
        <div className="hidden lg:flex">
          <AdminSidebar />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <div className="relative z-50">
              <AdminSidebar onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile topbar */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-white">
            <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded text-gray-500">
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-gray-900">Contralyne Admin</span>
          </div>

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </Ctx.Provider>
  );
}
