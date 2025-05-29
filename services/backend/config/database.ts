import { PrismaClient } from "@prisma/client";
import mongoose from "mongoose";

export const prisma = new PrismaClient();

export async function connectDatabases() {
  try {
    // Connect to PostgreSQL via Prisma
    await prisma.$connect();
    console.log("✅ Connected to PostgreSQL");

    // Connect to MongoDB
    const mongoUrl =
      process.env.MONGODB_URL || "mongodb://localhost:27017/warely";
    await mongoose.connect(mongoUrl);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
}
