"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Clock, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

// Top-level (outside the (dashboard) group) — OrgGate sends a `pending`
// organization here, and OrgGate itself only wraps (dashboard), so this
// page must not be nested there or it would never render.
export default function OrganizationPendingPage() {
  const { signOut } = useClerk();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  function checkAgain() {
    setChecking(true);
    // Reloading THIS page is a no-op — it has no gate logic of its own.
    // Navigating into (dashboard) re-runs OrgGate's /api/org/me check.
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-2.5">
        <ContralyneLogoMark className="h-9 w-9" />
        <span className="text-2xl font-bold tracking-tight text-[#0F2A2A]">Contralyne</span>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <Clock className="h-6 w-6 text-amber-500" />
        </div>

        <h1 className="text-lg font-semibold text-gray-900">Setting up your organization</h1>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          Your organization is being finalized — this usually takes only a few seconds after
          accepting an invitation. If this doesn&apos;t clear after a minute, contact support.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <Button onClick={checkAgain} disabled={checking} className="w-full gap-2">
            <RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {checking ? "Checking…" : "Check again"}
          </Button>
          <Button
            variant="outline"
            onClick={() => signOut({ redirectUrl: "/" })}
            className="w-full gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-400 text-center max-w-sm">
        Questions about your organization&apos;s status? Contact support@contralyne.com.
      </p>
    </div>
  );
}
