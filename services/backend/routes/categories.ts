// services/backend/src/routes/categories.ts
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

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

// Patch schema - all fields optional for partial updates
const patchCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

// CREATE category
router.post(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = createCategorySchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Add warehouseId to category data
      const categoryData = {
        ...validatedData,
        warehouseId: warehouseId,
      };

      const category = await prisma.category.create({
        data: categoryData,
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Category name already exists in this warehouse",
        });
      }
      console.error("Create category error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET all categories for current warehouse
router.get(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      const categories = await prisma.category.findMany({
        where: {
          warehouseId: warehouseId,
          isActive: true,
        },
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      res.json({
        success: true,
        data: categories,
        meta: {
          total: categories.length,
          warehouseId: warehouseId,
        },
      });
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET single category by ID (within current warehouse)
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

      const category = await prisma.category.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          products: {
            where: { isActive: true },
            select: {
              id: true,
              sku: true,
              name: true,
              currentStock: true,
              unitPrice: true,
              isActive: true,
              createdAt: true,
            },
            orderBy: { name: "asc" },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found in this warehouse",
        });
      }

      res.json({ success: true, data: category });
    } catch (error) {
      console.error("Get category error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PATCH - Partial update category
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

      const validatedData = patchCategorySchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Check if category exists in current warehouse
      const existingCategory = await prisma.category.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
      });

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          message: "Category not found in this warehouse",
        });
      }

      // Check if name already exists in warehouse (only if name is being updated)
      if (validatedData.name && validatedData.name !== existingCategory.name) {
        const nameExists = await prisma.category.findFirst({
          where: {
            name: {
              equals: validatedData.name,
              mode: "insensitive",
            },
            warehouseId: warehouseId,
            NOT: {
              id: id, // Exclude current category
            },
          },
        });

        if (nameExists) {
          return res.status(400).json({
            success: false,
            message: "Category name already exists in this warehouse",
          });
        }
      }

      const category = await prisma.category.update({
        where: { id },
        data: validatedData,
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      res.json({
        success: true,
        message: "Category updated successfully",
        data: category,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Category name already exists in this warehouse",
        });
      }
      console.error("Update category error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// DELETE category (soft delete if has products, hard delete if empty)
router.delete(
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

      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Check if category exists in current warehouse
      const existingCategory = await prisma.category.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          message: "Category not found in this warehouse",
        });
      }

      const hasProducts = existingCategory._count.products > 0;

      if (hasProducts) {
        // Soft delete - deactivate category instead of deleting
        const deactivatedCategory = await prisma.category.update({
          where: { id },
          data: { isActive: false },
          include: {
            warehouse: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            _count: {
              select: {
                products: true,
              },
            },
          },
        });

        return res.json({
          success: true,
          message: `Category deactivated (has ${existingCategory._count.products} products)`,
          data: deactivatedCategory,
        });
      }

      // Hard delete if no products
      await prisma.category.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET all categories (including inactive) - for managers/owners
router.get(
  "/all/including-inactive",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      const categories = await prisma.category.findMany({
        where: {
          warehouseId: warehouseId,
        },
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: [
          { isActive: "desc" }, // Active first
          { name: "asc" },
        ],
      });

      res.json({
        success: true,
        data: categories,
        meta: {
          total: categories.length,
          active: categories.filter((c) => c.isActive).length,
          inactive: categories.filter((c) => !c.isActive).length,
          warehouseId: warehouseId,
        },
      });
    } catch (error) {
      console.error("Get all categories error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PATCH - Reactivate category
router.patch(
  "/:id/reactivate",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }

      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Check if category exists and is inactive
      const existingCategory = await prisma.category.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
          isActive: false,
        },
      });

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          message: "Inactive category not found in this warehouse",
        });
      }

      const category = await prisma.category.update({
        where: { id },
        data: { isActive: true },
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      res.json({
        success: true,
        message: "Category reactivated successfully",
        data: category,
      });
    } catch (error) {
      console.error("Reactivate category error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
