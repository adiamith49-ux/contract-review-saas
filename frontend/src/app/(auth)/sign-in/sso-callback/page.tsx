"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

// Where Google sends the user back after "Continue with Google". This static
// route takes precedence over the [[...sign-in]] catch-all, which would
// otherwise render the sign-in form again and drop the OAuth handshake.
export default function SSOCallbackPage() {
  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        <p className="text-sm text-gray-500">Signing you in…</p>
      </div>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
