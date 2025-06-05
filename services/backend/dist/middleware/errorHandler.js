"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, next) {
    console.error("Error:", err);
    if (err.code === "P2002") {
        return res.status(409).json({ error: "Resource already exists" });
    }
    if (err.name === "ValidationError") {
        return res
            .status(400)
            .json({ error: "Validation failed", details: err.message });
    }
    res.status(500).json({
        error: "Internal server error",
        ...(process.env.NODE_ENV === "development" && { details: err.message }),
    });
}
//# sourceMappingURL=errorHandler.js.map