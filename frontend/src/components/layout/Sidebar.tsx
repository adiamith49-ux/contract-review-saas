"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  LayoutDashboard, FileSearch, Upload, ClipboardList, Clock, CalendarDays,
  Library, Gavel, UserCheck, LineChart, Settings, User, Lock, CreditCard,
  LifeBuoy, LogOut, ChevronDown, ChevronsLeft, ChevronsRight, Menu, X,
  GitCompare, MessagesSquare, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";
import { NavTimer } from "./NavTimer";

const COLLAPSE_KEY = "contralyne_sidebar_collapsed";

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  { label: "Dashboard",      href: "/dashboard", icon: LayoutDashboard },
  { label: "All Contracts",  href: "/contracts", icon: FileSearch },
  { label: "New Request",    href: "/upload",    icon: Upload },
  { label: "Tasks",          href: "/tasks",      icon: ClipboardList },
  { label: "Time",           href: "/time",       icon: Clock },
  { label: "Calendar",       href: "/calendar",   icon: CalendarDays },
];

const TOOLS_NAV = [
  { label: "Clause Library",  href: "/clauses",   icon: Library },
  { label: "Review Rules",    href: "/rules",     icon: Gavel },
  { label: "Approval Matrix", href: "/approvals", icon: UserCheck },
  { label: "Analytics",       href: "/analytics", icon: LineChart },
];

// Consolidated per-contract panels — shown as the primary nav while a
// specific contract is open, selected via the ?panel= query param.
const CONTRACT_TABS = [
  { key: "intake",    label: "Legal Intake", icon: ClipboardList },
  { key: "approval",  label: "Approval",     icon: UserCheck },
  { key: "versions",  label: "Versions",     icon: GitCompare },
  { key: "workspace", label: "Workspace",    icon: MessagesSquare },
] as const;

function useIsActive(href: string) {
  const pathname = usePathname();
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

function NavItem({ href, label, icon: Icon, onClick, collapsed }: {
  href: string; label: string; icon: React.ElementType; onClick?: () => void; collapsed?: boolean;
}) {
  const active = useIsActive(href);
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2" : "gap-3 px-3",
        active ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && label}
    </Link>
  );
}

