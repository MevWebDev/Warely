import { ReorderRecommendation } from "../models/ReorderRecommendation";
import {
  calculateReorderPoint,
  OrderData,
  ProductData,
} from "../utils/calculations";

export class ReorderService {
  /**
   * Analyze and save reorder recommendations for products
   */
  async analyzeProducts(
    warehouseId: number,
    products: ProductData[],
    orders: OrderData[]
  ): Promise<void> {
    // Delete old recommendations for this warehouse
    await ReorderRecommendation.deleteMany({ warehouseId });

    const recommendations = [];
    const analyzedFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    const analyzedTo = new Date();

    for (const product of products) {
      const analysis = calculateReorderPoint(orders, product.id);

      recommendations.push({
        warehouseId,
        productId: product.id,
        productSku: product.sku,
        productName: product.name,
        currentReorderPoint: product.reorderPoint,
        recommendedReorderPoint: analysis.recommendedReorderPoint,
        confidence: analysis.confidence,
        avgDailyDemand: analysis.avgDailyDemand,
        demandVariability: analysis.demandVariability,
        leadTime: 7, // Default lead time
        analyzedFrom,
        analyzedTo,
        orderCount: analysis.orderCount,
      });
    }

    // Bulk insert
    if (recommendations.length > 0) {
      await ReorderRecommendation.insertMany(recommendations);
    }
  }

  /**
   * Get reorder recommendations
   */
  async getRecommendations(warehouseId: number): Promise<any[]> {
    return await ReorderRecommendation.find({ warehouseId })
      .sort({ confidence: -1, recommendedReorderPoint: -1 })
      .lean();
  }
}
