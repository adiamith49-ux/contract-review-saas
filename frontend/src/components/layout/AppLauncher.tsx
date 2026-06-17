"use client";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  LayoutGrid,
  FileSearch,
  ClipboardList,
  Clock,
  CalendarDays,
  LineChart,
  Library,
  Gavel,
  Settings,
} from "lucide-react";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

const APPS = [
  { label: "Contracts",     href: "/contracts",  icon: FileSearch,    color: "bg-blue-50   text-blue-600"    },
  { label: "Tasks",         href: "/tasks",       icon: ClipboardList, color: "bg-violet-50 text-violet-600"  },
  { label: "Time",          href: "/time",        icon: Clock,         color: "bg-teal-50   text-teal-600"    },
  { label: "Calendar",      href: "/calendar",    icon: CalendarDays,  color: "bg-orange-50 text-orange-600"  },
  { label: "Analytics",     href: "/analytics",   icon: LineChart,     color: "bg-indigo-50 text-indigo-600"  },
  { label: "Clause Library",href: "/clauses",     icon: Library,       color: "bg-emerald-50 text-emerald-600"},
  { label: "Review Rules",  href: "/rules",       icon: Gavel,         color: "bg-red-50    text-red-600"     },
  { label: "Settings",      href: "/settings",    icon: Settings,      color: "bg-gray-100  text-gray-600"    },
];

export function AppLauncher() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors outline-none"
          aria-label="App launcher"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={10}
          align="start"
          className="z-50 w-72 rounded-2xl bg-white shadow-2xl border border-gray-100 p-4 animate-in fade-in-0 zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <ContralyneLogoMark className="h-6 w-6" />
            <span className="text-sm font-bold text-gray-900 tracking-tight">Contralyne</span>
          </div>

          {/* App grid */}
          <div className="grid grid-cols-3 gap-1">
            {APPS.map((app) => (
              <DropdownMenu.Item key={app.href} asChild>
                <Link
                  href={app.href}
                  className="flex flex-col items-center gap-2 rounded-xl p-3 hover:bg-gray-50 transition-colors outline-none cursor-pointer group"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${app.color} transition-transform group-hover:scale-105`}>
                    <app.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-medium text-gray-600 text-center leading-tight group-hover:text-gray-900">
                    {app.label}
                  </span>
                </Link>
              </DropdownMenu.Item>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
