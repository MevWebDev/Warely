// services/backend/src/routes/suppliers.ts
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
const createSupplierSchema = z.object({
  name: z.string().min(1).max(255),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  address: z.string().optional(),
  isActive: z.boolean().default(true),
});

// Patch schema - all fields optional for partial updates
const patchSupplierSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

// CREATE supplier
router.post(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = createSupplierSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Add warehouseId to supplier data
      const supplierData = {
        ...validatedData,
        warehouseId: warehouseId,
      };

      const supplier = await prisma.supplier.create({
        data: supplierData,
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
        message: "Supplier created successfully",
        data: supplier,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Supplier name already exists in this warehouse",
        });
      }
      console.error("Create supplier error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET all suppliers for current warehouse
router.get(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      const suppliers = await prisma.supplier.findMany({
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
        data: suppliers,
        meta: {
          total: suppliers.length,
          warehouseId: warehouseId,
        },
      });
    } catch (error) {
      console.error("Get suppliers error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET single supplier by ID (within current warehouse)
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

      const supplier = await prisma.supplier.findFirst({
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

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: "Supplier not found in this warehouse",
        });
      }

      res.json({ success: true, data: supplier });
    } catch (error) {
      console.error("Get supplier error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PATCH - Partial update supplier
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

      const validatedData = patchSupplierSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Check if supplier exists in current warehouse
      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
      });

      if (!existingSupplier) {
        return res.status(404).json({
          success: false,
          message: "Supplier not found in this warehouse",
        });
      }

      // Check if name already exists in warehouse (only if name is being updated)
      if (validatedData.name && validatedData.name !== existingSupplier.name) {
        const nameExists = await prisma.supplier.findFirst({
          where: {
            name: {
              equals: validatedData.name,
              mode: "insensitive",
            },
            warehouseId: warehouseId,
            NOT: {
              id: id, // Exclude current supplier
            },
          },
        });

        if (nameExists) {
          return res.status(400).json({
            success: false,
            message: "Supplier name already exists in this warehouse",
          });
        }
      }

      const supplier = await prisma.supplier.update({
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
          message: "Supplier name already exists in this warehouse",
        });
      }
      console.error("Update supplier error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// DELETE supplier (soft delete or hard delete based on usage)
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

      // Check if supplier exists in current warehouse
      const existingSupplier = await prisma.supplier.findFirst({
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

      if (!existingSupplier) {
        return res.status(404).json({
          success: false,
          message: "Supplier not found in this warehouse",
        });
      }

      // Check if supplier has products
      if (existingSupplier._count.products > 0) {
        // Soft delete - deactivate supplier instead of deleting
        const deactivatedSupplier = await prisma.supplier.update({
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
          message: `Supplier deactivated (has ${existingSupplier._count.products} associated products)`,
          data: deactivatedSupplier,
        });
      }

      // Hard delete if no products
      await prisma.supplier.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Supplier deleted successfully",
      });
    } catch (error) {
      console.error("Delete supplier error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET all suppliers (including inactive) - for managers/owners
router.get(
  "/all/including-inactive",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      const suppliers = await prisma.supplier.findMany({
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
        data: suppliers,
        meta: {
          total: suppliers.length,
          active: suppliers.filter((s) => s.isActive).length,
          inactive: suppliers.filter((s) => !s.isActive).length,
          warehouseId: warehouseId,
        },
      });
    } catch (error) {
      console.error("Get all suppliers error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PATCH - Reactivate supplier
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

      // Check if supplier exists and is inactive
      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
          isActive: false,
        },
      });

      if (!existingSupplier) {
        return res.status(404).json({
          success: false,
          message: "Inactive supplier not found in this warehouse",
        });
      }

      const supplier = await prisma.supplier.update({
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
        message: "Supplier reactivated successfully",
        data: supplier,
      });
    } catch (error) {
      console.error("Reactivate supplier error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
