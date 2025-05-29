import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

import { connectDatabases } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";
import { authMiddleware } from "./middleware/auth";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import clientRoutes from "./routes/clients";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.json("Hello from auth-service");
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: "Too many authentication attempts",
});

app.use(limiter);
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);

// General middleware
app.use(compression());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "auth-service",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/auth", authRoutes);
app.use("/users", authMiddleware, userRoutes);
app.use("/clients", authMiddleware, clientRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
async function startServer() {
  try {
    await connectDatabases();

    app.listen(PORT, () => {
      console.log(`🔐 Auth service running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Failed to start auth service:", error);
    process.exit(1);
  }
}

startServer();
