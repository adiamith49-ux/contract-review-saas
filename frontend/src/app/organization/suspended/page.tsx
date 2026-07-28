"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { ShieldAlert, RefreshCw, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

// Top-level (outside the (dashboard) group) — OrgGate sends both `suspended`
// and `deleted` organizations here.
export default function OrganizationSuspendedPage() {
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
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
          <ShieldAlert className="h-6 w-6 text-blue-500" />
        </div>

        <h1 className="text-lg font-semibold text-gray-900">Access to this organization has been suspended</h1>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          Your organization&apos;s access to Contralyne is currently suspended. If you believe
          this is a mistake, or want to find out what&apos;s needed to restore access, please
          reach out to our support team.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <Button asChild className="w-full gap-2">
            <a href="mailto:support@contralyne.com">
              <Mail className="h-4 w-4" />
              Contact support
            </a>
          </Button>
          <Button variant="outline" onClick={checkAgain} disabled={checking} className="w-full gap-2">
            <RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {checking ? "Checking…" : "Check again"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => signOut({ redirectUrl: "/" })}
            className="w-full gap-2 text-gray-500"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-400 text-center max-w-sm">
        support@contralyne.com
      </p>
    </div>
  );
}
