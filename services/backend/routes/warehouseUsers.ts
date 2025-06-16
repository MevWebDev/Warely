import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  authenticateToken,
  requireAuth,
  requireWarehouseAccess,
  requireWarehouseRole,
  AuthRequest,
} from "../middleware/auth0";

const router: Router = Router();
const prisma = new PrismaClient();

// Validation schemas
const updateRoleSchema = z.object({
  role: z.enum(["WORKER", "MANAGER", "OWNER"], {
    errorMap: () => ({ message: "Role must be WORKER, MANAGER, or OWNER" }),
  }),
});

const inviteUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  role: z.enum(["WORKER", "MANAGER", "OWNER"], {
    errorMap: () => ({ message: "Role must be WORKER, MANAGER, or OWNER" }),
  }),
});

// Helper function for validation errors
const handleZodError = (error: z.ZodError) => ({
  success: false,
  message: "Validation failed",
  errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
});

// GET ALL - List all users in a warehouse (managers and owners only)
router.get(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      const warehouseUsers = await prisma.warehouseUser.findMany({
        where: {
          warehouseId: warehouseId,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              auth0Id: true,
              email: true,
              name: true,
              profilePicture: true,
              isActive: true,
              createdAt: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: [
          { role: "asc" }, // OWNER first, then MANAGER, then WORKER
          { createdAt: "asc" }, // Oldest first within same role
        ],
      });

      // Transform data for better frontend consumption
      const users = warehouseUsers.map((wu) => ({
        id: wu.id,
        role: wu.role,
        joinedAt: wu.createdAt,
        updatedAt: wu.updatedAt,
        user: wu.user,
        warehouse: wu.warehouse,
      }));

      res.json({
        success: true,
        data: users,
        meta: {
          total: users.length,
          warehouseId: warehouseId,
        },
      });
    } catch (error) {
      console.error("Get warehouse users error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET ONE - Get specific user in warehouse
router.get(
  "/:userId",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid user ID" });
      }

      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      const warehouseUser = await prisma.warehouseUser.findFirst({
        where: {
          userId: userId,
          warehouseId: warehouseId,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              auth0Id: true,
              email: true,
              name: true,
              profilePicture: true,
              isActive: true,
              createdAt: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (!warehouseUser) {
        return res.status(404).json({
          success: false,
          message: "User not found in this warehouse",
        });
      }

      res.json({
        success: true,
        data: {
          id: warehouseUser.id,
          role: warehouseUser.role,
          joinedAt: warehouseUser.createdAt,
          updatedAt: warehouseUser.updatedAt,
          user: warehouseUser.user,
          warehouse: warehouseUser.warehouse,
        },
      });
    } catch (error) {
      console.error("Get warehouse user error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PUT - Update user role (owners and managers can update, but with restrictions)
router.patch(
  "/:userId/role",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid user ID" });
      }

      const validatedData = updateRoleSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const currentUserRole = req.user!.currentWarehouse!.role;
      const currentUserId = req.user!.dbUser.id;

      // Find the target user
      const targetUserAccess = await prisma.warehouseUser.findFirst({
        where: {
          userId: userId,
          warehouseId: warehouseId,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!targetUserAccess) {
        return res.status(404).json({
          success: false,
          message: "User not found in this warehouse",
        });
      }

      // Business rules for role changes
      if (currentUserRole === "MANAGER") {
        // Managers can only manage workers
        if (targetUserAccess.role === "OWNER") {
          return res.status(403).json({
            success: false,
            message: "Managers cannot modify owners",
          });
        }
        if (validatedData.role === "OWNER") {
          return res.status(403).json({
            success: false,
            message: "Managers cannot promote users to owner",
          });
        }
      }

      // Users cannot modify themselves
      if (userId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: "You cannot modify your own role",
        });
      }

      // Check if this would leave warehouse without owners
      if (targetUserAccess.role === "OWNER" && validatedData.role !== "OWNER") {
        const ownerCount = await prisma.warehouseUser.count({
          where: {
            warehouseId: warehouseId,
            role: "OWNER",
            isActive: true,
          },
        });

        if (ownerCount <= 1) {
          return res.status(400).json({
            success: false,
            message:
              "Cannot remove the last owner. Promote another user to owner first.",
          });
        }
      }

      // Update the role
      const updatedUserAccess = await prisma.warehouseUser.update({
        where: { id: targetUserAccess.id },
        data: { role: validatedData.role },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });

      res.json({
        success: true,
        message: `User role updated to ${validatedData.role}`,
        data: {
          id: updatedUserAccess.id,
          role: updatedUserAccess.role,
          user: updatedUserAccess.user,
          updatedAt: updatedUserAccess.updatedAt,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      console.error("Update user role error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// DELETE - Remove user from warehouse (soft delete)
router.delete(
  "/:userId",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid user ID" });
      }

      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const currentUserRole = req.user!.currentWarehouse!.role;
      const currentUserId = req.user!.dbUser.id;

      // Find the target user
      const targetUserAccess = await prisma.warehouseUser.findFirst({
        where: {
          userId: userId,
          warehouseId: warehouseId,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!targetUserAccess) {
        return res.status(404).json({
          success: false,
          message: "User not found in this warehouse",
        });
      }

      // Business rules for removal
      if (currentUserRole === "MANAGER" && targetUserAccess.role === "OWNER") {
        return res.status(403).json({
          success: false,
          message: "Managers cannot remove owners",
        });
      }

      // Users cannot remove themselves
      if (userId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: "You cannot remove yourself from the warehouse",
        });
      }

      // Check if this would leave warehouse without owners
      if (targetUserAccess.role === "OWNER") {
        const ownerCount = await prisma.warehouseUser.count({
          where: {
            warehouseId: warehouseId,
            role: "OWNER",
            isActive: true,
          },
        });

        if (ownerCount <= 1) {
          return res.status(400).json({
            success: false,
            message: "Cannot remove the last owner. Transfer ownership first.",
          });
        }
      }

      // Soft delete (deactivate) the user access
      await prisma.warehouseUser.update({
        where: { id: targetUserAccess.id },
        data: { isActive: false },
      });

      res.json({
        success: true,
        message: `User ${targetUserAccess.user.email} removed from warehouse`,
        data: {
          removedUser: {
            id: targetUserAccess.user.id,
            email: targetUserAccess.user.email,
            name: targetUserAccess.user.name,
            role: targetUserAccess.role,
          },
        },
      });
    } catch (error) {
      console.error("Remove user from warehouse error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST - Invite/Add user to warehouse
router.post(
  "/invite",
  authenticateToken,
  requireWarehouseAccess,
  requireWarehouseRole(["MANAGER", "OWNER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = inviteUserSchema.parse(req.body);
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const currentUserRole = req.user!.currentWarehouse!.role;

      // Managers can only invite workers
      if (currentUserRole === "MANAGER" && validatedData.role !== "WORKER") {
        return res.status(403).json({
          success: false,
          message: "Managers can only invite users as workers",
        });
      }

      // Find user by email
      const targetUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
        select: {
          id: true,
          email: true,
          name: true,
          profilePicture: true,
          isActive: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found. They must log in to the system first.",
        });
      }

      if (!targetUser.isActive) {
        return res.status(400).json({
          success: false,
          message: "User account is inactive",
        });
      }

      // Check if user already has access
      const existingAccess = await prisma.warehouseUser.findFirst({
        where: {
          userId: targetUser.id,
          warehouseId: warehouseId,
        },
      });

      if (existingAccess) {
        if (existingAccess.isActive) {
          return res.status(400).json({
            success: false,
            message: "User already has access to this warehouse",
            data: {
              currentRole: existingAccess.role,
            },
          });
        } else {
          // Reactivate access with new role
          const updatedAccess = await prisma.warehouseUser.update({
            where: { id: existingAccess.id },
            data: {
              role: validatedData.role,
              isActive: true,
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  profilePicture: true,
                },
              },
            },
          });

          return res.json({
            success: true,
            message: `User ${validatedData.email} re-invited successfully with role ${validatedData.role}`,
            data: {
              id: updatedAccess.id,
              role: updatedAccess.role,
              user: updatedAccess.user,
              joinedAt: updatedAccess.createdAt,
            },
          });
        }
      }

      // Create new access
      const newAccess = await prisma.warehouseUser.create({
        data: {
          userId: targetUser.id,
          warehouseId: warehouseId,
          role: validatedData.role,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              profilePicture: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        message: `User ${validatedData.email} invited successfully with role ${validatedData.role}`,
        data: {
          id: newAccess.id,
          role: newAccess.role,
          user: newAccess.user,
          joinedAt: newAccess.createdAt,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      console.error("Invite user error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
