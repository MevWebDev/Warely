import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("Error:", err);

  // Prisma errors
  if (err.code === "P2002") {
    return res.status(409).json({ error: "Resource already exists" });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ error: "Token expired" });
  }

  // Default error
  res.status(500).json({
    error: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { details: err.message }),
  });
}
