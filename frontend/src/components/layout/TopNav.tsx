"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  Upload,
  FileSearch,
  Library,
  Gavel,
  LineChart,
  LayoutDashboard,
  Settings,
  Plus,
  Menu,
  X,
  User,
  Lock,
  CreditCard,
  LifeBuoy,
  LogOut, UserCheck,
} from "lucide-react";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { AppLauncher } from "./AppLauncher";

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Contracts",
    icon: FileSearch,
    dropdown: [
      { label: "All Contracts",   href: "/contracts", icon: FileSearch, desc: "Browse and search all your contracts" },
      { label: "New Contract Request", href: "/upload",    icon: Upload,     desc: "Submit a contract with deal context for review" },
    ],
  },
  {
    label: "Tools",
    icon: Library,
    dropdown: [
      { label: "Clause Library", href: "/clauses", icon: Library, desc: "Save and manage approved clauses" },
      { label: "Review Rules",   href: "/rules",   icon: Gavel,   desc: "Define your firm's playbook"      },
      { label: "Approval Matrix", href: "/approvals", icon: UserCheck, desc: "Route contracts for sign-off by value, risk and team" },
    ],
  },
  { label: "Analytics", href: "/analytics", icon: LineChart },
];

// ─── Active-route helper ──────────────────────────────────────────────────────

function useIsActive(href?: string, dropdown?: { href: string }[]) {
  const pathname = usePathname();
  if (href)     return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  if (dropdown) return dropdown.some((d) => pathname.startsWith(d.href));
  return false;
}

// ─── Nav dropdown (Contracts / Tools) ────────────────────────────────────────

function NavDropdownItem({ item }: {
  item: { label: string; dropdown: { label: string; href: string; icon: React.ElementType; desc: string }[] }
}) {
  const active = useIsActive(undefined, item.dropdown);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors outline-none select-none",
          active ? "text-white bg-white/15" : "text-slate-300 hover:text-white hover:bg-white/10"
        )}>
          {item.label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={10} align="start"
          className="z-50 min-w-[230px] rounded-xl bg-white shadow-xl border border-gray-100 p-1.5 animate-in fade-in-0 zoom-in-95"
        >
          {item.dropdown.map((d) => (
            <DropdownMenu.Item key={d.href} asChild>
              <Link href={d.href} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 outline-none cursor-pointer group">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <d.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{d.desc}</p>
                </div>
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ─── Nav direct link ──────────────────────────────────────────────────────────

function NavLink({ item }: { item: { label: string; href: string } }) {
  const active = useIsActive(item.href);
  return (
    <Link href={item.href} className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
      active ? "text-white bg-white/15" : "text-slate-300 hover:text-white hover:bg-white/10"
    )}>
      {item.label}
    </Link>
  );
}

// ─── Profile dropdown ─────────────────────────────────────────────────────────

function ProfileDropdown() {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();

  const fullName  = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "My Account";
  const email     = user?.primaryEmailAddress?.emailAddress ?? "";
  const avatarUrl = user?.imageUrl;
  const initials  = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") || "U";

  const menuSections = [
    [
      {
        label: "My Profile",
        icon: User,
        action: () => openUserProfile(),
      },
      {
        label: "Change Password",
        icon: Lock,
        action: () => openUserProfile(),
      },
    ],
    [
      {
        label: "Billing & Plan",
        icon: CreditCard,
        href: "/settings",
      },
      {
        label: "Analytics Dashboard",
        icon: LineChart,
        href: "/analytics",
      },
    ],
    [
      {
        label: "Support",
        icon: LifeBuoy,
        href: "mailto:rajasaipranv0@gmail.com",
        external: true,
      },
    ],
  ];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/10 outline-none"
          aria-label="Open profile menu"
        >
          {/* Avatar */}
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={fullName} className="h-7 w-7 rounded-full object-cover ring-2 ring-white/20" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center ring-2 ring-white/20">
              <span className="text-[11px] font-bold text-white uppercase">{initials}</span>
            </div>
          )}
          {/* Name — visible on larger screens */}
          <span className="hidden xl:block text-sm font-medium text-slate-200 max-w-[120px] truncate">
            {user?.firstName ?? "Account"}
          </span>
          <ChevronDown className="hidden xl:block h-3.5 w-3.5 text-slate-400" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={10} align="end"
          className="z-50 w-64 rounded-xl bg-white shadow-2xl border border-gray-100 py-1.5 animate-in fade-in-0 zoom-in-95"
        >
          {/* User info header */}
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

          {/* Menu sections */}
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

          {/* Sign out */}
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

// ─── Mobile menu ──────────────────────────────────────────────────────────────

function MobileMenu({ onClose }: { onClose: () => void }) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  }

  const links = [
    { label: "Dashboard",       href: "/dashboard",  icon: LayoutDashboard },
    { label: "All Contracts",   href: "/contracts",  icon: FileSearch      },
    { label: "New Contract Request", href: "/upload",     icon: Upload          },
    { label: "Clause Library",  href: "/clauses",    icon: Library         },
    { label: "Review Rules",    href: "/rules",      icon: Gavel           },
    { label: "Analytics",       href: "/analytics",  icon: LineChart       },
    { label: "Settings",        href: "/settings",   icon: Settings        },
  ];

  const fullName  = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Account";
  const email     = user?.primaryEmailAddress?.emailAddress ?? "";
  const avatarUrl = user?.imageUrl;
  const initials  = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") || "U";

  return (
    <div className="absolute top-full left-0 right-0 bg-[#1a2035] border-t border-white/10 shadow-2xl z-40 lg:hidden">
      {/* User info */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={fullName} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-xs font-bold text-white uppercase">{initials}</span>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{fullName}</p>
          <p className="text-xs text-slate-400 truncate">{email}</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="p-3 space-y-0.5">
        {links.map((item) => (
          <Link
            key={item.href} href={item.href} onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive(item.href) ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Sign out */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── TopNav ───────────────────────────────────────────────────────────────────

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="relative shrink-0 bg-[#1a2035] border-b border-white/10 z-30">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6">
        <div className="flex h-14 items-center gap-2">

          {/* App launcher */}
          <AppLauncher />

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0 mr-4">
            <ContralyneLogoMark className="h-7 w-7" />
            <span className="text-base font-bold text-white tracking-tight">Contralyne</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1">
            {NAV.map((item) =>
              "dropdown" in item ? (
                <NavDropdownItem key={item.label} item={item as any} />
              ) : (
                <NavLink key={item.label} item={item as any} />
              )
            )}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-1.5">
            {/* Upload shortcut */}
            <Link
              href="/upload"
              className="hidden lg:flex items-center gap-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors mr-1"
            >
              <Plus className="h-3.5 w-3.5" />
              New Request
            </Link>

            {/* Settings icon */}
            <Link
              href="/settings"
              className="hidden lg:flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>

            {/* Profile dropdown */}
            <div className="hidden lg:block">
              <ProfileDropdown />
            </div>

            {/* Mobile hamburger */}
            <button
              className="lg:hidden flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} />}
    </header>
  );
}
