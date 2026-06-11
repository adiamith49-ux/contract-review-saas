import { verifyToken } from "@clerk/backend";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

declare global {
  namespace Express {
    interface Request {
      userId: string;
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
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
