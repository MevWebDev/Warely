import { Router, Request, Response } from "express";
import * as si from "systeminformation";

const router: Router = Router();

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  version: string;
  system?: {
    cpu_percent: number;
    memory_percent: number;
    memory_available: number;
    environment: string;
  };
  dependencies?: {
    mongodb: string;
    redis: string;
  };
  error?: string;
}

// Basic health check endpoint
router.get("/", async (req: Request, res: Response) => {
  try {
    const response: HealthResponse = {
      status: "ok",
      service: "ai-service",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      status: "error",
      service: "ai-service",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Detailed health check with system information
router.get("/detailed", async (req: Request, res: Response) => {
  try {
    // Get system information
    const [cpuInfo, memInfo] = await Promise.all([si.currentLoad(), si.mem()]);

    const response: HealthResponse = {
      status: "ok",
      service: "ai-service",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      system: {
        cpu_percent: Math.round(cpuInfo.currentLoad),
        memory_percent: Math.round((memInfo.used / memInfo.total) * 100),
        memory_available: memInfo.available,
        environment: process.env.NODE_ENV || "production",
      },
      dependencies: {
        mongodb: "connected", // TODO: Add actual MongoDB connection check
        redis: "connected", // TODO: Add actual Redis connection check
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "error",
      service: "ai-service",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as healthRouter };
