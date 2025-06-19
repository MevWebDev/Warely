import { TrendAnalysis } from "../models/TrendAnalysis";
import { calculateTrend, OrderData } from "../utils/calculations";

export class TrendService {
  /**
   * Analyze trends for products and categories
   */
  async analyzeTrends(
    warehouseId: number,
    products: Array<{
      id: number;
      name: string;
      categoryId: number;
      categoryName: string;
    }>,
    orders: OrderData[]
  ): Promise<void> {
    // Delete old trends
    await TrendAnalysis.deleteMany({ warehouseId });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const ordersWithDates = orders
      .map((order) => ({
        ...order,
        completedDate: new Date(order.completedDate), // Convert string to Date
      }))
      .filter((order) => !isNaN(order.completedDate.getTime())); // Remove invalid dates

    // Split orders into current and previous periods
    const currentPeriodOrders = ordersWithDates.filter(
      (o) => o.completedDate >= thirtyDaysAgo
    );
    const previousPeriodOrders = ordersWithDates.filter(
      (o) => o.completedDate >= sixtyDaysAgo && o.completedDate < thirtyDaysAgo
    );

    const trends = [];

    // Product trends
    for (const product of products) {
      const currentSales = this.calculateProductSales(
        currentPeriodOrders,
        product.id
      );
      const previousSales = this.calculateProductSales(
        previousPeriodOrders,
        product.id
      );

      const trendAnalysis = calculateTrend(currentSales, previousSales);

      trends.push({
        warehouseId,
        type: "product",
        itemId: product.id,
        itemName: product.name,
        trend: trendAnalysis.trend,
        trendStrength: trendAnalysis.trendStrength,
        changePercent: trendAnalysis.changePercent,
        analyzedFrom: thirtyDaysAgo,
        analyzedTo: now,
        currentPeriodSales: currentSales,
        previousPeriodSales: previousSales,
      });
    }

    // Category trends
    const categories = new Map<number, string>();
    products.forEach((p) => categories.set(p.categoryId, p.categoryName));

    for (const [categoryId, categoryName] of categories) {
      const currentSales = this.calculateCategorySales(
        currentPeriodOrders,
        categoryId,
        products
      );
      const previousSales = this.calculateCategorySales(
        previousPeriodOrders,
        categoryId,
        products
      );

      const trendAnalysis = calculateTrend(currentSales, previousSales);

      trends.push({
        warehouseId,
        type: "category",
        itemId: categoryId,
        itemName: categoryName,
        trend: trendAnalysis.trend,
        trendStrength: trendAnalysis.trendStrength,
        changePercent: trendAnalysis.changePercent,
        analyzedFrom: thirtyDaysAgo,
        analyzedTo: now,
        currentPeriodSales: currentSales,
        previousPeriodSales: previousSales,
      });
    }

    // Bulk insert
    if (trends.length > 0) {
      await TrendAnalysis.insertMany(trends);
    }
  }

  /**
   * Get sorted trends
   */
  async getTrends(
    warehouseId: number,
    type?: "product" | "category"
  ): Promise<any[]> {
    const filter: any = { warehouseId };
    if (type) filter.type = type;

    return await TrendAnalysis.find(filter)
      .sort({ trendStrength: -1, changePercent: -1 })
      .lean();
  }

  private calculateProductSales(
    orders: OrderData[],
    productId: number
  ): number {
    return orders.reduce((total, order) => {
      const productItems = order.orderItems.filter(
        (item) => item.productId === productId
      );
      return total + productItems.reduce((sum, item) => sum + item.quantity, 0);
    }, 0);
  }

  private calculateCategorySales(
    orders: OrderData[],
    categoryId: number,
    products: Array<{ id: number; categoryId: number }>
  ): number {
    const categoryProductIds = products
      .filter((p) => p.categoryId === categoryId)
      .map((p) => p.id);

    return orders.reduce((total, order) => {
      const categoryItems = order.orderItems.filter((item) =>
        categoryProductIds.includes(item.productId)
      );
      return (
        total + categoryItems.reduce((sum, item) => sum + item.quantity, 0)
      );
    }, 0);
  }
}
