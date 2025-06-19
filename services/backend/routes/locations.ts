// services/backend/src/routes/locations.ts
import { Router, Response } from "express";
import { Location, PrismaClient } from "@prisma/client";
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
const createLocationSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().max(100).optional(),
  type: z
    .enum(["BUILDING", "ZONE", "AISLE", "SHELF", "BIN", "STORAGE"])
    .default("STORAGE"),
  zone: z.string().max(50).optional(),
  aisle: z.string().max(10).optional(),
  shelf: z.string().max(10).optional(),
  bin: z.string().max(10).optional(),
  capacity: z.number().int().min(0).optional(),
});

const updateLocationSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().max(100).optional(),
  type: z
    .enum(["BUILDING", "ZONE", "AISLE", "SHELF", "BIN", "STORAGE"])
    .optional(),
  zone: z.string().max(50).optional(),
  aisle: z.string().max(10).optional(),
  shelf: z.string().max(10).optional(),
  bin: z.string().max(10).optional(),
  capacity: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const moveProductSchema = z.object({
  productId: z.number().int(),
  fromLocationId: z.number().int().optional(),
  toLocationId: z.number().int(),
  quantity: z.number().int().min(1),
  notes: z.string().optional(),
});

const adjustStockSchema = z.object({
  productId: z.number().int(),
  locationId: z.number().int(),
  quantity: z.number().int(), // Can be positive or negative
  movementType: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  notes: z.string().optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.number().int().optional(),
});

