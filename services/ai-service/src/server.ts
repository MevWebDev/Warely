import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import { healthRouter } from "./routes/health";
import { aiRouter } from "./routes/ai";

// Load environment variables
dotenv.config();

const app: Express = express(); // ✅ Add explicit type annotation
const PORT: number = parseInt(process.env.PORT || "6001", 10);

// Security middleware
app.use(helmet());
app.use(compression());

// Configure CORS
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://warely.local",
      process.env.FRONTEND_URL || "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/health", healthRouter);
app.use("/ai", aiRouter);

// Root endpoint
app.get("/", (req: Request, res: Response): void => {
  res.json({
    message: "Warely AI Service",
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Hello endpoint
app.get("/hello", (req: Request, res: Response): void => {
  res.json({ message: "Hello from Warely AI-Service" });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 404 handler
app.use("*", (req: Request, res: Response): void => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.originalUrl} not found`,
  });
});

// Start server
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 AI Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "production"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`👋 Hello endpoint: http://localhost:${PORT}/hello`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🔄 SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("✅ Process terminated");
  });
});

export default app;
