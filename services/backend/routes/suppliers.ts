// services/backend/src/routes/suppliers.ts
import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { handleZodError } from "../utils/zod";

const router: Router = Router();
const prisma = new PrismaClient();

const createSupplierSchema = z.object({
  name: z.string().min(1).max(255),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  address: z.string().optional(),
});

// Patch schema - all fields optional for partial updates
const patchSupplierSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  address: z.string().optional(),
});

// CREATE supplier
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = createSupplierSchema.parse(req.body);
    const supplier = await prisma.supplier.create({ data });

    res.status(201).json({ success: true, data: supplier });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(handleZodError(error));
    }
    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "Supplier name already exists",
      });
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET all suppliers
router.get("/", async (req: Request, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({ success: true, data: suppliers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET single supplier by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            sku: true,
            name: true,
            currentStock: true,
            unitPrice: true,
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

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH - Partial update supplier
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const data = patchSupplierSchema.parse(req.body);

    // Check if supplier exists
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    // Check if name already exists (only if name is being updated and it's different)
    if (data.name && data.name !== existingSupplier.name) {
      const nameExists = await prisma.supplier.findFirst({
        where: {
          name: {
            equals: data.name,
            mode: "insensitive",
          },
          NOT: {
            id: id, // Exclude current supplier
          },
        },
      });

      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: "Supplier name already exists",
        });
      }
    }

    const supplier = await prisma.supplier.update({
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
      message: "Supplier updated successfully",
      data: supplier,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(handleZodError(error));
    }
    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "Supplier name already exists",
      });
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE supplier
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    // Check if supplier exists
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!existingSupplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    // Check if supplier has products
    if (existingSupplier._count.products > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete supplier. It has ${existingSupplier._count.products} associated products. Please reassign or delete the products first.`,
        productCount: existingSupplier._count.products,
      });
    }

    await prisma.supplier.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Supplier deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