// CREATE location
router.post(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = createLocationSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Check if location code already exists in warehouse
      const existingLocation = await prisma.location.findFirst({
        where: {
          code: validatedData.code,
          warehouseId: warehouseId,
        },
      });

      if (existingLocation) {
        return res.status(400).json({
          success: false,
          message: "Location code already exists in this warehouse",
        });
      }

      const location = await prisma.location.create({
        data: {
          ...validatedData,
          warehouseId: warehouseId,
        },
        include: {
          warehouse: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: { productLocations: true },
          },
        },
      });

      res.status(201).json({
        success: true,
        message: "Location created successfully",
        data: location,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Location code already exists in this warehouse",
        });
      }
      console.error("Create location error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET all locations
router.get(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const {
        type,
        zone,
        isActive = "true",
        includeProducts = "false",
        page = "1",
        limit = "50",
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const whereClause: any = {
        warehouseId: warehouseId,
      };

      if (type) whereClause.type = type;
      if (zone) whereClause.zone = zone;
      if (isActive === "true") whereClause.isActive = true;

      const includeOptions: any = {
        warehouse: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: { productLocations: true },
        },
      };

      if (includeProducts === "true") {
        includeOptions.productLocations = {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                currentStock: true,
              },
            },
          },
        };
      }

      const [locations, totalCount] = await Promise.all([
        prisma.location.findMany({
          where: whereClause,
          include: includeOptions,
          orderBy: [{ type: "asc" }, { zone: "asc" }, { code: "asc" }],
          skip: skip,
          take: limitNum,
        }),
        prisma.location.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: locations,
        meta: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error) {
      console.error("Get locations error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET stock movements history

router.get(
  "/stock-movements",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const {
        productId,
        locationId,
        movementType,
        referenceType,
        fromDate,
        toDate,
        page = "1",
        limit = "20",
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const whereClause: any = {
        product: {
          warehouseId: warehouseId,
        },
      };

      // ✅ Fix: Only add filters if values exist and are valid
      if (productId) {
        const parsedProductId = parseInt(productId as string);
        if (!isNaN(parsedProductId)) {
          whereClause.productId = parsedProductId;
        }
      }

      if (movementType) {
        whereClause.movementType = movementType;
      }

      if (referenceType) {
        whereClause.referenceType = referenceType;
      }

      // ✅ Fix: Only add location filter if locationId exists and is valid
      if (locationId) {
        const parsedLocationId = parseInt(locationId as string);
        if (!isNaN(parsedLocationId)) {
          whereClause.OR = [
            { fromLocationId: parsedLocationId },
            { toLocationId: parsedLocationId },
          ];
        }
      }

      // ✅ Fix: Validate dates before using them
      if (fromDate || toDate) {
        whereClause.createdAt = {};

        if (fromDate) {
          const fromDateObj = new Date(fromDate as string);
          if (!isNaN(fromDateObj.getTime())) {
            whereClause.createdAt.gte = fromDateObj;
          }
        }

        if (toDate) {
          const toDateObj = new Date(toDate as string);
          if (!isNaN(toDateObj.getTime())) {
            whereClause.createdAt.lte = toDateObj;
          }
        }
      }

      const [movements, totalCount] = await Promise.all([
        prisma.stockMovement.findMany({
          where: whereClause,
          include: {
            product: {
              select: { id: true, sku: true, name: true },
            },
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: skip,
          take: limitNum,
        }),
        prisma.stockMovement.count({ where: whereClause }),
      ]);

      // Manually fetch location details
      const movementsWithLocations = await Promise.all(
        movements.map(async (movement) => {
          const [fromLocation, toLocation] = await Promise.all([
            movement.fromLocationId
              ? prisma.location.findUnique({
                  where: { id: movement.fromLocationId },
                  select: { id: true, code: true, name: true, type: true },
                })
              : null,
            movement.toLocationId
              ? prisma.location.findUnique({
                  where: { id: movement.toLocationId },
                  select: { id: true, code: true, name: true, type: true },
                })
              : null,
          ]);

          return {
            ...movement,
            fromLocation,
            toLocation,
          };
        })
      );

      res.json({
        success: true,
        data: movementsWithLocations,
        meta: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error) {
      console.error("Get stock movements error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET single location by ID
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

      const location = await prisma.location.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
        include: {
          warehouse: {
            select: { id: true, name: true, code: true },
          },
          productLocations: {
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
            orderBy: {
              product: { name: "asc" },
            },
          },
          _count: {
            select: { productLocations: true },
          },
        },
      });

      if (!location) {
        return res.status(404).json({
          success: false,
          message: "Location not found in this warehouse",
        });
      }

      res.json({ success: true, data: location });
    } catch (error) {
      console.error("Get location error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PATCH - Update location
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

      const validatedData = updateLocationSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      // Check if location exists
      const existingLocation = await prisma.location.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
      });

      if (!existingLocation) {
        return res.status(404).json({
          success: false,
          message: "Location not found in this warehouse",
        });
      }

      // Check if new code already exists (if code is being updated)
      if (validatedData.code && validatedData.code !== existingLocation.code) {
        const codeExists = await prisma.location.findFirst({
          where: {
            code: validatedData.code,
            warehouseId: warehouseId,
            NOT: { id: id },
          },
        });

        if (codeExists) {
          return res.status(400).json({
            success: false,
            message: "Location code already exists in this warehouse",
          });
        }
      }

      const location = await prisma.location.update({
        where: { id },
        data: validatedData,
        include: {
          warehouse: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: { productLocations: true },
          },
        },
      });

      res.json({
        success: true,
        message: "Location updated successfully",
        data: location,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Location code already exists in this warehouse",
        });
      }
      console.error("Update location error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// DELETE location
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

      // Check if location exists and has products
      const existingLocation = await prisma.location.findFirst({
        where: {
          id: id,
          warehouseId: warehouseId,
        },
        include: {
          _count: {
            select: { productLocations: true },
          },
        },
      });

      if (!existingLocation) {
        return res.status(404).json({
          success: false,
          message: "Location not found in this warehouse",
        });
      }

      if (existingLocation._count.productLocations > 0) {
        // Soft delete - deactivate location instead of deleting
        const deactivatedLocation = await prisma.location.update({
          where: { id },
          data: { isActive: false },
          include: {
            _count: {
              select: { productLocations: true },
            },
          },
        });

        return res.json({
          success: true,
          message: `Location deactivated (has ${existingLocation._count.productLocations} products)`,
          data: deactivatedLocation,
        });
      }

      // Hard delete if no products
      await prisma.location.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: "Location deleted successfully",
      });
    } catch (error) {
      console.error("Delete location error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST - Move product between locations (with stock movement tracking)
router.post(
  "/move-product",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = moveProductSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const userId = req.user!.dbUser.id;

      // Validate product exists in warehouse
      const product = await prisma.product.findFirst({
        where: {
          id: validatedData.productId,
          warehouseId: warehouseId,
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found in this warehouse",
        });
      }

      // Validate locations exist in warehouse
      const locationIdsToValidate: number[] = [validatedData.toLocationId];
      if (validatedData.fromLocationId !== undefined) {
        locationIdsToValidate.push(validatedData.fromLocationId);
      }

      const locations = await prisma.location.findMany({
        where: {
          id: {
            in: locationIdsToValidate,
          },
          warehouseId: warehouseId,
          isActive: true,
        },
      });

      const toLocation = locations.find(
        (l) => l.id === validatedData.toLocationId
      );
      if (!toLocation) {
        return res.status(404).json({
          success: false,
          message: "Destination location not found",
        });
      }

      let fromLocation: Location | undefined;
      if (validatedData.fromLocationId) {
        fromLocation = locations.find(
          (l) => l.id === validatedData.fromLocationId
        );
        if (!fromLocation) {
          return res.status(404).json({
            success: false,
            message: "Source location not found",
          });
        }
      }

      // Execute move in transaction
      const result = await prisma.$transaction(async (tx) => {
        // If moving from a specific location, check quantity and update
        if (validatedData.fromLocationId) {
          const fromProductLocation = await tx.productLocation.findUnique({
            where: {
              productId_locationId: {
                productId: validatedData.productId,
                locationId: validatedData.fromLocationId,
              },
            },
          });

          if (
            !fromProductLocation ||
            fromProductLocation.quantity < validatedData.quantity
          ) {
            throw new Error(
              `Insufficient quantity at source location. Available: ${
                fromProductLocation?.quantity || 0
              }, Requested: ${validatedData.quantity}`
            );
          }

          // Reduce quantity at source location
          await tx.productLocation.update({
            where: {
              productId_locationId: {
                productId: validatedData.productId,
                locationId: validatedData.fromLocationId,
              },
            },
            data: {
              quantity: {
                decrement: validatedData.quantity,
              },
            },
          });
        }

        // Add/update quantity at destination location
        await tx.productLocation.upsert({
          where: {
            productId_locationId: {
              productId: validatedData.productId,
              locationId: validatedData.toLocationId,
            },
          },
          update: {
            quantity: {
              increment: validatedData.quantity,
            },
          },
          create: {
            productId: validatedData.productId,
            locationId: validatedData.toLocationId,
            quantity: validatedData.quantity,
          },
        });

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            movementType: "TRANSFER",
            quantity: validatedData.quantity,
            fromLocationId: validatedData.fromLocationId,
            toLocationId: validatedData.toLocationId,
            notes: validatedData.notes,
            referenceType: "manual_transfer",
            productId: validatedData.productId,
            createdById: userId,
          },
        });

        return {
          fromLocation,
          toLocation,
          product,
          quantity: validatedData.quantity,
        };
      });

      res.json({
        success: true,
        message: "Product moved successfully",
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      console.error("Move product error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Server error",
      });
    }
  }
);

