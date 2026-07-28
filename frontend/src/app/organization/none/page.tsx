"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Mail, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContralyneLogoMark } from "@/components/ContralyneLogoMark";

// Top-level (outside the (dashboard) group) — OrgGate sends a `no_organization`
// caller here. Organizations are created only via a super-admin-issued
// invite (see /superadmin/organizations), so there is no self-serve "create
// your own organization" flow to offer here.
export default function NoOrganizationPage() {
  const { signOut } = useClerk();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  function checkAgain() {
    setChecking(true);
    // Reloading THIS page would be a no-op — it has no gate logic of its own.
    // Navigating into (dashboard) re-runs OrgGate's /api/org/me check, which
    // redirects back here if still unresolved, or through if now active.
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
          <Mail className="h-6 w-6 text-blue-500" />
        </div>

        <h1 className="text-lg font-semibold text-gray-900">No organization yet</h1>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          This account isn&apos;t part of an organization on Contralyne. If your firm is
          onboarding, ask your admin to invite you — or contact us if you were expecting
          an invitation to set up a new firm.
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
        Questions? Contact support@contralyne.com.
      </p>
    </div>
  );
}
