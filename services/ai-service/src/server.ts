import express from "express";
import cors from "cors";
import { connectDB } from "./config/database";
import { authenticateAPIKey } from "./middleware/auth";
import reorderRoutes from "./routes/reorder";
import trendRoutes from "./routes/trends";

const app = express();

// Basic middleware
app.use(express.json());
app.use(cors());

// Trust proxy for real IP addresses
app.set("trust proxy", true);

// Health check (unprotected - for monitoring)
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "ai-service",
    timestamp: new Date().toISOString(),
  });
});

// Apply API key authentication to all /api routes
app.use("/api", authenticateAPIKey);

// Protected routes
app.use("/api/reorder", reorderRoutes);
app.use("/api/trends", trendRoutes);

// 404 handler
app.use("*", (req, res) => {
  console.warn(
    `🚫 404 - Route not found: ${req.method} ${req.originalUrl} from ${req.ip}`
  );
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    const PORT = process.env.PORT || 6001;
    app.listen(PORT, () => {
      console.log(`🚀 AI Service running on port ${PORT}`);
      console.log(`🔐 API Key authentication enabled`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`🛡️ Protected routes: http://localhost:${PORT}/api/*`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
