"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    res.json({ message: "Suppliers endpoint", data: [] });
});
exports.default = router;
//# sourceMappingURL=suppliers.js.map