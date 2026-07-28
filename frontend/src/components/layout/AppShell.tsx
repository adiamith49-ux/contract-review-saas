"use client";
import { useState } from "react";
import { Sidebar, MobileTopBar } from "./Sidebar";
import { OrgGate } from "./OrgGate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <OrgGate>
      <div className="h-screen flex overflow-hidden bg-[#D9FAF4]">
        <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <MobileTopBar onOpenMenu={() => setMobileOpen(true)} />
          <main className="flex-1 min-h-0 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </OrgGate>
  );
}
