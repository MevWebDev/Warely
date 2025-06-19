export interface OrderData {
  completedDate: Date | string;
  orderItems: Array<{
    productId: number;
    quantity: number;
  }>;
}

export interface ProductData {
  id: number;
  sku: string;
  name: string;
  currentStock: number;
  reorderPoint: number;
  categoryId: number;
  categoryName?: string;
}

/**
 * Calculate simple reorder point recommendation
 */
export function calculateReorderPoint(
  orders: OrderData[],
  productId: number,
  leadTimeDays: number = 7
): {
  recommendedReorderPoint: number;
  confidence: number;
  avgDailyDemand: number;
  demandVariability: number;
  orderCount: number;
} {
  // Filter orders for this product
  const productOrders = orders.filter((order) =>
    order.orderItems.some((item) => item.productId === productId)
  );

  if (productOrders.length < 5) {
    return {
      recommendedReorderPoint: 10, // Default
      confidence: 0.2,
      avgDailyDemand: 0,
      demandVariability: 0,
      orderCount: productOrders.length,
    };
  }

  // Calculate daily demand
  const demandByDay = new Map<string, number>();

  productOrders.forEach((order) => {
    // Fix: Handle both Date objects and date strings
    let completedDate: Date;

    if (order.completedDate instanceof Date) {
      completedDate = order.completedDate;
    } else {
      // Convert string to Date
      completedDate = new Date(order.completedDate);
    }

    // Validate the date
    if (isNaN(completedDate.getTime())) {
      console.warn(`Invalid date for order:`, order.completedDate);
      return; // Skip this order
    }

    const dateKey = completedDate.toISOString().split("T")[0];
    const quantity = order.orderItems
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);

    demandByDay.set(dateKey, (demandByDay.get(dateKey) || 0) + quantity);
  });

  const dailyDemands = Array.from(demandByDay.values());

  // Add safety check for empty demands
  if (dailyDemands.length === 0) {
    return {
      recommendedReorderPoint: 10, // Default
      confidence: 0.1,
      avgDailyDemand: 0,
      demandVariability: 0,
      orderCount: productOrders.length,
    };
  }

  const avgDailyDemand =
    dailyDemands.reduce((a, b) => a + b, 0) / dailyDemands.length;

  // Simple standard deviation
  const variance =
    dailyDemands.reduce(
      (sum, demand) => sum + Math.pow(demand - avgDailyDemand, 2),
      0
    ) / dailyDemands.length;
  const demandVariability = Math.sqrt(variance);

  // Simple reorder point formula
  const safetyStock = demandVariability * 1.5; // 1.5x std dev as safety
  const recommendedReorderPoint = Math.ceil(
    avgDailyDemand * leadTimeDays + safetyStock
  );

  // Confidence based on data points
  let confidence = 0.3;
  if (productOrders.length > 10) confidence += 0.2;
  if (productOrders.length > 20) confidence += 0.2;
  if (dailyDemands.length > 14) confidence += 0.2;
  if (demandVariability / avgDailyDemand < 0.5) confidence += 0.1; // Low variability

  return {
    recommendedReorderPoint: Math.max(1, recommendedReorderPoint),
    confidence: Math.min(confidence, 1),
    avgDailyDemand,
    demandVariability,
    orderCount: productOrders.length,
  };
}

/**
 * Calculate trend for product or category
 */
export function calculateTrend(
  currentPeriodSales: number,
  previousPeriodSales: number
): {
  trend: "increasing" | "decreasing" | "stable";
  trendStrength: number;
  changePercent: number;
} {
  if (previousPeriodSales === 0) {
    return {
      trend: currentPeriodSales > 0 ? "increasing" : "stable",
      trendStrength: currentPeriodSales > 0 ? 0.5 : 0,
      changePercent: 0,
    };
  }

  const changePercent =
    ((currentPeriodSales - previousPeriodSales) / previousPeriodSales) * 100;
  const absChange = Math.abs(changePercent);

  let trend: "increasing" | "decreasing" | "stable";
  let trendStrength: number;

  if (absChange < 5) {
    trend = "stable";
    trendStrength = 0.1;
  } else if (changePercent > 0) {
    trend = "increasing";
    trendStrength = Math.min(absChange / 100, 1); // Cap at 1
  } else {
    trend = "decreasing";
    trendStrength = Math.min(absChange / 100, 1);
  }

  return {
    trend,
    trendStrength,
    changePercent,
  };
}
