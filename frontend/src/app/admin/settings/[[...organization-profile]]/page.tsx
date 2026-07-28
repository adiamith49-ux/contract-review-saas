"use client";
import { OrganizationProfile } from "@clerk/nextjs";

// Lives under /admin so it inherits the admin panel's own chrome/sidebar —
// reached via the "Org Settings" nav item in admin/layout.tsx. That layout's
// own gate has already confirmed org:admin + an active org by the time
// anyone reaches this route, so no extra gating is needed here.
export default function AdminOrgSettingsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[900px] mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Organization Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your organization&apos;s profile and members.</p>
      </div>
      <OrganizationProfile
        routing="path"
        path="/admin/settings"
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "w-full shadow-sm border border-gray-200 rounded-2xl",
          },
        }}
      />
    </div>
  );
}
