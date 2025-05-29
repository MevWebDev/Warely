import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { redis } from "../config/database";

interface AuthRequest extends Request {
  user?: any;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access token required" });
    }

    const token = authHeader.split(" ")[1];

    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: "Token is invalid" });
    }

    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
