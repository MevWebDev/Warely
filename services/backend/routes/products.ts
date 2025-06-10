import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const router: Router = Router();
const prisma = new PrismaClient();

// Validation schema for product creation
const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(255),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  category: z.string().min(1, "Category is required"),
  brand: z.string().optional(),
  sku: z.string().optional(),
  inStock: z.boolean().default(true),
  quantity: z.number().int().min(0).default(0),
  imageUrl: z.string().url().optional(),
});

// CREATE - Add new product
router.post("/", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = createProductSchema.parse(req.body);

    // Create product in database
    const product = await prisma.product.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        price: validatedData.price,
        category: validatedData.category,
        brand: validatedData.brand,
        sku: validatedData.sku,
        inStock: validatedData.inStock,
        quantity: validatedData.quantity,
        imageUrl: validatedData.imageUrl,
      },
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    console.error("Error creating product:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// READ - Get all products with optional filtering
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, inStock, page = "1", limit = "10" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    const where: any = {};
    if (category) where.category = category;
    if (inStock !== undefined) where.inStock = inStock === "true";

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// READ - Get single product by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// UPDATE - Update product by ID
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = createProductSchema.partial().parse(req.body);

    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data: validatedData,
    });

    res.json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    console.error("Error updating product:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// DELETE - Delete product by ID
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.product.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