// POST - Adjust stock at location (with stock movement tracking)
router.post(
  "/adjust-stock",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = adjustStockSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const userId = req.user!.dbUser.id;

      // Validate product and location
      const [product, location] = await Promise.all([
        prisma.product.findFirst({
          where: {
            id: validatedData.productId,
            warehouseId: warehouseId,
          },
        }),
        prisma.location.findFirst({
          where: {
            id: validatedData.locationId,
            warehouseId: warehouseId,
            isActive: true,
          },
        }),
      ]);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found in this warehouse",
        });
      }

      if (!location) {
        return res.status(404).json({
          success: false,
          message: "Location not found in this warehouse",
        });
      }

      // Execute adjustment in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Get current product location record
        const currentProductLocation = await tx.productLocation.findUnique({
          where: {
            productId_locationId: {
              productId: validatedData.productId,
              locationId: validatedData.locationId,
            },
          },
        });

        const currentQuantity = currentProductLocation?.quantity || 0;

        // Calculate new quantity
        let newQuantity;
        if (validatedData.movementType === "ADJUSTMENT") {
          newQuantity = validatedData.quantity; // Absolute value
        } else if (validatedData.movementType === "IN") {
          newQuantity = currentQuantity + Math.abs(validatedData.quantity);
        } else {
          // OUT
          newQuantity = currentQuantity - Math.abs(validatedData.quantity);
        }

        if (newQuantity < 0) {
          throw new Error(
            `Insufficient stock. Current: ${currentQuantity}, Requested: ${Math.abs(
              validatedData.quantity
            )}`
          );
        }

        // Update product location
        await tx.productLocation.upsert({
          where: {
            productId_locationId: {
              productId: validatedData.productId,
              locationId: validatedData.locationId,
            },
          },
          update: {
            quantity: newQuantity,
          },
          create: {
            productId: validatedData.productId,
            locationId: validatedData.locationId,
            quantity: newQuantity,
          },
        });

        // Calculate quantity change for stock movement
        const quantityChange = newQuantity - currentQuantity;

        // Update product total stock
        await tx.product.update({
          where: { id: validatedData.productId },
          data: {
            currentStock: {
              increment: quantityChange,
            },
          },
        });

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            movementType: validatedData.movementType,
            quantity: quantityChange,
            toLocationId: validatedData.locationId,
            notes: validatedData.notes,
            referenceType: validatedData.referenceType || "manual_adjustment",
            referenceId: validatedData.referenceId,
            productId: validatedData.productId,
            createdById: userId,
          },
        });

        return {
          product,
          location,
          previousQuantity: currentQuantity,
          newQuantity,
          quantityChange,
        };
      });

      res.json({
        success: true,
        message: "Stock adjusted successfully",
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      console.error("Adjust stock error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Server error",
      });
    }
  }
);

// GET location statistics
router.get(
  "/stats/summary",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      const [
        totalLocations,
        activeLocations,
        locationsByType,
        locationsWithProducts,
        totalCapacity,
      ] = await Promise.all([
        prisma.location.count({
          where: { warehouseId },
        }),
        prisma.location.count({
          where: { warehouseId, isActive: true },
        }),
        prisma.location.groupBy({
          by: ["type"],
          where: { warehouseId },
          _count: true,
        }),
        prisma.location.count({
          where: {
            warehouseId,
            productLocations: {
              some: {},
            },
          },
        }),
        prisma.location.aggregate({
          where: { warehouseId },
          _sum: { capacity: true },
        }),
      ]);

      res.json({
        success: true,
        data: {
          summary: {
            totalLocations,
            activeLocations,
            locationsWithProducts,
            emptyLocations: activeLocations - locationsWithProducts,
            totalCapacity: totalCapacity._sum.capacity || 0,
          },
          locationsByType,
        },
      });
    } catch (error) {
      console.error("Get location stats error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
