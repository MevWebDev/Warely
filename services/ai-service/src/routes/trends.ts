import express from "express";
import { TrendService } from "../services/trendService";
import { Router, Request, Response } from "express";
const router: Router = express.Router();
const trendService = new TrendService();

// POST /api/trends/analyze
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { warehouseId, products, orders } = req.body;

    await trendService.analyzeTrends(warehouseId, products, orders);

    res.json({
      success: true,
      message: "Trend analysis completed",
    });
  } catch (error) {
    console.error("Trend analysis error:", error);
    res.status(500).json({ success: false, message: "Analysis failed" });
  }
});

// GET /api/trends/:warehouseId
router.get("/:warehouseId", async (req: Request, res: Response) => {
  try {
    const warehouseId = parseInt(req.params.warehouseId);
    const { type } = req.query;

    const trends = await trendService.getTrends(
      warehouseId,
      type as "product" | "category"
    );

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error("Get trends error:", error);
    res.status(500).json({ success: false, message: "Failed to get trends" });
  }
});

export default router;
