"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Without a boundary here, any render error inside the dashboard fell through to
// Next's last-resort screen ("Application error: a client-side exception has
// occurred"), which discards the message and leaves the user with a blank page
// and no way back. This keeps the shell usable and shows what actually broke.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] render error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-5 w-5 text-red-600" />
      </div>
      <h1 className="text-lg font-semibold text-gray-900">This page didn&apos;t load</h1>
      <p className="mt-1.5 text-sm text-gray-500">
        Something went wrong while rendering this view. Your data is safe — nothing was changed.
      </p>

      {(error.message || error.digest) && (
        <div className="mt-5 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Error details</p>
          {error.message && (
            <p className="mt-1 break-words font-mono text-xs text-gray-700">{error.message}</p>
          )}
          {error.digest && (
            <p className="mt-1 font-mono text-xs text-gray-400">digest: {error.digest}</p>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
