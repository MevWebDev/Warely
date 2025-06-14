// services/backend/src/routes/products.ts
import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

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

// Helper function
const handleZodError = (error: z.ZodError) => ({
  success: false,
  message: "Validation failed",
  errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
});

// CREATE
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = createProductSchema.parse(req.body);
    const product = await prisma.product.create({
      data,
      include: { category: true, supplier: true },
    });

    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(handleZodError(error));
    }
    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "SKU already exists",
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
});

// READ ALL
router.get("/", async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true, supplier: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// READ ONE
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
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
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH - Partial update
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    // Use the dedicated patch schema
    const data = patchProductSchema.parse(req.body);

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Validate category if provided
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // Validate supplier if provided
    if (data.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
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
      data,
      include: { category: true, supplier: true },
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
        message: "SKU already exists",
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
});

// DELETE
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    // Check if product exists and has orders
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        orderItems: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
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
});

export default router;
