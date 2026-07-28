"use client";
import { useEffect, useState } from "react";
import { useAuth, useOrganizationList } from "@clerk/nextjs";

// Clerk only puts org_id/org_role on the session token when the session has
// an ACTIVE organization selected — being a member isn't enough. Adding a
// membership via the Backend API (an org admin's "Add User" flow, the
// superadmin invite flow, or a one-off migration script) never sets that
// membership as active on any existing or future session by itself; normally
// a Clerk <OrganizationSwitcher/> is what calls setActive(). This app has no
// switcher UI (one org per user, by design), so auto-select the user's first
// membership as active the moment we notice none is set, right after sign-in.
export function useAutoActiveOrg(): boolean {
  const { isLoaded: authLoaded, orgId } = useAuth();
  const { isLoaded: listLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authLoaded || !listLoaded) return;
    if (orgId) { setReady(true); return; }

    // `listLoaded` only means the Clerk client itself is ready — the paginated
    // userMemberships resource fetches separately and has its own isLoading.
    // Checking `.data` before this settles sees a permanently-empty array and
    // gives up before the real membership list ever arrives.
    if (userMemberships.isLoading) return;

    const memberships = userMemberships.data ?? [];
    if (memberships.length === 0) { setReady(true); return; }

    setActive?.({ organization: memberships[0].organization.id })
      .catch(() => { /* fall through — getOrgMe will just report no_organization */ })
      .finally(() => setReady(true));
  }, [authLoaded, listLoaded, orgId, userMemberships, setActive]);

  return ready;
}
