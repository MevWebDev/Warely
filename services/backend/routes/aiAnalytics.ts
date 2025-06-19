import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole,
  AuthRequest,
} from "../middleware/auth0";
import dotenv from "dotenv";

dotenv.config();

const router: Router = Router();
const prisma = new PrismaClient();

export interface ReorderRecommendation {
  _id: string;
  warehouseId: number;
  productId: number;
  productSku: string;
  productName: string;
  currentReorderPoint: number;
  recommendedReorderPoint: number;
  confidence: number;
  avgDailyDemand: number;
  demandVariability: number;
  leadTime: number;
  analyzedFrom: Date;
  analyzedTo: Date;
  orderCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrendData {
  _id: string;
  warehouseId: number;
  productId: number;
  productName: string;
  categoryId: number;
  categoryName: string;
  trendType: "INCREASING" | "DECREASING" | "STABLE" | "SEASONAL";
  confidence: number;
  analyzedFrom: Date;
  analyzedTo: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIServiceResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ReorderAnalysisResponse {
  success: boolean;
  message: string;
  data?: {
    productsAnalyzed: number;
    ordersProcessed: number;
  };
}

const getAIServiceURL = () => {
  const url =
    process.env.NODE_ENV !== "development"
      ? process.env.AI_SERVICE_URL
      : "http://localhost:6001";

  return url;
};

// In your existing backend
router.post(
  "/analyze-reorder-points",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Get products and orders from PostgreSQL
      const products = await prisma.product.findMany({
        where: { warehouseId, isActive: true },
        select: {
          id: true,
          sku: true,
          name: true,
          currentStock: true,
          reorderPoint: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      });

      const orders = await prisma.order.findMany({
        where: {
          warehouseId,
          type: "OUTBOUND",
          status: "COMPLETED",
          completedDate: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          orderItems: {
            select: { productId: true, quantity: true },
          },
        },
      });

      // Send to AI service
      const aiResponse = await fetch(
        `${getAIServiceURL()}/api/reorder/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": process.env.AI_SERVICE_API_KEY!,
          },
          body: JSON.stringify({
            warehouseId,
            products: products.map((p) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              currentStock: p.currentStock,
              reorderPoint: p.reorderPoint,
              categoryId: p.categoryId,
              categoryName: p.category?.name,
            })),
            orders: orders.map((o) => ({
              completedDate: o.completedDate,
              orderItems: o.orderItems,
            })),
          }),
        }
      );

      if (!aiResponse.ok) throw new Error("AI service error");

      // Also analyze trends
      await fetch(`${getAIServiceURL()}/api/trends/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.AI_SERVICE_API_KEY!,
        },
        body: JSON.stringify({
          warehouseId,
          products: products.map((p) => ({
            id: p.id,
            name: p.name,
            categoryId: p.categoryId,
            categoryName: p.category?.name || "Unknown",
          })),
          orders: orders.map((o) => ({
            completedDate: o.completedDate,
            orderItems: o.orderItems,
          })),
        }),
      });

      res.json({
        success: true,
        message: `AI analysis completed for ${products.length} products`,
      });
    } catch (error) {
      console.error("AI analysis error:", error);
      res.status(500).json({ success: false, message: "AI analysis failed" });
    }
  }
);

router.get(
  "/recommendations",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      const [reorderResponse, trendsResponse] = await Promise.all([
        fetch(`${getAIServiceURL()}/api/reorder/${warehouseId}`, {
          headers: {
            "X-API-Key": process.env.AI_SERVICE_API_KEY!, // Add missing API key
          },
        }),
        fetch(`${getAIServiceURL()}/api/trends/${warehouseId}`, {
          headers: {
            "X-API-Key": process.env.AI_SERVICE_API_KEY!, // Add missing API key
          },
        }),
      ]);

      // Check if reorder response is successful
      if (!reorderResponse.ok) {
        const errorText = await reorderResponse.text();
        throw new Error(
          `Reorder API failed: ${reorderResponse.status} - ${errorText}`
        );
      }

      // Parse responses with proper error handling
      const reorderData = (await reorderResponse.json()) as AIServiceResponse<
        ReorderRecommendation[]
      >;

      let trendsData: AIServiceResponse<TrendData[]>;
      if (trendsResponse.ok) {
        trendsData = (await trendsResponse.json()) as AIServiceResponse<
          TrendData[]
        >;
      } else {
        console.warn(`Trends API failed: ${trendsResponse.status}`);
        trendsData = { success: false, data: [] };
      }

      res.json({
        success: true,
        data: {
          reorderRecommendations: reorderData.data || [],
          trends: trendsData.data || [],
        },
        meta: {
          reorderSuccess: reorderData.success,
          trendsSuccess: trendsData.success,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Get AI recommendations error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get recommendations",
        error: error.message,
      });
    }
  }
);

export default router;
