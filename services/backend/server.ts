import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { connectDatabases } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";
import { checkAuth0JWT } from "./middleware/auth0"; // Add this import

import productsRoutes from "./routes/products";
import categoriesRoutes from "./routes/categories";
import suppliersRoutes from "./routes/suppliers";
import analyticsRoutes from "./routes/analytics";

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: [
      "http://localhost:3000", // Development frontend
      "http://localhost:3001", // Alternative dev port
      "http://127.0.0.1:3000", // Alternative localhost
      "http://frontend:3000", // Docker container name
      process.env.FRONTEND_URL || "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// General middleware
app.use(compression());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Public health check (no auth required)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString(),
  });
});

// Protected hello endpoint (auth required)
app.get("/hello", checkAuth0JWT, (req: any, res) => {
  res.json({
    message: "Hello from Warely Backend! 🎉",
    user: {
      sub: req.user.sub,
      email: req.user.email,
      name: req.user.name,
    },
    timestamp: new Date().toISOString(),
  });
});

// Protected API routes (all require authentication)

app.use("/api/products", productsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/analytics", analyticsRoutes);

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
      console.log(`🚀 Backend service running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth0 Domain: ${process.env.AUTH0_DOMAIN}`);
      console.log(`🎯 Auth0 Audience: ${process.env.AUTH0_AUDIENCE}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
