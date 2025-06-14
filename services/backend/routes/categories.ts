// services/backend/src/routes/categories.ts
import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const router: Router = Router();
const prisma = new PrismaClient();

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

// Patch schema - all fields optional for partial updates
const patchCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
});

// Helper function
const handleZodError = (error: z.ZodError) => ({
  success: false,
  message: "Validation failed",
  errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
});

// CREATE category
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = createCategorySchema.parse(req.body);
    const category = await prisma.category.create({ data });

    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(handleZodError(error));
    }
    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "Category name already exists",
      });
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET all categories
router.get("/", async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET single category by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            sku: true,
            name: true,
            currentStock: true,
            isActive: true,
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
        message: "Category not found",
      });
    }

    res.json({ success: true, data: category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH - Partial update category
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const data = patchCategorySchema.parse(req.body);

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const category = await prisma.category.update({
      where: { id },
      data,
      include: {
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
        message: "Category name already exists!",
      });
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE category
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id },
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
        message: "Category not found",
      });
    }

    // Check if category has products
    if (existingCategory._count.products > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${existingCategory._count.products} associated products. Please move or delete the products first.`,
        productCount: existingCategory._count.products,
      });
    }

    await prisma.category.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
