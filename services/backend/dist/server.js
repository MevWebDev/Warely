"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./config/database");
const errorHandler_1 = require("./middleware/errorHandler");
const inventory_1 = __importDefault(require("./routes/inventory"));
const orders_1 = __importDefault(require("./routes/orders"));
const suppliers_1 = __importDefault(require("./routes/suppliers"));
const analytics_1 = __importDefault(require("./routes/analytics"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);
// General middleware
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)("combined"));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "backend",
        timestamp: new Date().toISOString(),
    });
});
app.get("/", (req, res) => {
    res.json("Hello from backend");
});
// API routes
app.use("/api/inventory", inventory_1.default);
app.use("/api/orders", orders_1.default);
app.use("/api/suppliers", suppliers_1.default);
app.use("/api/analytics", analytics_1.default);
// Error handling
app.use(errorHandler_1.errorHandler);
// 404 handler
app.use("*", (req, res) => {
    res.status(404).json({ error: "Route not found" });
});
// Start server
async function startServer() {
    try {
        await (0, database_1.connectDatabases)();
        app.listen(PORT, () => {
            console.log(`🚀 Backend service running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
        });
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=server.js.map