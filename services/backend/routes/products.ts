import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { handleZodError } from "../utils/zod";
import {
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole,
  AuthRequest,
} from "../middleware/auth0";

const router: Router = Router();
const prisma = new PrismaClient();

// Create schema - all required fields
const createProductSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  barCode: z.string().optional(),
  unitPrice: z.number().min(0),
  unitCost: z.number().min(0),
  currentStock: z.number().int().min(0).default(0),
  reorderPoint: z.number().int().min(0).default(10),
  maxStock: z.number().int().min(1).default(1000),
  categoryId: z.number().int(),
  supplierId: z.number().int().optional(),
  location: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  weight: z.number().min(0).optional(),
  dimensions: z.string().max(100).optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
});

// Patch schema - all fields optional (except currentStock which shouldn't be updated directly)
const patchProductSchema = z.object({
  sku: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  barCode: z.string().optional(),
  unitPrice: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  // currentStock excluded - should use separate stock adjustment endpoint
  reorderPoint: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(1).optional(),
  categoryId: z.number().int().optional(),
  supplierId: z.number().int().optional(),
  location: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  weight: z.number().min(0).optional(),
  dimensions: z.string().max(100).optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

// CREATE - Add authentication and warehouse context
router.post(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = createProductSchema.parse(req.body);

      // Get warehouseId from authenticated user context
      const warehouseId = req.user?.currentWarehouse?.warehouseId;

      if (!warehouseId) {
        return res.status(400).json({
          success: false,
          message:
            "Warehouse context required. Please specify X-Warehouse-Id header.",
        });
      }

      // Create product data with warehouseId
      const productData = {
        ...validatedData,
        warehouseId: warehouseId,
      };

      const product = await prisma.product.create({
        data: productData,
        include: {
          category: true,
          supplier: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      res.status(201).json({ success: true, data: product });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "SKU already exists in this warehouse",
        });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          success: false,
          message: "Invalid category, supplier, or warehouse ID",
        });
      }
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// READ ALL - Filter by warehouse
router.get(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user?.currentWarehouse?.warehouseId;

      if (!warehouseId) {
        return res.status(400).json({
          success: false,
          message:
            "Warehouse context required. Please specify X-Warehouse-Id header.",
        });
      }

      const products = await prisma.product.findMany({
        where: {
          warehouseId: warehouseId,
          isActive: true, // Only show active products by default
        },
        include: {
          category: true,
          supplier: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ success: true, data: products });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// READ ONE - Filter by warehouse
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

      const warehouseId = req.user?.currentWarehouse?.warehouseId;

      if (!warehouseId) {
        return res.status(400).json({
          success: false,
          message:
            "Warehouse context required. Please specify X-Warehouse-Id header.",
        });
      }

      const product = await prisma.product.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId, // Ensure product belongs to current warehouse
        },
        include: {
          category: true,
          supplier: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          stockMovements: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found in this warehouse",
        });
      }

      res.json({ success: true, data: product });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PATCH - Partial update with warehouse check
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

      const warehouseId = req.user?.currentWarehouse?.warehouseId;

      if (!warehouseId) {
        return res.status(400).json({
          success: false,
          message:
            "Warehouse context required. Please specify X-Warehouse-Id header.",
        });
      }

      // Use the dedicated patch schema
      const validatedData = patchProductSchema.parse(req.body);

      // Check if product exists in current warehouse
      const existingProduct = await prisma.product.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
      });

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: "Product not found in this warehouse",
        });
      }

      // Validate category if provided (should belong to same warehouse)
      if (validatedData.categoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: validatedData.categoryId,
            warehouseId: warehouseId,
          },
        });

        if (!category) {
          return res.status(400).json({
            success: false,
            message: "Category not found in this warehouse",
          });
        }
      }

      // Validate supplier if provided
      if (validatedData.supplierId) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: validatedData.supplierId },
        });

        if (!supplier) {
          return res.status(400).json({
            success: false,
            message: "Supplier not found",
          });
        }
      }

      const product = await prisma.product.update({
        where: { id },
        data: validatedData,
        include: {
          category: true,
          supplier: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      res.json({
        success: true,
        message: "Product updated successfully",
        data: product,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "SKU already exists in this warehouse",
        });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          success: false,
          message: "Invalid category or supplier ID",
        });
      }
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// DELETE - with warehouse check
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

      const warehouseId = req.user?.currentWarehouse?.warehouseId;

      if (!warehouseId) {
        return res.status(400).json({
          success: false,
          message:
            "Warehouse context required. Please specify X-Warehouse-Id header.",
        });
      }

      // Check if product exists in current warehouse and has orders
      const product = await prisma.product.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
        include: {
          orderItems: true,
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found in this warehouse",
        });
      }

      // If product has orders, soft delete (deactivate)
      if (product.orderItems.length > 0) {
        const updatedProduct = await prisma.product.update({
          where: { id },
          data: { isActive: false },
        });

        return res.json({
          success: true,
          message: "Product deactivated (has order history)",
          data: updatedProduct,
        });
      }

      // Hard delete if no orders
      await prisma.product.delete({ where: { id } });
      res.json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
