"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDatabases = connectDatabases;
const client_1 = require("@prisma/client");
const mongoose_1 = __importDefault(require("mongoose"));
exports.prisma = new client_1.PrismaClient();
async function connectDatabases() {
    try {
        // Connect to PostgreSQL via Prisma
        await exports.prisma.$connect();
        console.log("✅ Connected to PostgreSQL");
        // Connect to MongoDB
        const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017/warely";
        await mongoose_1.default.connect(mongoUrl);
        console.log("✅ Connected to MongoDB");
    }
    catch (error) {
        console.error("❌ Database connection failed:", error);
        throw error;
    }
}
//# sourceMappingURL=database.js.map