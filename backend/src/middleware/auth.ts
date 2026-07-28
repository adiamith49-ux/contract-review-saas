import { verifyToken } from "@clerk/backend";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      // Clerk includes org_id/org_role directly on the session JWT payload
      // when the requester has an active organization selected — no Clerk
      // Dashboard session-token customization required.
      orgId: string | null;
      orgRole: string | null;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = await verifyToken(token, { secretKey: config.CLERK_SECRET_KEY });
    req.userId = payload.sub;
    // Clerk's default session claims nest organization data under a compact
    // "o": { id, rol, slg } object (to save JWT bytes) — NOT flat org_id/
    // org_role fields. Only the frontend SDK's useAuth() hook expands this
    // back to orgId/orgRole automatically; the backend has to do it itself.
    // "rol" also omits the "org:" prefix (e.g. "admin", not "org:admin").
    const org = (payload as { o?: { id?: string; rol?: string; slg?: string } }).o;
    req.orgId = org?.id ?? null;
    req.orgRole = org?.rol ? `org:${org.rol}` : null;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
