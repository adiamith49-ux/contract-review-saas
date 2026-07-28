"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { getOrgMe, type OrgStatus } from "@/lib/org-api";
import { useAutoActiveOrg } from "@/lib/useAutoActiveOrg";

const REDIRECT_FOR: Partial<Record<OrgStatus, string>> = {
  no_organization: "/organization/none",
  pending: "/organization/pending",
  suspended: "/organization/suspended",
  deleted: "/organization/suspended",
};

// Wraps the whole authenticated app: every route under (dashboard) requires
// an active organization. Redirects away instead of rendering when the
// caller's org is missing, pending approval, or suspended — enforced again
// server-side by requireActiveOrg on every /api/* call, so a stale client
// here can never grant real API access, only a confusing blank screen.
export function OrgGate({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const orgReady = useAutoActiveOrg();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    if (!isLoaded || !orgReady) return;
    let cancelled = false;

    (async () => {
      try {
        // skipCache matters right after useAutoActiveOrg calls setActive():
        // Clerk's local session state (useAuth().orgId) updates immediately,
        // but a cached JWT minted just before that can still be served for
        // its remaining TTL, silently missing the new org_id/org_role claims.
        const token = await getToken({ skipCache: true });
        const me = await getOrgMe(token);
        if (cancelled) return;

        const redirectTo = REDIRECT_FOR[me.status];
        if (redirectTo) {
          redirected.current = true;
          router.replace(redirectTo);
          return;
        }
        setChecked(true);
      } catch {
        // Network/API hiccup — fail open to the existing per-route auth
        // rather than locking a user out over a transient error.
        if (!cancelled) setChecked(true);
      }
    })();

    return () => { cancelled = true; };
  }, [isLoaded, orgReady, getToken, router]);

  if (!checked && !redirected.current) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#D9FAF4]">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (redirected.current) return null;

  return <>{children}</>;
}
