"use client";

import { useEffect } from "react";

// Last-resort boundary: catches errors thrown in a root layout, which segment
// boundaries cannot. Must render its own <html>/<body> because it replaces the
// root layout entirely.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] fatal render error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f9fafb" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "#111827" }}>Contralyne hit an unexpected error</h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "#6b7280" }}>
            Reloading usually clears it. If it keeps happening, send us the details below.
          </p>

          {(error.message || error.digest) && (
            <div style={{
              marginTop: 20, padding: "12px 16px", textAlign: "left",
              border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff",
            }}>
              {error.message && (
                <p style={{ margin: 0, fontFamily: "monospace", fontSize: 12, color: "#374151", wordBreak: "break-word" }}>
                  {error.message}
                </p>
              )}
              {error.digest && (
                <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: 12, color: "#9ca3af" }}>
                  digest: {error.digest}
                </p>
              )}
            </div>
          )}

          <button
            onClick={reset}
            style={{
              marginTop: 24, padding: "8px 16px", fontSize: 14, cursor: "pointer",
              color: "#fff", background: "#111827", border: 0, borderRadius: 8,
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
