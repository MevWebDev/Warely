// services/backend/config/database.ts

import { PrismaClient } from "@prisma/client";
import mongoose from "mongoose";
import { createClient, RedisClientType } from "redis";

export const prisma = new PrismaClient();

// Create Redis client
export const redis: RedisClientType = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

// Redis error handling
redis.on("error", (err) => {
  console.error("❌ Redis Client Error:", err);
});

redis.on("connect", () => {
  console.log("🔗 Redis connecting...");
});

redis.on("ready", () => {
  console.log("✅ Redis ready");
});

export async function connectDatabases() {
  const maxRetries = 10;
  const retryDelay = 5000; // 5 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Database connection attempt ${attempt}/${maxRetries}`);

      // Connect to PostgreSQL via Prisma
      await prisma.$connect();
      console.log("✅ Connected to PostgreSQL");

      // Connect to MongoDB
      const mongoUrl = process.env.MONGODB_URL;
      await mongoose.connect(
        mongoUrl ||
          "mongodb://admin:password@mongodb:27017/warely?authSource=admin"
      );
      console.log("✅ Connected to MongoDB");

      // Connect to Redis
      if (!redis.isOpen) {
        await redis.connect();
        console.log("✅ Connected to Redis");
      }

      console.log("🎉 All databases connected successfully!");
      return;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `❌ Database connection failed (attempt ${attempt}/${maxRetries}):`,
        errorMessage
      );

      if (attempt === maxRetries) {
        throw error;
      }

      console.log(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

export async function disconnectDatabases() {
  try {
    await prisma.$disconnect();
    console.log("✅ Disconnected from PostgreSQL");

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");

    if (redis.isOpen) {
      await redis.quit();
      console.log("✅ Disconnected from Redis");
    }

    console.log("🎉 All databases disconnected successfully!");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error disconnecting databases:", errorMessage);
  }
}

process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await disconnectDatabases();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await disconnectDatabases();
  process.exit(0);
});
