import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

declare global {
  namespace Express {
    interface Request {
      adminEmail?: string;
    }
  }
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Admin token required" });
    return;
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, config.ADMIN_JWT_SECRET) as { email: string; iss: string };
    if (payload.iss !== "contralyne-admin") {
      res.status(401).json({ error: "Invalid admin token" });
      return;
    }
    req.adminEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired admin token" });
  }
};
