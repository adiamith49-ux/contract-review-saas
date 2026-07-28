import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Log only scalar fields — inspecting some error objects (e.g. ZodError under
  // certain Node versions) can itself throw inside util.inspect and crash the handler.
  // Supabase rejects with a PLAIN OBJECT, not an Error: `String(err)` on one of those
  // logs the literal "[object Object]", which is how a missing-column failure reached
  // production looking like an anonymous 500. Pull the PostgrestError fields by name.
  try {
    if (err instanceof Error) {
      console.error(`${err.name}: ${err.message}`);
    } else if (err && typeof err === "object") {
      const { message, code, details, hint } = err as Record<string, unknown>;
      console.error([
        `NonError: ${String(message ?? "(no message)")}`,
        code ? `code=${String(code)}` : "",
        details ? `details=${String(details)}` : "",
        hint ? `hint=${String(hint)}` : "",
      ].filter(Boolean).join(" | "));
    } else {
      console.error(String(err));
    }
  } catch { /* never let logging break the response */ }

  // Validation errors → 400 with a readable message (never a raw 500 / HTML dump)
  if (err instanceof ZodError) {
    const first = err.issues?.[0];
    const field = first?.path?.join(".");
    const message = first ? `${field ? `${field}: ` : ""}${first.message}` : "Invalid request";
    res.status(400).json({ error: message });
    return;
  }

  // Malformed JSON body (express.json parse error)
  if (err?.type === "entity.parse.failed" || (err instanceof SyntaxError && "body" in err)) {
    res.status(400).json({ error: "Invalid JSON in request body" });
    return;
  }

  // 5xx messages are masked by default so an internal failure can't leak table names,
  // keys, or stack detail. `expose: true` opts a deliberately-written, user-safe message
  // out of that masking (the http-errors convention) — used for upstream failures like
  // "file storage is unavailable", where the user needs to know it wasn't their file.
  const status = err?.status ?? err?.statusCode ?? 500;
  const message = status >= 500 && err?.expose !== true
    ? "Internal server error"
    : (err?.message ?? "Request failed");
  res.status(status).json({ error: message });
};
