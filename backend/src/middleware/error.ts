import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Log only the message — inspecting some error objects (e.g. ZodError under
  // certain Node versions) can itself throw inside util.inspect and crash the handler.
  try {
    console.error(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
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

  const status = err?.status ?? err?.statusCode ?? 500;
  const message = status >= 500 ? "Internal server error" : (err?.message ?? "Request failed");
  res.status(status).json({ error: message });
};
