import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { handleZodError } from "../utils/zod";
import {
  authenticateToken,
  requireAuth,
  requireWarehouseRole,
  AuthRequest,
} from "../middleware/auth0";

const router: Router = Router();
const prisma = new PrismaClient();

// Validation schemas
const createWarehouseSchema = z.object({
  name: z.string().min(1).max(255),
  code: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Code must be uppercase letters and numbers only"),
  location: z.string().max(500).optional(),
  address: z.string().optional(),
  isActive: z.boolean().default(true),
});

const updateWarehouseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Code must be uppercase letters and numbers only")
    .optional(),
  location: z.string().max(500).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

// CREATE - Only authenticated users can create warehouses
router.post(
  "/",
  authenticateToken,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = createWarehouseSchema.parse(req.body);
      const userId = req.user!.dbUser.id;

      // Check if code already exists
      const existingWarehouse = await prisma.warehouse.findUnique({
        where: { code: validatedData.code },
      });

      if (existingWarehouse) {
        return res.status(400).json({
          success: false,
          message: "Warehouse code already exists",
        });
      }

      // Create warehouse and make creator the owner
      const warehouse = await prisma.warehouse.create({
        data: validatedData,
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              products: true,
              categories: true,
              orders: true,
            },
          },
        },
      });

      // Add creator as owner
      await prisma.warehouseUser.create({
        data: {
          userId: userId,
          warehouseId: warehouse.id,
          role: "OWNER",
          isActive: true,
        },
      });

      res.status(201).json({
        success: true,
        message: "Warehouse created successfully",
        data: warehouse,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Warehouse code already exists",
        });
      }
      console.error("Create warehouse error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// READ ALL - Get warehouses user has access to
router.get(
  "/",
  authenticateToken,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.dbUser.id;

      // Get warehouses where user has access
      const warehouseAccess = await prisma.warehouseUser.findMany({
        where: {
          userId: userId,
          isActive: true,
        },
        include: {
          warehouse: {
            include: {
              users: {
                where: { isActive: true },
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  products: true,
                  categories: true,
                  orders: true,
                  users: { where: { isActive: true } },
                },
              },
            },
          },
        },
      });

      const warehouses = warehouseAccess.map((wa) => ({
        ...wa.warehouse,
        userRole: wa.role,
        joinedAt: wa.createdAt,
      }));

      res.json({
        success: true,
        data: warehouses,
      });
    } catch (error) {
      console.error("Get warehouses error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// READ ONE - Get specific warehouse (with access check)
router.get(
  "/:id",
  authenticateToken,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }

      const userId = req.user!.dbUser.id;

      // Check if user has access to this warehouse
      const warehouseAccess = await prisma.warehouseUser.findFirst({
        where: {
          userId: userId,
          warehouseId: id,
          isActive: true,
        },
        include: {
          warehouse: {
            include: {
              users: {
                where: { isActive: true },
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      profilePicture: true,
                    },
                  },
                },
              },
              categories: {
                where: { isActive: true },
                orderBy: { name: "asc" },
              },
              locations: {
                where: { isActive: true },
                orderBy: { name: "asc" },
              },
              _count: {
                select: {
                  products: true,
                  orders: true,
                  users: { where: { isActive: true } },
                },
              },
            },
          },
        },
      });

      if (!warehouseAccess) {
        return res.status(404).json({
          success: false,
          message: "Warehouse not found or access denied",
        });
      }

      res.json({
        success: true,
        data: {
          ...warehouseAccess.warehouse,
          userRole: warehouseAccess.role,
          joinedAt: warehouseAccess.createdAt,
        },
      });
    } catch (error) {
      console.error("Get warehouse error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// UPDATE - Only managers and owners can update
router.patch(
  "/:id",
  authenticateToken,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }

      const userId = req.user!.dbUser.id;
      const validatedData = updateWarehouseSchema.parse(req.body);

      // Check if user has manager/owner access to this warehouse
      const warehouseAccess = await prisma.warehouseUser.findFirst({
        where: {
          userId: userId,
          warehouseId: id,
          isActive: true,
          role: { in: ["MANAGER", "OWNER"] },
        },
      });

      if (!warehouseAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Manager or Owner role required.",
        });
      }

      // Check if new code already exists (if code is being updated)
      if (validatedData.code) {
        const existingWarehouse = await prisma.warehouse.findFirst({
          where: {
            code: validatedData.code,
            id: { not: id },
          },
        });

        if (existingWarehouse) {
          return res.status(400).json({
            success: false,
            message: "Warehouse code already exists",
          });
        }
      }

      const warehouse = await prisma.warehouse.update({
        where: { id },
        data: validatedData,
        include: {
          users: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              products: true,
              categories: true,
              orders: true,
            },
          },
        },
      });

      res.json({
        success: true,
        message: "Warehouse updated successfully",
        data: warehouse,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Warehouse code already exists",
        });
      }
      if (error.code === "P2025") {
        return res.status(404).json({
          success: false,
          message: "Warehouse not found",
        });
      }
      console.error("Update warehouse error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// DELETE - Only owners can delete (soft delete if has data)
router.delete(
  "/:id",
  authenticateToken,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }

      const userId = req.user!.dbUser.id;

      // Check if user is owner of this warehouse
      const warehouseAccess = await prisma.warehouseUser.findFirst({
        where: {
          userId: userId,
          warehouseId: id,
          isActive: true,
          role: "OWNER",
        },
      });

      if (!warehouseAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Owner role required.",
        });
      }

      // Check if warehouse has data
      const warehouse = await prisma.warehouse.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              products: true,
              orders: true,
              categories: true,
            },
          },
        },
      });

      if (!warehouse) {
        return res.status(404).json({
          success: false,
          message: "Warehouse not found",
        });
      }

      const hasData =
        warehouse._count.products > 0 ||
        warehouse._count.orders > 0 ||
        warehouse._count.categories > 0;

      if (hasData) {
        // Soft delete - deactivate warehouse
        const updatedWarehouse = await prisma.warehouse.update({
          where: { id },
          data: { isActive: false },
        });

        return res.json({
          success: true,
          message: "Warehouse deactivated (contains data)",
          data: updatedWarehouse,
        });
      }

      // Hard delete if no data
      await prisma.warehouse.delete({ where: { id } });

      res.json({
        success: true,
        message: "Warehouse deleted successfully",
      });
    } catch (error) {
      console.error("Delete warehouse error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET warehouse statistics
router.get(
  "/:id/stats",
  authenticateToken,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }

      const userId = req.user!.dbUser.id;

      // Check access
      const warehouseAccess = await prisma.warehouseUser.findFirst({
        where: {
          userId: userId,
          warehouseId: id,
          isActive: true,
        },
      });

      if (!warehouseAccess) {
        return res.status(404).json({
          success: false,
          message: "Warehouse not found or access denied",
        });
      }

      // Get statistics
      const [
        totalProducts,
        activeProducts,
        lowStockProducts,
        totalCategories,
        totalOrders,
        pendingOrders,
        totalUsers,
      ] = await Promise.all([
        prisma.product.count({ where: { warehouseId: id } }),
        prisma.product.count({ where: { warehouseId: id, isActive: true } }),
        prisma.product.count({
          where: {
            warehouseId: id,
            isActive: true,
            currentStock: { lte: prisma.product.fields.reorderPoint },
          },
        }),
        prisma.category.count({ where: { warehouseId: id, isActive: true } }),
        prisma.order.count({ where: { warehouseId: id } }),
        prisma.order.count({ where: { warehouseId: id, status: "PENDING" } }),
        prisma.warehouseUser.count({
          where: { warehouseId: id, isActive: true },
        }),
      ]);

      res.json({
        success: true,
        data: {
          products: {
            total: totalProducts,
            active: activeProducts,
            lowStock: lowStockProducts,
          },
          categories: totalCategories,
          orders: {
            total: totalOrders,
            pending: pendingOrders,
          },
          users: totalUsers,
        },
      });
    } catch (error) {
      console.error("Get warehouse stats error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Invite user to warehouse
router.post(
  "/:id/invite",
  authenticateToken,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }

      const { email, role } = req.body;
      const userId = req.user!.dbUser.id;

      // Validate role
      if (!["WORKER", "MANAGER", "OWNER"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role. Must be WORKER, MANAGER, or OWNER",
        });
      }

      // Check if user has manager/owner access
      const warehouseAccess = await prisma.warehouseUser.findFirst({
        where: {
          userId: userId,
          warehouseId: id,
          isActive: true,
          role: { in: ["MANAGER", "OWNER"] },
        },
      });

      if (!warehouseAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Manager or Owner role required.",
        });
      }

      // Find user by email
      const targetUser = await prisma.user.findUnique({
        where: { email },
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if user already has access
      const existingAccess = await prisma.warehouseUser.findFirst({
        where: {
          userId: targetUser.id,
          warehouseId: id,
        },
      });

      if (existingAccess) {
        if (existingAccess.isActive) {
          return res.status(400).json({
            success: false,
            message: "User already has access to this warehouse",
          });
        } else {
          // Reactivate access
          await prisma.warehouseUser.update({
            where: { id: existingAccess.id },
            data: { role, isActive: true },
          });
        }
      } else {
        // Create new access
        await prisma.warehouseUser.create({
          data: {
            userId: targetUser.id,
            warehouseId: id,
            role,
            isActive: true,
          },
        });
      }

      res.json({
        success: true,
        message: `User ${email} invited successfully with role ${role}`,
      });
    } catch (error) {
      console.error("Invite user error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
