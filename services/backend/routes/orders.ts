// services/backend/src/routes/orders.ts
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

const router: Router = Router();
const prisma = new PrismaClient();

// Generate unique order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

// Updated validation schemas
const createOrderSchema = z.object({
  type: z.enum(["INBOUND", "OUTBOUND"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),

  // Customer/Vendor info
  customerName: z.string().max(255).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(50).optional(),
  shippingAddress: z.string().optional(),
  billingAddress: z.string().optional(),

  supplierId: z.number().int().optional(), // Required for INBOUND orders
  expectedDate: z.string().datetime().optional(),
  notes: z.string().optional(),

  // Tax handling
  taxAmount: z.number().min(0).default(0),

  items: z
    .array(
      z.object({
        productId: z.number().int(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0),
      })
    )
    .min(1),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"]),
  notes: z.string().optional(),
});

const updateOrderSchema = z.object({
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  customerName: z.string().max(255).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(50).optional(),
  shippingAddress: z.string().optional(),
  billingAddress: z.string().optional(),
  expectedDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  taxAmount: z.number().min(0).optional(),
});

// CREATE order
// CREATE order - WITH PROPER STOCK HANDLING
router.post(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = createOrderSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const userId = req.user!.dbUser.id;

      // Validate order type requirements
      if (validatedData.type === "INBOUND" && !validatedData.supplierId) {
        return res.status(400).json({
          success: false,
          message: "Supplier ID is required for inbound orders",
        });
      }

      if (validatedData.type === "OUTBOUND" && !validatedData.shippingAddress) {
        return res.status(400).json({
          success: false,
          message: "Shipping address is required for outbound orders",
        });
      }

      // Validate supplier belongs to warehouse (for INBOUND orders)
      if (validatedData.supplierId) {
        const supplier = await prisma.supplier.findFirst({
          where: {
            id: validatedData.supplierId,
            warehouseId: warehouseId,
            isActive: true,
          },
        });

        if (!supplier) {
          return res.status(400).json({
            success: false,
            message: "Supplier not found in this warehouse",
          });
        }
      }

      // Validate all products belong to warehouse
      const productIds = validatedData.items.map((item) => item.productId);
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          warehouseId: warehouseId,
          isActive: true,
        },
        include: {
          supplier: {
            select: { id: true, name: true },
          },
        },
      });

      if (products.length !== productIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more products not found in this warehouse",
        });
      }

      if (validatedData.type === "INBOUND" && validatedData.supplierId) {
        const invalidProducts = products.filter(
          (product) => product.supplierId !== validatedData.supplierId
        );

        if (invalidProducts.length > 0) {
          const invalidProductNames = invalidProducts.map(
            (p) =>
              `${p.name} (SKU: ${p.sku}) - supplied by ${
                p.supplier?.name || "Unknown"
              }`
          );

          return res.status(400).json({
            success: false,
            message: `Cannot create inbound order: The following products are not supplied by the selected supplier: ${invalidProductNames.join(
              ", "
            )}`,
            details: {
              invalidProducts: invalidProducts.map((p) => ({
                id: p.id,
                sku: p.sku,
                name: p.name,
                currentSupplier: p.supplier?.name || "Unknown",
                currentSupplierId: p.supplierId,
              })),
            },
          });
        }
      }

      // For OUTBOUND orders, check available stock (currentStock - reservedStock)
      if (validatedData.type === "OUTBOUND") {
        for (const item of validatedData.items) {
          const product = products.find((p) => p.id === item.productId);
          if (product) {
            if (product.currentStock < item.quantity) {
              return res.status(400).json({
                success: false,
                message: `Insufficient available stock for product ${
                  product.name
                }. Available: ${product.currentStock} (Total: ${
                  product.currentStock
                }, Reserved: ${product.reservedStock || 0}), Requested: ${
                  item.quantity
                }`,
              });
            }
          }
        }
      }

      // Calculate amounts
      const subtotal = validatedData.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      const totalAmount = subtotal + validatedData.taxAmount;

      // Create order with items in a transaction
      const order = await prisma.$transaction(async (tx) => {
        // Generate unique order number
        let orderNumber;
        let isUnique = false;

        while (!isUnique) {
          orderNumber = generateOrderNumber();
          const existing = await tx.order.findUnique({
            where: { orderNumber },
          });
          if (!existing) isUnique = true;
        }

        // Create the order
        const newOrder = await tx.order.create({
          data: {
            orderNumber: orderNumber!,
            type: validatedData.type,
            status: "PENDING",
            priority: validatedData.priority,

            // Customer info
            customerName: validatedData.customerName,
            customerEmail: validatedData.customerEmail,
            customerPhone: validatedData.customerPhone,
            shippingAddress: validatedData.shippingAddress,
            billingAddress: validatedData.billingAddress,

            // Amounts
            subtotal: subtotal,
            taxAmount: validatedData.taxAmount,
            totalAmount: totalAmount,

            // Dates
            expectedDate: validatedData.expectedDate
              ? new Date(validatedData.expectedDate)
              : null,

            notes: validatedData.notes,
            warehouseId: warehouseId,
            createdById: userId,
            supplierId: validatedData.supplierId,
          },
        });

        // Create order items
        const orderItems = await Promise.all(
          validatedData.items.map((item) =>
            tx.orderItem.create({
              data: {
                orderId: newOrder.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
              },
            })
          )
        );

        // ✅ Handle stock changes for OUTBOUND orders
        if (validatedData.type === "OUTBOUND") {
          for (const item of validatedData.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                // Reserve the stock (increase reserved stock)
                reservedStock: {
                  increment: item.quantity,
                },
                // Decrease available stock
                currentStock: {
                  decrement: item.quantity,
                },
              },
            });
          }
        }

        // ❌ For INBOUND orders: No stock changes until delivery

        return { ...newOrder, orderItems };
      });

      // Fetch complete order data
      const completeOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          warehouse: {
            select: { id: true, name: true, code: true },
          },
          supplier: {
            select: { id: true, name: true, contactEmail: true },
          },
          createdBy: {
            select: { id: true, email: true, name: true },
          },
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  currentStock: true,
                  reservedStock: true, // Include reserved stock in response
                },
              },
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: completeOrder,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      console.error("Create order error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET all orders
router.get(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Query parameters for filtering
      const {
        type,
        status,
        priority,
        supplierId,
        customerName,
        orderNumber,
        page = "1",
        limit = "10",
        sortBy = "orderDate",
        sortOrder = "desc",
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const whereClause: any = {
        warehouseId: warehouseId,
      };

      if (type) whereClause.type = type;
      if (status) whereClause.status = status;
      if (priority) whereClause.priority = priority;
      if (supplierId) whereClause.supplierId = parseInt(supplierId as string);
      if (customerName) {
        whereClause.customerName = {
          contains: customerName,
          mode: "insensitive",
        };
      }
      if (orderNumber) {
        whereClause.orderNumber = {
          contains: orderNumber,
          mode: "insensitive",
        };
      }

      // Get orders with pagination
      const [orders, totalCount] = await Promise.all([
        prisma.order.findMany({
          where: whereClause,
          include: {
            warehouse: {
              select: { id: true, name: true, code: true },
            },
            supplier: {
              select: { id: true, name: true },
            },
            createdBy: {
              select: { id: true, email: true, name: true },
            },
            orderItems: {
              include: {
                product: {
                  select: { id: true, sku: true, name: true },
                },
              },
            },
            _count: {
              select: { orderItems: true },
            },
          },
          orderBy: { [sortBy as string]: sortOrder },
          skip: skip,
          take: limitNum,
        }),
        prisma.order.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: orders,
        meta: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error) {
      console.error("Get orders error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET single order by ID
router.get(
  "/:id",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }

      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      const order = await prisma.order.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
        include: {
          warehouse: {
            select: { id: true, name: true, code: true },
          },
          supplier: {
            select: {
              id: true,
              name: true,
              contactEmail: true,
              contactPhone: true,
            },
          },
          createdBy: {
            select: { id: true, email: true, name: true },
          },
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  currentStock: true,
                  unitCost: true,
                  unitPrice: true,
                },
              },
            },
            orderBy: { id: "asc" },
          },
        },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found in this warehouse",
        });
      }

      res.json({ success: true, data: order });
    } catch (error) {
      console.error("Get order error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PATCH - Update order details
router.patch(
  "/:id",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }

      const validatedData = updateOrderSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Check if order exists and can be modified
      const existingOrder = await prisma.order.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
      });

      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: "Order not found in this warehouse",
        });
      }

      if (existingOrder.status === "COMPLETED") {
        return res.status(400).json({
          success: false,
          message: "Cannot modify completed order",
        });
      }

      // Prepare update data
      const updateData: any = {};

      if (validatedData.priority !== undefined)
        updateData.priority = validatedData.priority;
      if (validatedData.customerName !== undefined)
        updateData.customerName = validatedData.customerName;
      if (validatedData.customerEmail !== undefined)
        updateData.customerEmail = validatedData.customerEmail;
      if (validatedData.customerPhone !== undefined)
        updateData.customerPhone = validatedData.customerPhone;
      if (validatedData.shippingAddress !== undefined)
        updateData.shippingAddress = validatedData.shippingAddress;
      if (validatedData.billingAddress !== undefined)
        updateData.billingAddress = validatedData.billingAddress;
      if (validatedData.expectedDate !== undefined) {
        updateData.expectedDate = validatedData.expectedDate
          ? new Date(validatedData.expectedDate)
          : null;
      }
      if (validatedData.notes !== undefined)
        updateData.notes = validatedData.notes;

      // Recalculate total if tax amount changed
      if (validatedData.taxAmount !== undefined) {
        updateData.taxAmount = validatedData.taxAmount;
        updateData.totalAmount =
          existingOrder.subtotal.toNumber() + validatedData.taxAmount;
      }

      const updatedOrder = await prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          warehouse: {
            select: { id: true, name: true, code: true },
          },
          supplier: {
            select: { id: true, name: true },
          },
          orderItems: {
            include: {
              product: {
                select: { id: true, sku: true, name: true },
              },
            },
          },
        },
      });

      res.json({
        success: true,
        message: "Order updated successfully",
        data: updatedOrder,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      console.error("Update order error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PATCH - Update order status
// PATCH - Update order status (CORRECTED)
router.patch(
  "/:id/status",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }

      const validatedData = updateOrderStatusSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Check if order exists
      const existingOrder = await prisma.order.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: "Order not found in this warehouse",
        });
      }

      // Validate status transition
      if (
        existingOrder.status === "COMPLETED" &&
        validatedData.status !== "COMPLETED"
      ) {
        return res.status(400).json({
          success: false,
          message: "Cannot change status of completed order",
        });
      }

      const updateData: any = {
        status: validatedData.status,
        notes: validatedData.notes || existingOrder.notes,
      };

      if (validatedData.status === "COMPLETED") {
        updateData.completedDate = new Date();
      }

      // Update order and handle stock changes in transaction
      const updatedOrder = await prisma.$transaction(async (tx) => {
        // Update order status
        const order = await tx.order.update({
          where: { id },
          data: updateData,
          include: {
            warehouse: {
              select: { id: true, name: true, code: true },
            },
            supplier: {
              select: { id: true, name: true },
            },
            orderItems: {
              include: {
                product: {
                  select: {
                    id: true,
                    sku: true,
                    name: true,
                    currentStock: true,
                    reservedStock: true,
                  },
                },
              },
            },
          },
        });

        // Handle stock changes based on status transitions
        if (
          validatedData.status === "COMPLETED" &&
          existingOrder.status !== "COMPLETED"
        ) {
          if (existingOrder.type === "OUTBOUND") {
            // ✅ OUTBOUND: Just release reserved stock (items shipped)
            for (const item of existingOrder.orderItems) {
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  reservedStock: {
                    decrement: item.quantity, // Release reservation
                  },
                  // ❌ DON'T touch currentStock - it was already decremented when order was created
                },
              });
            }
          } else if (existingOrder.type === "INBOUND") {
            // ✅ INBOUND: Add stock when order is completed (products received)
            for (const item of existingOrder.orderItems) {
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  currentStock: {
                    increment: item.quantity, // Add received stock
                  },
                  // No reserved stock handling for inbound orders
                },
              });
            }
            console.log("INBOUND order completed - stock updated successfully");
          }
        }

        // Handle order cancellation
        if (
          validatedData.status === "CANCELLED" &&
          existingOrder.status !== "CANCELLED"
        ) {
          if (existingOrder.type === "OUTBOUND") {
            // ✅ OUTBOUND: Restore stock and release reservation
            for (const item of existingOrder.orderItems) {
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  currentStock: {
                    increment: item.quantity, // Restore stock
                  },
                  reservedStock: {
                    decrement: item.quantity, // Release reservation
                  },
                },
              });
            }
          }
          // ❌ INBOUND: No stock changes needed for cancelled inbound orders
        }

        return order;
      });

      res.json({
        success: true,
        message: "Order status updated successfully",
        data: updatedOrder,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      console.error("Update order status error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET order statistics
router.get(
  "/stats/summary",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const { timeframe = "30" } = req.query; // days

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(timeframe as string));

      const [
        totalOrders,
        pendingOrders,
        completedOrders,
        totalValue,
        recentOrders,
        ordersByStatus,
      ] = await Promise.all([
        prisma.order.count({
          where: {
            warehouseId: warehouseId,
            orderDate: { gte: daysAgo },
          },
        }),
        prisma.order.count({
          where: {
            warehouseId: warehouseId,
            status: { in: ["PENDING"] },
          },
        }),
        prisma.order.count({
          where: {
            warehouseId: warehouseId,
            status: "COMPLETED",
            orderDate: { gte: daysAgo },
          },
        }),
        prisma.order.aggregate({
          where: {
            warehouseId: warehouseId,
            status: "COMPLETED",
            orderDate: { gte: daysAgo },
          },
          _sum: { totalAmount: true },
        }),
        prisma.order.findMany({
          where: {
            warehouseId: warehouseId,
          },
          include: {
            supplier: {
              select: { id: true, name: true },
            },
            _count: {
              select: { orderItems: true },
            },
          },
          orderBy: { orderDate: "desc" },
          take: 5,
        }),
        prisma.order.groupBy({
          by: ["status"],
          where: {
            warehouseId: warehouseId,
          },
          _count: true,
        }),
      ]);

      res.json({
        success: true,
        data: {
          summary: {
            totalOrders,
            pendingOrders,
            completedOrders,
            totalValue: totalValue._sum.totalAmount || 0,
            timeframeDays: parseInt(timeframe as string),
          },
          recentOrders,
          ordersByStatus,
        },
      });
    } catch (error) {
      console.error("Get order stats error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
