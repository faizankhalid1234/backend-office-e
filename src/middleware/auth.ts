import type { Request, Response, NextFunction } from "express";
import { verifyToken, type AuthPayload } from "../lib/jwt.js";
import { User } from "../models/User.js";
import type { IUser } from "../models/User.js";
import type { Role } from "../lib/types.js";

export type AuthRequest = Request & { user?: AuthPayload };

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.id).select("email role isActive").lean<IUser | null>();

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Account is disabled or not found" });
      return;
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role as Role,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
