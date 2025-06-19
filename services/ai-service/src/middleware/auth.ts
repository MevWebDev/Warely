import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";

dotenv.config();

export const authenticateAPIKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers["x-api-key"] as string;
  const expectedApiKey = process.env.AI_SERVICE_API_KEY;

  // Check if API key is configured
  if (!expectedApiKey) {
    console.error("❌ AI_SERVICE_API_KEY not configured");
    return res.status(500).json({
      success: false,
      message: "Service authentication not configured",
    });
  }

  // Check if API key is provided
  if (!apiKey) {
    console.warn(
      `🚫 Missing API key from ${req.ip} - ${req.method} ${req.path}`
    );
    return res.status(401).json({
      success: false,
      message: "API key required",
    });
  }

  // Validate API key
  if (apiKey !== expectedApiKey) {
    console.warn(
      `🚫 Invalid API key from ${req.ip} - Key: ${apiKey.substring(0, 8)}...`
    );
    return res.status(401).json({
      success: false,
      message: "Invalid API key",
    });
  } else {
    console.log(
      `✅ Authenticated request from ${req.ip} - ${req.method} ${req.path}`
    );
  }

  next();
};
