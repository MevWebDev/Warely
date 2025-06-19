// services/backend/src/routes/analytics.ts
import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole,
  AuthRequest,
} from "../middleware/auth0";
import { handleZodError } from "../utils/zod";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const router: Router = Router();
const prisma = new PrismaClient();

// Validation schemas
const trackEventSchema = z.object({
  eventType: z.string().min(1),
  eventName: z.string().min(1),
  description: z.string().optional(),
  data: z.any().optional(),
  value: z.number().optional(),
  productId: z.number().optional(),
  orderId: z.number().optional(),
  supplierId: z.number().optional(),
  categoryId: z.number().optional(),
  locationId: z.number().optional(),
});

const generateReportSchema = z.object({
  type: z.enum([
    "SALES",
    "INVENTORY",
    "ORDERS",
    "SUPPLIERS",
    "WAREHOUSE_PERFORMANCE",
    "PRODUCT_PERFORMANCE",
    "CUSTOM",
  ]),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  parameters: z
    .object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      productIds: z.array(z.number()).optional(),
      categoryIds: z.array(z.number()).optional(),
      supplierIds: z.array(z.number()).optional(),
      orderTypes: z.array(z.enum(["INBOUND", "OUTBOUND"])).optional(),
      includeDetails: z.boolean().default(false),
    })
    .optional(),
  format: z.enum(["JSON", "EXCEL", "CSV"]).default("JSON"),
  isScheduled: z.boolean().default(false),
  frequency: z
    .enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"])
    .optional(),
});

const analyticsQuerySchema = z.object({
  eventType: z.string().optional(),
  eventName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().default("100"),
  page: z.string().default("1"),
});

// POST - Track analytics event
router.post(
  "/track",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = trackEventSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const userId = req.user!.dbUser.id;

      const analyticsEvent = await prisma.analyticsEvent.create({
        data: {
          ...validatedData,
          warehouseId,
          userId,
        },
      });

      res.status(201).json({
        success: true,
        message: "Event tracked successfully",
        data: analyticsEvent,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      console.error("Error tracking analytics event:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to track event" });
    }
  }
);

// GET - Analytics events
router.get(
  "/events",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const query = analyticsQuerySchema.parse(req.query);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      const limit = parseInt(query.limit);
      const page = parseInt(query.page);
      const skip = (page - 1) * limit;

      const whereClause: any = { warehouseId };

      if (query.eventType) whereClause.eventType = query.eventType;
      if (query.eventName) whereClause.eventName = query.eventName;

      if (query.startDate || query.endDate) {
        whereClause.timestamp = {};
        if (query.startDate)
          whereClause.timestamp.gte = new Date(query.startDate);
        if (query.endDate) whereClause.timestamp.lte = new Date(query.endDate);
      }

      const [events, total] = await Promise.all([
        prisma.analyticsEvent.findMany({
          where: whereClause,
          include: {
            user: { select: { id: true, name: true, email: true } },
            product: { select: { id: true, sku: true, name: true } },
            order: { select: { id: true, orderNumber: true, type: true } },
            supplier: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
            location: { select: { id: true, code: true, name: true } },
          },
          orderBy: { timestamp: "desc" },
          skip,
          take: limit,
        }),
        prisma.analyticsEvent.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: events,
        meta: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      console.error("Error fetching analytics events:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch events" });
    }
  }
);

