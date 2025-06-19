import express from "express";
import { Router, Request, Response } from "express";
import { ReorderService } from "../services/reorderService";

const router: Router = express.Router();
const reorderService = new ReorderService();

// POST /api/reorder/analyze
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { warehouseId, products, orders } = req.body;

    await reorderService.analyzeProducts(warehouseId, products, orders);

    res.json({
      success: true,
      message: `Analyzed ${products.length} products`,
    });
  } catch (error) {
    console.error("Reorder analysis error:", error);
    res.status(500).json({ success: false, message: "Analysis failed" });
  }
});

// GET /api/reorder/:warehouseId
router.get("/:warehouseId", async (req: Request, res: Response) => {
  try {
    const warehouseId = parseInt(req.params.warehouseId);
    const recommendations = await reorderService.getRecommendations(
      warehouseId
    );

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error("Get recommendations error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get recommendations" });
  }
});

export default router;