// Contract-context tab item: toggles the ?panel= query param on the current
// contract route (clicking the active tab again clears it, closing the panel).
function ContractTabItem({ contractId, tabKey, label, icon: Icon, collapsed, onClick }: {
  contractId: string; tabKey: string; label: string; icon: React.ElementType; collapsed?: boolean; onClick?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("panel") === tabKey;

  function handleClick() {
    router.push(active ? `/contracts/${contractId}` : `/contracts/${contractId}?panel=${tabKey}`, { scroll: false });
    onClick?.();
  }

  return (
    <button
      onClick={handleClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex w-full items-center rounded-md py-2 text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2" : "gap-3 px-3",
        active ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && label}
    </button>
  );
}

// ─── Profile dropdown ─────────────────────────────────────────────────────────

function ProfileMenu({ collapsed }: { collapsed?: boolean }) {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();

  const fullName  = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "My Account";
  const email     = user?.primaryEmailAddress?.emailAddress ?? "";
  const avatarUrl = user?.imageUrl;
  const initials  = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") || "U";

  const menuSections = [
    [
      { label: "My Profile", icon: User, action: () => openUserProfile() },
      { label: "Change Password", icon: Lock, action: () => openUserProfile() },
    ],
    [
      { label: "Billing & Plan", icon: CreditCard, href: "/settings" },
      { label: "Analytics Dashboard", icon: LineChart, href: "/analytics" },
    ],
    [
      { label: "Support", icon: LifeBuoy, href: "mailto:rajasaipranv0@gmail.com", external: true },
    ],
  ];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "flex w-full items-center rounded-md py-1.5 transition-colors hover:bg-white/10 outline-none",
            collapsed ? "justify-center px-1" : "gap-2.5 px-2"
          )}
          aria-label="Open profile menu"
          title={collapsed ? fullName : undefined}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={fullName} className="h-7 w-7 rounded-full object-cover ring-2 ring-white/20 shrink-0" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <span className="text-[11px] font-bold text-white uppercase">{initials}</span>
            </div>
          )}
          {!collapsed && (
            <>
              <span className="flex-1 min-w-0 text-left">
                <span className="block text-sm font-medium text-white truncate">{user?.firstName ?? "Account"}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-white/40 shrink-0" />
            </>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={10} align="start" side="top"
          className="z-50 w-64 rounded-xl bg-white shadow-2xl border border-gray-100 py-1.5 animate-in fade-in-0 zoom-in-95"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={fullName} className="h-9 w-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white uppercase">{initials}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{fullName}</p>
                <p className="text-xs text-gray-400 truncate">{email}</p>
              </div>
            </div>
          </div>

          {menuSections.map((section, si) => (
            <div key={si}>
              {si > 0 && <DropdownMenu.Separator className="my-1 h-px bg-gray-100 mx-2" />}
              {section.map((item) => (
                <DropdownMenu.Item key={item.label} asChild>
                  {"href" in item ? (
                    <Link
                      href={item.href}
                      target={"external" in item && item.external ? "_blank" : undefined}
                      rel={"external" in item && item.external ? "noopener noreferrer" : undefined}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 outline-none cursor-pointer transition-colors mx-1 rounded-lg"
                    >
                      <item.icon className="h-4 w-4 text-gray-400 shrink-0" />
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      onClick={item.action}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 outline-none cursor-pointer transition-colors mx-1 rounded-lg"
                    >
                      <item.icon className="h-4 w-4 text-gray-400 shrink-0" />
                      {item.label}
                    </button>
                  )}
                </DropdownMenu.Item>
              ))}
            </div>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-gray-100 mx-2" />
          <DropdownMenu.Item asChild>
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 outline-none cursor-pointer transition-colors mx-1 rounded-lg"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ─── Sidebar body (shared between desktop + mobile) ───────────────────────────

function SidebarBody({
  onNavigate, collapsed, onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const contractMatch = pathname.match(/^\/contracts\/([^/]+)/);
  const contractId = contractMatch?.[1];

  return (
    <>
      {/* Logo + collapse toggle */}
      <div className={cn("flex h-14 items-center border-b border-white/10 shrink-0", collapsed ? "justify-center px-2" : "gap-2 px-4")}>
        <Link href="/dashboard" onClick={onNavigate} className={cn("flex items-center min-w-0", !collapsed && "flex-1")}>
          {collapsed ? (
            <ContralyneLogoMark className="h-7 w-7" onDark />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/name-logo.png" alt="Contralyne" className="h-6 w-auto" />
          )}
        </Link>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center h-6 w-6 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Timer — placed right up top so it's always in view */}
      <div className="px-3 pt-3 shrink-0">
        <NavTimer collapsed={collapsed} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {contractId ? (
          <div className="space-y-0.5">
            {!collapsed && (
              <Link
                href="/contracts"
                onClick={onNavigate}
                className="flex items-center gap-2 px-3 pb-2 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All Contracts
              </Link>
            )}
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">This Contract</p>
            )}
            {CONTRACT_TABS.map((t) => (
              <ContractTabItem
                key={t.key}
                contractId={contractId}
                tabKey={t.key}
                label={t.label}
                icon={t.icon}
                collapsed={collapsed}
                onClick={onNavigate}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {NAV.map((item) => <NavItem key={item.href} {...item} onClick={onNavigate} collapsed={collapsed} />)}
          </div>
        )}

        <div>
          {!collapsed && <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">Tools</p>}
          <div className="space-y-0.5">
            {TOOLS_NAV.map((item) => <NavItem key={item.href} {...item} onClick={onNavigate} collapsed={collapsed} />)}
          </div>
        </div>
      </nav>

      {/* Bottom — settings, profile */}
      <div className="border-t border-white/10 px-3 py-3 space-y-2 shrink-0">
        <NavItem href="/settings" label="Settings" icon={Settings} onClick={onNavigate} collapsed={collapsed} />
        <ProfileMenu collapsed={collapsed} />
      </div>
    </>
  );
}

// ─── Public sidebar (desktop fixed + mobile slide-over) ───────────────────────

export function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  const [collapsed, setCollapsed] = useState(false);

  // Restore the collapsed preference after mount (kept out of the initial
  // render so server and client markup match on first paint).
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <>
      {/* Desktop — fixed left column */}
      <aside className={cn("hidden lg:flex h-screen flex-col bg-[#0F2A2A] shrink-0 transition-[width] duration-150", collapsed ? "w-16" : "w-60")}>
        <SidebarBody collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {/* Mobile — slide-over (always expanded) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={onCloseMobile} />
          <aside className="relative z-50 flex h-screen w-64 flex-col bg-[#0F2A2A]">
            <button
              onClick={onCloseMobile}
              className="absolute right-3 top-3 z-10 rounded-md p-1 text-white/50 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarBody onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  );
}

// ─── Mobile top bar (hamburger + logo) ─────────────────────────────────────────

export function MobileTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-[#0F2A2A] shrink-0">
      <button onClick={onOpenMenu} className="p-1.5 rounded text-white/60 hover:text-white" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/name-logo.png" alt="Contralyne" className="h-5 w-auto" />
    </div>
  );
}