// GET - Sales Analytics
router.get(
  "/sales",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const { startDate, endDate, groupBy = "day" } = req.query;

      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(startDate as string);
      if (endDate) dateFilter.lte = new Date(endDate as string);

      // Sales overview
      const salesData = await prisma.order.findMany({
        where: {
          warehouseId,
          type: "OUTBOUND",
          status: "COMPLETED",
          ...(Object.keys(dateFilter).length > 0 && {
            completedDate: dateFilter,
          }),
        },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      // Calculate metrics with null safety
      const totalRevenue = salesData.reduce((sum, order) => {
        const amount = order.totalAmount ? Number(order.totalAmount) : 0;
        return sum + amount;
      }, 0);

      const totalOrders = salesData.length;
      const averageOrderValue =
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Top products with null safety
      const productSales: Record<
        number,
        { name: string; category: string; quantity: number; revenue: number }
      > = {};

      salesData.forEach((order) => {
        order.orderItems.forEach((item) => {
          if (!productSales[item.productId]) {
            productSales[item.productId] = {
              name: item.product.name,
              category: item.product.category?.name || "Uncategorized",
              quantity: 0,
              revenue: 0,
            };
          }
          productSales[item.productId].quantity += item.quantity || 0;
          const itemPrice = item.totalPrice ? Number(item.totalPrice) : 0;
          productSales[item.productId].revenue += itemPrice;
        });
      });

      const topProducts = Object.entries(productSales)
        .map(([id, data]) => ({ productId: parseInt(id), ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Category performance with null safety
      const categoryPerformance: Record<
        string,
        { quantity: number; revenue: number; orders: Set<number> }
      > = {};

      salesData.forEach((order) => {
        order.orderItems.forEach((item) => {
          const categoryName = item.product.category?.name || "Uncategorized";
          if (!categoryPerformance[categoryName]) {
            categoryPerformance[categoryName] = {
              quantity: 0,
              revenue: 0,
              orders: new Set(),
            };
          }
          categoryPerformance[categoryName].quantity += item.quantity || 0;
          const itemPrice = item.totalPrice ? Number(item.totalPrice) : 0;
          categoryPerformance[categoryName].revenue += itemPrice;
          categoryPerformance[categoryName].orders.add(order.id);
        });
      });

      // Time series data with null safety
      const timeSeries = salesData.reduce(
        (acc: Record<string, { orders: number; revenue: number }>, order) => {
          const date = order.completedDate || order.orderDate;
          let key: string;

          if (groupBy === "week") {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split("T")[0];
          } else if (groupBy === "month") {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
              2,
              "0"
            )}`;
          } else {
            key = date.toISOString().split("T")[0];
          }

          if (!acc[key]) {
            acc[key] = { orders: 0, revenue: 0 };
          }
          acc[key].orders += 1;
          const amount = order.totalAmount ? Number(order.totalAmount) : 0;
          acc[key].revenue += amount;
          return acc;
        },
        {}
      );

      res.json({
        success: true,
        data: {
          summary: {
            totalRevenue,
            totalOrders,
            averageOrderValue,
            period: {
              startDate: startDate || null,
              endDate: endDate || null,
            },
          },
          topProducts,
          categoryPerformance: Object.entries(categoryPerformance).map(
            ([name, data]) => ({
              category: name,
              quantity: data.quantity,
              revenue: data.revenue,
              orders: data.orders.size,
            })
          ),
          timeSeries: Object.entries(timeSeries)
            .map(([date, data]) => ({
              date,
              ...data,
            }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        },
      });
    } catch (error) {
      console.error("Error fetching sales analytics:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch sales analytics" });
    }
  }
);

// GET - Inventory Analytics
router.get(
  "/inventory",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Get all products with stock levels
      const products = await prisma.product.findMany({
        where: { warehouseId, isActive: true },
        include: {
          category: { select: { name: true } },
          supplier: { select: { name: true } },
          productLocations: {
            include: {
              location: { select: { code: true, name: true } },
            },
          },
        },
      });

      // Calculate inventory metrics with null safety
      const totalProducts = products.length;
      const totalStockValue = products.reduce((sum, p) => {
        const stock = p.currentStock || 0;
        const cost = p.unitCost ? Number(p.unitCost) : 0;
        return sum + stock * cost;
      }, 0);

      const averageStockLevel =
        totalProducts > 0
          ? products.reduce((sum, p) => sum + (p.currentStock || 0), 0) /
            totalProducts
          : 0;

      // Low stock alerts with null safety
      const lowStockProducts = products.filter(
        (p) => (p.currentStock || 0) <= (p.reorderPoint || 0)
      );
      const outOfStockProducts = products.filter(
        (p) => (p.currentStock || 0) === 0
      );

      // Category distribution with null safety
      const categoryDistribution: Record<
        string,
        { products: number; totalStock: number; totalValue: number }
      > = {};

      products.forEach((product) => {
        const categoryName = product.category?.name || "Uncategorized";
        if (!categoryDistribution[categoryName]) {
          categoryDistribution[categoryName] = {
            products: 0,
            totalStock: 0,
            totalValue: 0,
          };
        }
        categoryDistribution[categoryName].products += 1;
        categoryDistribution[categoryName].totalStock +=
          product.currentStock || 0;

        const stock = product.currentStock || 0;
        const cost = product.unitCost ? Number(product.unitCost) : 0;
        categoryDistribution[categoryName].totalValue += stock * cost;
      });

      // Stock turnover with null safety
      const stockTurnover = products
        .map((product) => {
          const currentStock = product.currentStock || 0;
          const reservedStock = product.reservedStock || 0;
          const unitCost = product.unitCost ? Number(product.unitCost) : 0;

          const availableStock = currentStock - reservedStock;
          const turnoverRate =
            currentStock > 0 ? reservedStock / currentStock : 0;

          return {
            productId: product.id,
            sku: product.sku,
            name: product.name,
            currentStock,
            reservedStock,
            availableStock,
            turnoverRate,
            stockValue: currentStock * unitCost,
          };
        })
        .sort((a, b) => b.turnoverRate - a.turnoverRate);

      res.json({
        success: true,
        data: {
          summary: {
            totalProducts,
            totalStockValue,
            averageStockLevel,
            lowStockCount: lowStockProducts.length,
            outOfStockCount: outOfStockProducts.length,
          },
          alerts: {
            lowStock: lowStockProducts.map((p) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              currentStock: p.currentStock || 0,
              reorderPoint: p.reorderPoint || 0,
            })),
            outOfStock: outOfStockProducts.map((p) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
            })),
          },
          categoryDistribution: Object.entries(categoryDistribution).map(
            ([name, data]) => ({
              category: name,
              ...data,
            })
          ),
          topPerformers: stockTurnover.slice(0, 10),
          slowMovers: stockTurnover.slice(-10).reverse(),
        },
      });
    } catch (error) {
      console.error("Error fetching inventory analytics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch inventory analytics",
      });
    }
  }
);

// GET - Warehouse Performance KPIs
router.get(
  "/kpis",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const { period = "monthly", startDate, endDate } = req.query;

      // Get recent KPIs
      const whereClause: any = { warehouseId, period };

      if (startDate || endDate) {
        whereClause.date = {};
        if (startDate) whereClause.date.gte = new Date(startDate as string);
        if (endDate) whereClause.date.lte = new Date(endDate as string);
      }

      const kpis = await prisma.kPI.findMany({
        where: whereClause,
        orderBy: { date: "desc" },
        take: 100,
      });

      // Calculate current period KPIs
      const now = new Date();
      const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Order fulfillment rate
      const totalOrders = await prisma.order.count({
        where: {
          warehouseId,
          orderDate: { gte: currentPeriodStart },
        },
      });

      const completedOrders = await prisma.order.count({
        where: {
          warehouseId,
          status: "COMPLETED",
          orderDate: { gte: currentPeriodStart },
        },
      });

      const fulfillmentRate =
        totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

      // Average order processing time (in hours) with null safety
      const processedOrders = await prisma.order.findMany({
        where: {
          warehouseId,
          status: "COMPLETED",
          completedDate: { not: null },
          orderDate: { gte: currentPeriodStart },
        },
        select: {
          orderDate: true,
          completedDate: true,
        },
      });

      const avgProcessingTime =
        processedOrders.length > 0
          ? processedOrders.reduce((sum, order) => {
              if (!order.completedDate) return sum;
              const processingTime =
                order.completedDate.getTime() - order.orderDate.getTime();
              return sum + processingTime / (1000 * 60 * 60); // Convert to hours
            }, 0) / processedOrders.length
          : 0;

      // Stock accuracy (simplified) with null safety
      const products = await prisma.product.findMany({
        where: { warehouseId, isActive: true },
        select: { currentStock: true, reorderPoint: true },
      });

      const stockAccuracy =
        products.length > 0
          ? (products.filter((p) => (p.currentStock || 0) >= 0).length /
              products.length) *
            100
          : 100;

      // Revenue growth (compared to previous period) with null safety
      const previousPeriodStart = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const currentPeriodEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      );

      const [currentRevenue, previousRevenue] = await Promise.all([
        prisma.order.aggregate({
          where: {
            warehouseId,
            type: "OUTBOUND",
            status: "COMPLETED",
            completedDate: {
              gte: currentPeriodStart,
              lte: currentPeriodEnd,
            },
          },
          _sum: { totalAmount: true },
        }),
        prisma.order.aggregate({
          where: {
            warehouseId,
            type: "OUTBOUND",
            status: "COMPLETED",
            completedDate: {
              gte: previousPeriodStart,
              lt: currentPeriodStart,
            },
          },
          _sum: { totalAmount: true },
        }),
      ]);

      const currentRevenueValue = currentRevenue._sum.totalAmount
        ? Number(currentRevenue._sum.totalAmount)
        : 0;
      const previousRevenueValue = previousRevenue._sum.totalAmount
        ? Number(previousRevenue._sum.totalAmount)
        : 0;

      const revenueGrowth =
        previousRevenueValue > 0
          ? ((currentRevenueValue - previousRevenueValue) /
              previousRevenueValue) *
            100
          : 0;

      // Group KPIs by category
      const kpisByCategory = kpis.reduce((acc: Record<string, any[]>, kpi) => {
        if (!acc[kpi.category]) acc[kpi.category] = [];
        acc[kpi.category].push(kpi);
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          current: {
            fulfillmentRate: Number(fulfillmentRate.toFixed(2)),
            avgProcessingTime: Number(avgProcessingTime.toFixed(2)),
            stockAccuracy: Number(stockAccuracy.toFixed(2)),
            revenueGrowth: Number(revenueGrowth.toFixed(2)),
            currentRevenue: currentRevenueValue,
            totalOrders,
            completedOrders,
          },
          historical: kpisByCategory,
          period,
        },
      });
    } catch (error) {
      console.error("Error fetching KPIs:", error);
      res.status(500).json({ success: false, message: "Failed to fetch KPIs" });
    }
  }
);

// POST - Generate Report
router.post(
  "/reports/generate",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = generateReportSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const userId = req.user!.dbUser.id;

      // Create report record
      const report = await prisma.report.create({
        data: {
          type: validatedData.type,
          title: validatedData.title,
          description: validatedData.description,
          parameters: validatedData.parameters || {},
          status: "GENERATING",
          isScheduled: validatedData.isScheduled,
          frequency: validatedData.frequency,
          warehouseId,
          createdById: userId,
        },
      });

      // Generate report data based on type
      let reportData: any = {};
      const params = validatedData.parameters || {};

      switch (validatedData.type) {
        case "SALES":
          reportData = await generateSalesReport(warehouseId, params);
          break;
        case "INVENTORY":
          reportData = await generateInventoryReport(warehouseId, params);
          break;
        case "ORDERS":
          reportData = await generateOrdersReport(warehouseId, params);
          break;
        case "SUPPLIERS":
          reportData = await generateSuppliersReport(warehouseId, params);
          break;
        case "WAREHOUSE_PERFORMANCE":
          reportData = await generateWarehousePerformanceReport(
            warehouseId,
            params
          );
          break;
        case "PRODUCT_PERFORMANCE":
          reportData = await generateProductPerformanceReport(
            warehouseId,
            params
          );
          break;
      }

      // Save report file
      let filePath: string | null = null;
      let fileUrl: string | null = null;

      if (validatedData.format === "EXCEL") {
        filePath = await saveExcelReport(
          report.id,
          report.title,
          reportData,
          validatedData.type
        );
        fileUrl = `/reports/${report.title}.xlsx`;
      } else if (validatedData.format === "CSV") {
        filePath = await saveCsvReport(
          report.id,
          reportData,
          validatedData.type
        );
        fileUrl = `/reports/${report.title}.csv`;
      }

      // Update report with completion
      const updatedReport = await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "COMPLETED",
          generatedAt: new Date(),
          filePath,
          fileUrl,
        },
        include: {
          createdBy: { select: { name: true, email: true } },
        },
      });

      res.json({
        success: true,
        message: "Report generated successfully",
        data: {
          report: updatedReport,
          ...(validatedData.format === "JSON" && { reportData }),
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      console.error("Error generating report:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to generate report" });
    }
  }
);

// GET - List Reports
router.get(
  "/reports",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const { type, status, page = "1", limit = "20" } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const whereClause: any = { warehouseId };
      if (type) whereClause.type = type;
      if (status) whereClause.status = status;

      const [reports, totalCount] = await Promise.all([
        prisma.report.findMany({
          where: whereClause,
          include: {
            createdBy: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.report.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: reports,
        meta: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching reports:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch reports" });
    }
  }
);

// Helper functions for report generation
async function generateSalesReport(warehouseId: number, params: any) {
  const dateFilter: any = {};
  if (params.startDate) dateFilter.gte = new Date(params.startDate);
  if (params.endDate) dateFilter.lte = new Date(params.endDate);

  const orders = await prisma.order.findMany({
    where: {
      warehouseId,
      type: "OUTBOUND",
      status: "COMPLETED",
      ...(Object.keys(dateFilter).length > 0 && { completedDate: dateFilter }),
    },
    include: {
      orderItems: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const totalRevenue = orders.reduce((sum, order) => {
    const amount = order.totalAmount ? Number(order.totalAmount) : 0;
    return sum + amount;
  }, 0);

  const averageOrderValue =
    orders.length > 0 ? totalRevenue / orders.length : 0;

  return {
    summary: {
      totalOrders: orders.length,
      totalRevenue,
      averageOrderValue,
    },
    orders: params.includeDetails ? orders : [],
  };
}

async function generateInventoryReport(warehouseId: number, params: any) {
  const whereClause: any = { warehouseId, isActive: true };
  if (params.categoryIds?.length)
    whereClause.categoryId = { in: params.categoryIds };
  if (params.productIds?.length) whereClause.id = { in: params.productIds };

  const products = await prisma.product.findMany({
    where: whereClause,
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });

  const totalStockValue = products.reduce((sum, p) => {
    const stock = p.currentStock || 0;
    const cost = p.unitCost ? Number(p.unitCost) : 0;
    return sum + stock * cost;
  }, 0);

  const lowStockCount = products.filter(
    (p) => (p.currentStock || 0) <= (p.reorderPoint || 0)
  ).length;

  return {
    summary: {
      totalProducts: products.length,
      totalStockValue,
      lowStockCount,
    },
    products: params.includeDetails ? products : [],
  };
}

async function generateOrdersReport(warehouseId: number, params: any) {
  const whereClause: any = { warehouseId };
  if (params.orderTypes?.length) whereClause.type = { in: params.orderTypes };

  const dateFilter: any = {};
  if (params.startDate) dateFilter.gte = new Date(params.startDate);
  if (params.endDate) dateFilter.lte = new Date(params.endDate);
  if (Object.keys(dateFilter).length > 0) whereClause.orderDate = dateFilter;

  const orders = await prisma.order.findMany({
    where: whereClause,
    include: {
      supplier: { select: { name: true } },
      orderItems: {
        include: {
          product: { select: { name: true, sku: true } },
        },
      },
    },
  });

  return {
    summary: {
      totalOrders: orders.length,
      inboundOrders: orders.filter((o) => o.type === "INBOUND").length,
      outboundOrders: orders.filter((o) => o.type === "OUTBOUND").length,
      pendingOrders: orders.filter((o) => o.status === "PENDING").length,
      completedOrders: orders.filter((o) => o.status === "COMPLETED").length,
    },
    orders: params.includeDetails ? orders : [],
  };
}

async function generateSuppliersReport(warehouseId: number, params: any) {
  const whereClause: any = { warehouseId, isActive: true };
  if (params.supplierIds?.length) whereClause.id = { in: params.supplierIds };

  const suppliers = await prisma.supplier.findMany({
    where: whereClause,
    include: {
      orders: {
        where: { status: "COMPLETED" },
        select: { totalAmount: true, orderDate: true },
      },
      products: {
        select: { id: true, name: true, currentStock: true },
      },
    },
  });

  return {
    summary: {
      totalSuppliers: suppliers.length,
      activeSuppliers: suppliers.filter((s) => s.orders.length > 0).length,
    },
    suppliers: suppliers.map((supplier) => ({
      ...supplier,
      totalOrders: supplier.orders.length,
      totalSpent: supplier.orders.reduce((sum, order) => {
        const amount = order.totalAmount ? Number(order.totalAmount) : 0;
        return sum + amount;
      }, 0),
      products: params.includeDetails
        ? supplier.products
        : supplier.products.length,
    })),
  };
}

async function generateWarehousePerformanceReport(
  warehouseId: number,
  params: any
) {
  const dateFilter: any = {};
  if (params.startDate) dateFilter.gte = new Date(params.startDate);
  if (params.endDate) dateFilter.lte = new Date(params.endDate);

  const orders = await prisma.order.count({
    where: {
      warehouseId,
      ...(Object.keys(dateFilter).length > 0 && { orderDate: dateFilter }),
    },
  });

  const products = await prisma.product.count({
    where: { warehouseId, isActive: true },
  });

  const locations = await prisma.location.count({
    where: { warehouseId, isActive: true },
  });

  return {
    summary: {
      totalOrders: orders,
      totalProducts: products,
      totalLocations: locations,
      message: "Warehouse performance report generated",
    },
  };
}

async function generateProductPerformanceReport(
  warehouseId: number,
  params: any
) {
  const whereClause: any = { warehouseId, isActive: true };
  if (params.productIds?.length) whereClause.id = { in: params.productIds };

  const products = await prisma.product.findMany({
    where: whereClause,
    include: {
      orderItems: {
        select: {
          quantity: true,
          totalPrice: true,
          order: { select: { status: true, orderDate: true } },
        },
      },
    },
  });

  const productPerformance = products.map((product) => {
    const completedOrderItems = product.orderItems.filter(
      (item) => item.order.status === "COMPLETED"
    );

    const totalSold = completedOrderItems.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );

    const totalRevenue = completedOrderItems.reduce((sum, item) => {
      const price = item.totalPrice ? Number(item.totalPrice) : 0;
      return sum + price;
    }, 0);

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      currentStock: product.currentStock || 0,
      totalSold,
      totalRevenue,
      turnoverRate:
        (product.currentStock || 0) > 0
          ? totalSold / (product.currentStock || 1)
          : 0,
    };
  });

  return {
    summary: {
      totalProducts: products.length,
      message: "Product performance report generated",
    },
    products: productPerformance.sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    ),
  };
}

// Replace the saveExcelReport function in analytics.ts

async function saveExcelReport(
  reportId: number,
  reportName: string,
  data: any,
  type: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(type);

  // Set worksheet properties
  worksheet.properties.defaultRowHeight = 20;

  switch (type) {
    case "SALES":
      // Summary section
      worksheet.addRow(["SALES REPORT SUMMARY"]);
      worksheet.addRow(["Total Orders", data.summary?.totalOrders || 0]);
      worksheet.addRow(["Total Revenue", data.summary?.totalRevenue || 0]);
      worksheet.addRow([
        "Average Order Value",
        data.summary?.averageOrderValue || 0,
      ]);
      worksheet.addRow([]); // Empty row

      // Orders details if included
      if (data.orders && data.orders.length > 0) {
        worksheet.addRow(["ORDER DETAILS"]);
        worksheet.addRow([
          "Order ID",
          "Order Number",
          "Type",
          "Status",
          "Total Amount",
          "Order Date",
          "Completed Date",
          "Supplier",
        ]);

        data.orders.forEach((order: any) => {
          worksheet.addRow([
            order.id,
            order.orderNumber,
            order.type,
            order.status,
            order.totalAmount || 0,
            order.orderDate
              ? new Date(order.orderDate).toLocaleDateString()
              : "",
            order.completedDate
              ? new Date(order.completedDate).toLocaleDateString()
              : "",
            order.supplier?.name || "N/A",
          ]);
        });

        worksheet.addRow([]); // Empty row

        // Order Items details
        worksheet.addRow(["ORDER ITEMS DETAILS"]);
        worksheet.addRow([
          "Order ID",
          "Product SKU",
          "Product Name",
          "Quantity",
          "Unit Price",
          "Total Price",
          "Category",
        ]);

        data.orders.forEach((order: any) => {
          order.orderItems?.forEach((item: any) => {
            worksheet.addRow([
              order.id,
              item.product?.sku || "",
              item.product?.name || "",
              item.quantity || 0,
              item.unitPrice || 0,
              item.totalPrice || 0,
              item.product?.category?.name || "N/A",
            ]);
          });
        });
      }
      break;

    case "INVENTORY":
      // Summary section
      worksheet.addRow(["INVENTORY REPORT SUMMARY"]);
      worksheet.addRow(["Total Products", data.summary?.totalProducts || 0]);
      worksheet.addRow([
        "Total Stock Value",
        data.summary?.totalStockValue || 0,
      ]);
      worksheet.addRow(["Low Stock Count", data.summary?.lowStockCount || 0]);
      worksheet.addRow([]); // Empty row

      // Products details if included
      if (data.products && data.products.length > 0) {
        worksheet.addRow(["PRODUCT DETAILS"]);
        worksheet.addRow([
          "Product ID",
          "SKU",
          "Name",
          "Current Stock",
          "Reserved Stock",
          "Reorder Point",
          "Unit Cost",
          "Stock Value",
          "Category",
          "Supplier",
          "Status",
        ]);

        data.products.forEach((product: any) => {
          const stockValue =
            (product.currentStock || 0) * (product.unitCost || 0);
          worksheet.addRow([
            product.id,
            product.sku,
            product.name,
            product.currentStock || 0,
            product.reservedStock || 0,
            product.reorderPoint || 0,
            product.unitCost || 0,
            stockValue,
            product.category?.name || "N/A",
            product.supplier?.name || "N/A",
            product.isActive ? "Active" : "Inactive",
          ]);
        });
      }
      break;

    case "ORDERS":
      // Summary section
      worksheet.addRow(["ORDERS REPORT SUMMARY"]);
      worksheet.addRow(["Total Orders", data.summary?.totalOrders || 0]);
      worksheet.addRow(["Inbound Orders", data.summary?.inboundOrders || 0]);
      worksheet.addRow(["Outbound Orders", data.summary?.outboundOrders || 0]);
      worksheet.addRow(["Pending Orders", data.summary?.pendingOrders || 0]);
      worksheet.addRow([
        "Completed Orders",
        data.summary?.completedOrders || 0,
      ]);
      worksheet.addRow([]); // Empty row

      // Orders details if included
      if (data.orders && data.orders.length > 0) {
        worksheet.addRow(["ORDER DETAILS"]);
        worksheet.addRow([
          "Order ID",
          "Order Number",
          "Type",
          "Status",
          "Total Amount",
          "Order Date",
          "Expected Date",
          "Completed Date",
          "Supplier",
          "Notes",
        ]);

        data.orders.forEach((order: any) => {
          worksheet.addRow([
            order.id,
            order.orderNumber,
            order.type,
            order.status,
            order.totalAmount || 0,
            order.orderDate
              ? new Date(order.orderDate).toLocaleDateString()
              : "",
            order.expectedDate
              ? new Date(order.expectedDate).toLocaleDateString()
              : "",
            order.completedDate
              ? new Date(order.completedDate).toLocaleDateString()
              : "",
            order.supplier?.name || "N/A",
            order.notes || "",
          ]);
        });
      }
      break;

    case "SUPPLIERS":
      // Summary section
      worksheet.addRow(["SUPPLIERS REPORT SUMMARY"]);
      worksheet.addRow(["Total Suppliers", data.summary?.totalSuppliers || 0]);
      worksheet.addRow([
        "Active Suppliers",
        data.summary?.activeSuppliers || 0,
      ]);
      worksheet.addRow([]); // Empty row

      // Suppliers details
      if (data.suppliers && data.suppliers.length > 0) {
        worksheet.addRow(["SUPPLIER DETAILS"]);
        worksheet.addRow([
          "Supplier ID",
          "Name",
          "Contact Person",
          "Email",
          "Phone",
          "Total Orders",
          "Total Spent",
          "Product Count",
          "Status",
        ]);

        data.suppliers.forEach((supplier: any) => {
          worksheet.addRow([
            supplier.id,
            supplier.name,
            supplier.contactPerson || "",
            supplier.email || "",
            supplier.phone || "",
            supplier.totalOrders || 0,
            supplier.totalSpent || 0,
            Array.isArray(supplier.products)
              ? supplier.products.length
              : supplier.products || 0,
            supplier.isActive ? "Active" : "Inactive",
          ]);
        });
      }
      break;

    case "WAREHOUSE_PERFORMANCE":
      worksheet.addRow(["WAREHOUSE PERFORMANCE REPORT"]);
      worksheet.addRow(["Total Orders", data.summary?.totalOrders || 0]);
      worksheet.addRow(["Total Products", data.summary?.totalProducts || 0]);
      worksheet.addRow(["Total Locations", data.summary?.totalLocations || 0]);
      worksheet.addRow(["Report Message", data.summary?.message || ""]);
      break;

    case "PRODUCT_PERFORMANCE":
      // Summary section
      worksheet.addRow(["PRODUCT PERFORMANCE REPORT SUMMARY"]);
      worksheet.addRow(["Total Products", data.summary?.totalProducts || 0]);
      worksheet.addRow([]); // Empty row

      // Product performance details
      if (data.products && data.products.length > 0) {
        worksheet.addRow(["PRODUCT PERFORMANCE DETAILS"]);
        worksheet.addRow([
          "Product ID",
          "SKU",
          "Name",
          "Current Stock",
          "Total Sold",
          "Total Revenue",
          "Turnover Rate",
        ]);

        data.products.forEach((product: any) => {
          worksheet.addRow([
            product.id,
            product.sku,
            product.name,
            product.currentStock || 0,
            product.totalSold || 0,
            product.totalRevenue || 0,
            product.turnoverRate || 0,
          ]);
        });
      }
      break;

    default:
      worksheet.addRow(["Unknown Report Type"]);
      worksheet.addRow(["Data", JSON.stringify(data)]);
  }

  // Style the header rows
  worksheet.eachRow((row, rowNumber) => {
    if (
      rowNumber === 1 ||
      row.getCell(1).value?.toString().includes("DETAILS") ||
      row.getCell(1).value?.toString().includes("SUMMARY")
    ) {
      row.font = { bold: true };
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    }
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = maxLength < 10 ? 10 : maxLength > 50 ? 50 : maxLength + 2;
  });

  // Ensure reports directory exists
  const reportsDir = path.join(process.cwd(), "uploads", "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filePath = path.join(reportsDir, `${reportId}. ${reportName}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

// Also improve the saveCsvReport function
async function saveCsvReport(
  reportId: number,
  data: any,
  type: string
): Promise<string> {
  const reportsDir = path.join(process.cwd(), "uploads", "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filePath = path.join(reportsDir, `${reportId}.csv`);

  let csvContent = "";

  switch (type) {
    case "SALES":
      csvContent += "SALES REPORT SUMMARY\n";
      csvContent += `Total Orders,${data.summary?.totalOrders || 0}\n`;
      csvContent += `Total Revenue,${data.summary?.totalRevenue || 0}\n`;
      csvContent += `Average Order Value,${
        data.summary?.averageOrderValue || 0
      }\n\n`;

      if (data.orders && data.orders.length > 0) {
        csvContent +=
          "Order ID,Order Number,Type,Status,Total Amount,Order Date,Completed Date,Supplier\n";
        data.orders.forEach((order: any) => {
          csvContent += `${order.id},"${order.orderNumber}",${order.type},${
            order.status
          },${order.totalAmount || 0},"${
            order.orderDate
              ? new Date(order.orderDate).toLocaleDateString()
              : ""
          }","${
            order.completedDate
              ? new Date(order.completedDate).toLocaleDateString()
              : ""
          }","${order.supplier?.name || "N/A"}"\n`;
        });
      }
      break;

    case "INVENTORY":
      csvContent += "INVENTORY REPORT SUMMARY\n";
      csvContent += `Total Products,${data.summary?.totalProducts || 0}\n`;
      csvContent += `Total Stock Value,${data.summary?.totalStockValue || 0}\n`;
      csvContent += `Low Stock Count,${data.summary?.lowStockCount || 0}\n\n`;

      if (data.products && data.products.length > 0) {
        csvContent +=
          "Product ID,SKU,Name,Current Stock,Reserved Stock,Reorder Point,Unit Cost,Category,Supplier\n";
        data.products.forEach((product: any) => {
          csvContent += `${product.id},"${product.sku}","${product.name}",${
            product.currentStock || 0
          },${product.reservedStock || 0},${product.reorderPoint || 0},${
            product.unitCost || 0
          },"${product.category?.name || "N/A"}","${
            product.supplier?.name || "N/A"
          }"\n`;
        });
      }
      break;

    default:
      csvContent = JSON.stringify(data, null, 2);
  }

  fs.writeFileSync(filePath, csvContent);
  return filePath;
}

export default router;
