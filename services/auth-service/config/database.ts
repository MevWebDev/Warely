import { PrismaClient } from "@prisma/client";
import { createClient, RedisClientType } from "redis";

export const prisma = new PrismaClient();

export const redis: RedisClientType = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

export async function connectDatabases() {
  try {
    // Connect to PostgreSQL via Prisma
    await prisma.$connect();
    console.log("✅ Auth service connected to PostgreSQL");

    // Connect to Redis
    await redis.connect();
    console.log("✅ Auth service connected to Redis");
  } catch (error) {
    console.error("❌ Auth service database connection failed:", error);
    throw error;
  }
}

export async function disconnectDatabases() {
  await prisma.$disconnect();
  await redis.disconnect();
}
