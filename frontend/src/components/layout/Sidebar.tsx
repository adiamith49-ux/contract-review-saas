"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Scale,
  BookOpen,
  ShieldCheck,
  BarChart3,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Contract", icon: Upload },
  { href: "/contracts", label: "All Contracts", icon: FileText },
];

const toolsNav = [
  { href: "/clauses", label: "Clause Library", icon: BookOpen },
  { href: "/rules", label: "Review Rules", icon: ShieldCheck },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
    const active = isActive(href);
    return (
      <Link
        href={href}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </Link>
    );
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white shrink-0">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight text-gray-900">Contralyne</span>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* Main section */}
        <div className="space-y-1">
          {mainNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Tools section */}
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Tools
          </p>
          {toolsNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      </nav>

      {/* Bottom — Settings + User */}
      <div className="border-t px-3 py-3 space-y-1">
        <Link
          href="/settings"
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive("/settings")
              ? "bg-primary/10 text-primary"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>

        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <UserButton afterSignOutUrl="/sign-in" />
          <span className="text-sm text-gray-600 truncate">My Account</span>
        </div>
      </div>
    </aside>
  );
}
