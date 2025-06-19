import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const connectDB = async (): Promise<void> => {
  try {
    let mongoURI: string;

    if (process.env.NODE_ENV === "production") {
      // Production: Use container hostnames (Docker/Kubernetes)
      mongoURI =
        process.env.MONGODB_URL ||
        "mongodb://admin:password@mongodb:27017/warely?authSource=admin";
    } else {
      // Development: Use localhost (local development)
      mongoURI =
        process.env.MONGODB_URL_DEV ||
        "mongodb://admin:password@localhost:27017/warely?authSource=admin";
    }

    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ MongoDB connected successfully");

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("🔌 MongoDB connection closed through app termination");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.connection.close();
  console.log("🔌 MongoDB disconnected");
};
